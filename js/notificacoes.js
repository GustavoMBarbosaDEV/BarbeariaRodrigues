// =====================================================================
//  Notificações
//  Juntam num só lugar (o sininho):
//   Cliente: mensagens da barbearia (confirmação, cancelamento, pedido pronto),
//            avisos/promoções, lembrete do horário (véspera, dia e 2 h antes),
//            "abriu o horário que você queria" (lista de espera), fidelidade e aniversário.
//   Equipe:  pedidos de horário novos, cancelamentos (com quem está na lista de espera),
//            relatórios prontos (dia, semana, mês), reservas do shop e estoque baixo.
//  Se a pessoa permitir, também aparecem como notificação do celular/computador.
//  Com o app aberto ou em segundo plano quem avisa é o próprio app; com o app fechado,
//  quem envia é o serviço de avisos (pasta avisos-worker/), quando estiver ligado.
// =====================================================================
import { D } from "./dados.js";
import { S } from "./estado.js";
import { $, $$, ls, hoje, somaDias, quando } from "./util.js";
import { ATIVOS, dataHora, lembreteMin, podeCancelar, limiteCancelar, conjunto, vagaAberta, interessadosNaVaga } from "./agenda.js";
import { fechamentosProntos, diaEncerrado, fidelidade, periodo } from "./caixa.js";

let paradas = [];
let fontes = {};          // nome -> lista de itens
let primeiraCarga = new Set();
let jaAvisados = new Set(ls.get("bc.notif.avisados", []));

export const N = {
  itens: [],

  iniciar(u) {
    paradas.forEach(f => f()); paradas = []; fontes = {}; primeiraCarga = new Set(); N.itens = [];
    N.atualizaBadges();
    if (!u) return;
    if (D.ehEquipe) iniciaEquipe(); else iniciaCliente(u);
    if (N.ligadas()) registraPush();   // renova o endereço do aparelho de tempos em tempos
  },

  naoLidas() { return N.itens.filter(i => !i.lida).length; },

  /** Marca tudo como visto. */
  async marcarLidas() {
    const vistos = new Set(ls.get(chaveVistos(), []));
    for (const i of N.itens) {
      if (i.lida) continue;
      if (i.fonte === "msg") D.salvar(`notificacoes/${D.usuario.uid}/itens`, i.id, { lida: true }).catch(() => { });
      else vistos.add(i.chave);
    }
    ls.set(chaveVistos(), [...vistos].slice(-300));
    recalcula();
  },

  /** A equipe manda uma mensagem para um cliente (aparece no sininho dele). */
  async enviar(uidCliente, titulo, texto, link = "horarios") {
    if (!uidCliente || uidCliente.startsWith("ex") && D.modo === "demo") return;
    try { await D.criar(`notificacoes/${uidCliente}/itens`, { titulo: String(titulo).slice(0, 80), texto: String(texto).slice(0, 400), link, em: Date.now(), lida: false }); }
    catch (e) { console.warn("notificação não enviada", e); }
  },

  // ---------- notificações do aparelho ----------
  suportado: () => "Notification" in window,
  ligadas: () => N.suportado() && Notification.permission === "granted" && ls.get("bc.notif", false),
  /** Este aparelho recebe aviso mesmo com o app fechado? (depende do serviço de avisos estar ligado) */
  pushLigado: () => N.ligadas() && !!ls.get("bc.push", ""),
  async ligar() {
    if (!N.suportado()) return false;
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    ls.set("bc.notif", p === "granted");
    if (p === "granted") registraPush();
    return p === "granted";
  },
  desligar() { ls.set("bc.notif", false); removePush(); },

  atualizaBadges() {
    const n = N.naoLidas();
    const b = $("#btnSino .badge");
    if (b) { b.hidden = !n; b.textContent = n > 9 ? "9+" : n; }
    const sino = $("#btnSino"); if (sino) sino.setAttribute("aria-label", n ? `Notificações (${n} novas)` : "Notificações");
    $$('#abas a[href="#/dono/pedidos"] .badge').forEach(x => { const k = (fontes.pedidos || []).length; x.hidden = !k; x.textContent = k; });
    $$('#abas a[href="#/shop"] .badge').forEach(x => { const k = S.carrinho.reduce((s, i) => s + i.qtd, 0); x.hidden = !k; x.textContent = k; });
  }
};

const chaveVistos = () => "bc.notif.vistos." + (D.usuario ? D.usuario.uid : "");

function define(fonte, lista) {
  fontes[fonte] = lista;
  const novaCarga = !primeiraCarga.has(fonte);
  primeiraCarga.add(fonte);
  recalcula(novaCarga ? null : fonte);
}

function recalcula(fonteNova) {
  const vistos = new Set(ls.get(chaveVistos(), []));
  const todos = Object.entries(fontes).flatMap(([f, l]) => l.map(i => ({ ...i, fonte: i.fonte || f, lida: i.fonte === "msg" ? i.lida : vistos.has(i.chave) })));
  todos.sort((a, b) => (b.em || 0) - (a.em || 0));
  N.itens = todos;
  N.atualizaBadges();
  // avisa no aparelho só o que chegou agora (não o que já existia ao abrir) — e uma vez só
  for (const i of todos) {
    if (i.lida || jaAvisados.has(i.chave)) continue;
    jaAvisados.add(i.chave);
    if (fonteNova || i.lembrete) mostraNoAparelho(i);
  }
  ls.set("bc.notif.avisados", [...jaAvisados].slice(-300));
  S.avisar("notificacoes");
}

async function mostraNoAparelho(i) {
  if (!N.ligadas()) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const op = { body: i.texto, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: i.chave, data: { link: i.link || "" } };
    if (reg) await reg.showNotification(i.titulo, op); else new Notification(i.titulo, op);
  } catch (e) { console.warn(e); }
}

/** Refaz uma conta a cada minuto (lembretes e relatórios dependem da hora, não de mudança no banco). */
function aCadaMinuto(fn) { const t = setInterval(fn, 60000); paradas.push(() => clearInterval(t)); }

// ---------- aviso com o app fechado (push) ----------
// Só funciona com o Firebase ligado e a chave em firebase-config.js (window.PUSH_VAPID_KEY).
// O aparelho ganha um "endereço" (token) que fica em push/<uid>; o serviço de avisos usa esse endereço.
async function registraPush() {
  const chave = window.PUSH_VAPID_KEY;
  if (!chave || D.modo !== "nuvem" || !D.usuario) return;
  try {
    const token = await D.tokenPush(chave);
    if (!token) return;
    const uid = D.usuario.uid;
    const atual = await D.pegar("push", uid).catch(() => null);
    const tokens = [token, ...((atual && atual.tokens) || []).filter(t => t !== token)].slice(0, 5);
    await D.salvar("push", uid, { tokens, atualizadoEm: Date.now() }, false);
    ls.set("bc.push", token);
  } catch (e) { console.warn("push não registrado", e); }
}
async function removePush() {
  const token = ls.get("bc.push", ""); ls.del("bc.push");
  if (!token || D.modo !== "nuvem" || !D.usuario) return;
  try {
    const atual = await D.pegar("push", D.usuario.uid);
    if (atual) await D.salvar("push", D.usuario.uid, { tokens: (atual.tokens || []).filter(t => t !== token), atualizadoEm: Date.now() }, false);
  } catch (e) { console.warn(e); }
}

// ---------- Cliente ----------
function iniciaCliente(u) {
  let meus = [], espera = [], bloqs = {}, paradasVaga = [];

  paradas.push(D.ouvir(`notificacoes/${u.uid}/itens`, [], l => define("msg", l.map(m => ({ ...m, chave: "msg_" + m.id, fonte: "msg" })))));
  const avisos = () => {
    const desde = (S.perfil && S.perfil.criadoEm) || 0;
    define("avisos", S.avisos.filter(a => (a.em || 0) >= desde - 86400000 * 7 && (!a.ate || a.ate >= hoje())).map(a => ({ chave: "aviso_" + a.id, titulo: a.titulo, texto: a.texto, em: a.em, link: "inicio", tipo: "aviso" })));
    const nasc = S.perfil && S.perfil.nascimento;
    const aniv = nasc && nasc.slice(5) === hoje().slice(5);
    define("aniv", aniv ? [{ chave: "aniv_" + hoje(), titulo: "Feliz aniversário! 🎉", texto: (S.loja && S.loja.cupomAniversario) || "A Barbearia Rodrigues deseja um ótimo dia!", em: Date.now() - 1000, link: "agendar", tipo: "aniversario", lembrete: true }] : []);
  };

  // lembretes: véspera, dia e "faltam 2 horas" (com o prazo para cancelar)
  const lembretes = () => {
    const h = hoje(), am = somaDias(h, 1), agora = Date.now(), antes = lembreteMin() * 60000;
    const ativos = meus.filter(a => ATIVOS.includes(a.status));
    const l = ativos.filter(a => a.data === h || a.data === am).map(a => ({
      chave: `lembrete_${a.id}_${a.data === h ? "hoje" : "amanha"}`, titulo: `${quando(a.data)} tem barbearia às ${a.inicio}`,
      texto: `${(a.servicos || []).map(s => s.nome).join(" + ")} com ${a.profissionalNome || "a equipe"}.`,
      em: agora - (a.data === h ? 60000 : 120000), link: "horarios", tipo: "lembrete", lembrete: true
    }));
    if (antes) for (const a of ativos) {
      const t = dataHora(a).getTime();
      if (t <= agora || t - agora > antes) continue;
      l.push({
        chave: `lembrete_${a.id}_perto`, titulo: `Seu horário é às ${a.inicio}`,
        texto: podeCancelar(a) ? `Com ${a.profissionalNome || "a equipe"}. Se não puder vir, cancele pelo app até as ${limiteCancelar(a)} para liberar o horário.` : `Com ${a.profissionalNome || "a equipe"}. Te esperamos!`,
        em: agora, link: "horarios", tipo: "lembrete", lembrete: true
      });
    }
    define("lembretes", l);
  };

  // fidelidade: avisa quando completa o cartão
  const pontos = () => {
    const f = fidelidade(S.loja, meus);
    define("fidelidade", f && f.disponiveis ? [{ chave: `fidelidade_${f.usados}`, titulo: "Você completou o cartão fidelidade! 🎁", texto: `Seu prêmio: ${f.premio}. É só avisar o barbeiro no próximo atendimento.`, em: Date.now() - 2000, link: "horarios", tipo: "fidelidade", lembrete: true }] : []);
  };

  // lista de espera: avisa quando o horário que a pessoa queria fica livre
  const vagas = () => {
    const l = [];
    for (const e of espera) {
      const oc = bloqs[e.data];
      if (!oc || !vagaAberta(e, oc)) continue;
      l.push({ chave: `vaga_${e.id}`, titulo: `Abriu o horário das ${e.hora}!`, texto: `${quando(e.data)} às ${e.hora}: o horário que você queria ficou livre. Toque para marcar antes que alguém pegue.`, em: Date.now(), link: `agendar?vaga=${encodeURIComponent(e.id)}`, tipo: "vaga", lembrete: true });
    }
    define("vagas", l);
  };
  const ouveVagas = () => {
    paradasVaga.forEach(f => f()); paradasVaga = []; bloqs = {};
    const dias = [...new Set(espera.map(e => e.data))].slice(0, 7);
    for (const d of dias) paradasVaga.push(D.ouvir("bloqueios", [["data", "==", d]], l => { bloqs[d] = conjunto(l); vagas(); }));
    vagas();
  };
  paradas.push(() => paradasVaga.forEach(f => f()));

  paradas.push(S.ao(q => { if (q === "avisos" || q === "perfil" || q === "loja") { avisos(); lembretes(); pontos(); } if (q === "profissionais" || q === "loja") vagas(); }));
  avisos();
  paradas.push(D.ouvir("agendamentos", [["uid", "==", u.uid]], l => { meus = l; lembretes(); pontos(); }));
  paradas.push(D.ouvir("espera", [["uid", "==", u.uid]], l => {
    const agora = Date.now();
    const antes = espera.map(e => e.data).sort().join();
    espera = l.filter(e => dataHora({ data: e.data, inicio: e.hora }).getTime() > agora);
    l.filter(e => !espera.includes(e)).forEach(e => D.apagar("espera", e.id).catch(() => { }));   // limpa o que já passou
    if (espera.map(e => e.data).sort().join() !== antes) ouveVagas(); else vagas();
  }, () => { }));
  aCadaMinuto(() => { lembretes(); vagas(); });
}

// ---------- Equipe (dono e barbeiros) ----------
function iniciaEquipe() {
  let futuros = [], espera = [];
  const meu = a => D.pode("agendaTodos") || !D.profId || a.profissional === D.profId;

  const agenda = () => {
    const h = hoje(), agora = Date.now();
    const meusAgs = futuros.filter(meu);
    // pedidos de horário aguardando confirmação
    define("agenda", meusAgs.filter(a => a.status === "marcado").map(a => ({
      chave: "novo_" + a.id, titulo: `Novo horário: ${a.clienteNome || "cliente"}`,
      texto: `${quando(a.data)} às ${a.inicio} · ${(a.servicos || []).map(s => s.nome).join(" + ")} com ${a.profissionalNome || "—"}`,
      em: a.criadoEm, link: "dono/agenda?data=" + a.data, tipo: "agenda"
    })));
    // cancelamentos feitos pelo cliente: o horário vagou; quem está na lista de espera?
    define("cancelados", meusAgs.filter(a => a.status === "cancelado" && a.canceladoPor === "cliente" && !a.remarcadoPara && dataHora(a).getTime() > agora).map(a => {
      const n = interessadosNaVaga(espera, a).length;
      return {
        chave: "cancelou_" + a.id, titulo: `${a.clienteNome || "Cliente"} cancelou: ${quando(a.data).toLowerCase()} às ${a.inicio}`,
        texto: n ? `${n} ${n === 1 ? "pessoa está" : "pessoas estão"} na lista de espera desse horário. Toque para avisar.` : "O horário voltou a ficar livre. Ninguém na lista de espera dele.",
        em: a.atualizadoEm || agora, link: `dono/agenda?data=${a.data}&vaga=${encodeURIComponent(a.id)}`, tipo: "cancelado"
      };
    }));
    // relatórios prontos
    const l = [];
    if (D.pode("caixa")) {
      const doDia = futuros.filter(a => a.data === h && (D.pode("caixaGeral") || !D.profId || a.profissional === D.profId));
      const fim = diaEncerrado(doDia);
      if (fim) l.push({ chave: "fech_dia_" + h, titulo: "Relatório do dia pronto", texto: "Último atendimento do dia concluído. Veja o que entrou, o que saiu e as comissões.", em: agora - 1000, link: `dono/caixa?tipo=dia&data=${h}`, tipo: "relatorio" });
      if (D.pode("caixaGeral")) for (const f of fechamentosProntos(new Date(), fim)) {
        const p = periodo(f.tipo, f.ref);
        l.push({ chave: `fech_${f.tipo}_${f.ref}`, titulo: f.tipo === "semana" ? "Relatório da semana pronto" : "Relatório do mês pronto", texto: p.titulo + ". Toque para ver o fechamento.", em: f.em, link: `dono/caixa?tipo=${f.tipo}&data=${f.ref}`, tipo: "relatorio" });
      }
    }
    define("relatorios", l);
  };

  paradas.push(D.ouvir("agendamentos", [["data", ">=", hoje()]], l => { futuros = l; agenda(); }, () => { }));
  paradas.push(D.ouvir("espera", [["data", ">=", hoje()]], l => { espera = l; agenda(); }, () => { }));
  aCadaMinuto(agenda);

  if (D.pode("pedidos")) paradas.push(D.ouvir("pedidos", [["status", "==", "novo"]], l => define("pedidos", l.map(p => ({
    chave: "pedido_" + p.id, titulo: `Reserva no shop: ${p.clienteNome || "cliente"}`,
    texto: p.itens.map(i => `${i.qtd}× ${i.nome}`).join(", "), em: p.criadoEm, link: "dono/pedidos", tipo: "pedido"
  }))), () => { }));
  if (D.pode("estoque")) paradas.push(D.ouvir("estoque", [], l => define("estoque", l.filter(e => Number(e.quantidade) <= Number(e.minimo || 0)).map(e => {
    const p = S.produto(e.id);
    return { chave: `estoque_${e.id}_${e.quantidade}`, titulo: Number(e.quantidade) <= 0 ? `Acabou: ${p ? p.nome : "produto"}` : `Estoque baixo: ${p ? p.nome : "produto"}`, texto: `Restam ${e.quantidade} (mínimo ${e.minimo}).`, em: e.atualizadoEm, link: "dono/estoque", tipo: "estoque" };
  })), () => { }));
}
