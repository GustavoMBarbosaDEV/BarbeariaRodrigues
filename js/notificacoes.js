// =====================================================================
//  Notificações
//  Juntam num só lugar (o sininho):
//   Cliente: mensagens da barbearia (confirmação, cancelamento, pedido pronto),
//            avisos/promoções, lembrete do horário de hoje/amanhã e aniversário.
//   Dono:    pedidos de horário novos, reservas do shop e estoque baixo.
//  Se a pessoa permitir, também aparecem como notificação do celular/computador
//  enquanto o app estiver aberto ou em segundo plano.
// =====================================================================
import { D } from "./dados.js";
import { S } from "./estado.js";
import { $, $$, ls, hoje, somaDias, quando } from "./util.js";

let paradas = [];
let fontes = {};          // nome -> lista de itens
let primeiraCarga = new Set();
let jaAvisados = new Set(ls.get("br.notif.avisados", []));

export const N = {
  itens: [],

  iniciar(u) {
    paradas.forEach(f => f()); paradas = []; fontes = {}; primeiraCarga = new Set(); N.itens = [];
    N.atualizaBadges();
    if (!u) return;
    if (D.ehDono) iniciaDono(); else iniciaCliente(u);
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

  /** O dono manda uma mensagem para um cliente (aparece no sininho dele). */
  async enviar(uidCliente, titulo, texto, link = "horarios") {
    if (!uidCliente || uidCliente.startsWith("ex") && D.modo === "demo") return;
    try { await D.criar(`notificacoes/${uidCliente}/itens`, { titulo, texto, link, em: Date.now(), lida: false }); }
    catch (e) { console.warn("notificação não enviada", e); }
  },

  // ---------- notificações do aparelho ----------
  suportado: () => "Notification" in window,
  ligadas: () => N.suportado() && Notification.permission === "granted" && ls.get("br.notif", false),
  async ligar() {
    if (!N.suportado()) return false;
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    ls.set("br.notif", p === "granted");
    return p === "granted";
  },
  desligar() { ls.set("br.notif", false); },

  atualizaBadges() {
    const n = N.naoLidas();
    const b = $("#btnSino .badge");
    if (b) { b.hidden = !n; b.textContent = n > 9 ? "9+" : n; }
    const sino = $("#btnSino"); if (sino) sino.setAttribute("aria-label", n ? `Notificações (${n} novas)` : "Notificações");
    $$('#abas a[href="#/dono/pedidos"] .badge').forEach(x => { const k = (fontes.pedidos || []).length; x.hidden = !k; x.textContent = k; });
    $$('#abas a[href="#/shop"] .badge').forEach(x => { const k = S.carrinho.reduce((s, i) => s + i.qtd, 0); x.hidden = !k; x.textContent = k; });
  }
};

const chaveVistos = () => "br.notif.vistos." + (D.usuario ? D.usuario.uid : "");

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
  ls.set("br.notif.avisados", [...jaAvisados].slice(-300));
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

// ---------- Cliente ----------
function iniciaCliente(u) {
  paradas.push(D.ouvir(`notificacoes/${u.uid}/itens`, [], l => define("msg", l.map(m => ({ ...m, chave: "msg_" + m.id, fonte: "msg" })))));
  const avisos = () => {
    const desde = (S.perfil && S.perfil.criadoEm) || 0;
    define("avisos", S.avisos.filter(a => (a.em || 0) >= desde - 86400000 * 7 && (!a.ate || a.ate >= hoje())).map(a => ({ chave: "aviso_" + a.id, titulo: a.titulo, texto: a.texto, em: a.em, link: "inicio", tipo: "aviso" })));
    const nasc = S.perfil && S.perfil.nascimento;
    const aniv = nasc && nasc.slice(5) === hoje().slice(5);
    define("aniv", aniv ? [{ chave: "aniv_" + hoje(), titulo: "Feliz aniversário! 🎉", texto: (S.loja && S.loja.cupomAniversario) || "A Barbearia Rodrigues deseja um ótimo dia!", em: Date.now() - 1000, link: "agendar", tipo: "aniversario", lembrete: true }] : []);
  };
  paradas.push(S.ao(q => { if (q === "avisos" || q === "perfil" || q === "loja") avisos(); }));
  avisos();
  paradas.push(D.ouvir("agendamentos", [["uid", "==", u.uid]], l => {
    const h = hoje(), am = somaDias(h, 1);
    define("lembretes", l.filter(a => ["marcado", "confirmado"].includes(a.status) && (a.data === h || a.data === am)).map(a => ({
      chave: `lembrete_${a.id}_${a.data === h ? "hoje" : "amanha"}`, titulo: `${quando(a.data)} tem barbearia às ${a.inicio}`,
      texto: `${(a.servicos || []).map(s => s.nome).join(" + ")} com ${a.profissionalNome || "a equipe"}.`,
      em: Date.now() - (a.data === h ? 0 : 60000), link: "horarios", tipo: "lembrete", lembrete: true
    })));
  }));
}

// ---------- Dono ----------
function iniciaDono() {
  paradas.push(D.ouvir("agendamentos", [["status", "==", "marcado"]], l => define("agenda", l.filter(a => a.data >= hoje()).map(a => ({
    chave: "novo_" + a.id, titulo: `Novo horário: ${a.clienteNome || "cliente"}`,
    texto: `${quando(a.data)} às ${a.inicio} · ${(a.servicos || []).map(s => s.nome).join(" + ")} com ${a.profissionalNome || "—"}`,
    em: a.criadoEm, link: "dono/agenda?data=" + a.data, tipo: "agenda"
  })))));
  paradas.push(D.ouvir("pedidos", [["status", "==", "novo"]], l => define("pedidos", l.map(p => ({
    chave: "pedido_" + p.id, titulo: `Reserva no shop: ${p.clienteNome || "cliente"}`,
    texto: p.itens.map(i => `${i.qtd}× ${i.nome}`).join(", "), em: p.criadoEm, link: "dono/pedidos", tipo: "pedido"
  })))));
  paradas.push(D.ouvir("estoque", [], l => define("estoque", l.filter(e => Number(e.quantidade) <= Number(e.minimo || 0)).map(e => {
    const p = S.produto(e.id);
    return { chave: `estoque_${e.id}_${e.quantidade}`, titulo: Number(e.quantidade) <= 0 ? `Acabou: ${p ? p.nome : "produto"}` : `Estoque baixo: ${p ? p.nome : "produto"}`, texto: `Restam ${e.quantidade} (mínimo ${e.minimo}).`, em: e.atualizadoEm, link: "dono/estoque", tipo: "estoque" };
  }))));
}
