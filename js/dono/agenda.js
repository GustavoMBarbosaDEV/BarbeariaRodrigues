// =====================================================================
//  Agenda da equipe: dia a dia por profissional, confirmar/concluir (com a forma
//  de pagamento)/faltou, encaixar cliente, bloquear horário, lista do que aguarda
//  confirmação e lista de espera (avisar quem queria um horário que vagou).
//  O barbeiro vê a agenda do dia inteira, mas só mexe nos próprios horários
//  (a não ser que o dono libere "mexer na agenda dos colegas").
// =====================================================================
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, toast, abreModal, confirma, hoje, somaDias, dataLonga, quando, min, hhmm, avatar, linkWhats, foneFormata, normaliza, soDigitos, cpfOculto, duracao, cpfFormata, cpfValido } from "../util.js";
import { STATUS, ATIVOS, liberar, reservar, livres, ocupadosDoDia, bloquearPeriodo, desbloquear, profsAtivos, expediente, interessadosNaVaga, vagaAberta, conjunto, dataHora } from "../agenda.js";
import { N } from "../notificacoes.js";
import { precoServ, categorias } from "../ui.js";
import { comissaoSobre, fidelidade, nomeForma, valorPago } from "../caixa.js";
import { pedePagamento } from "./pagamento.js";
import { ir } from "../app.js";

export function tela(el, rota) {
  let dia = rota.q.get("data") || hoje();
  let abrirVaga = rota.q.get("vaga") || "";       // veio do aviso "fulano cancelou": abre a lista de espera daquele horário
  const todos = D.pode("agendaTodos");
  const podeMexer = a => todos || !D.profId || a.profissional === D.profId;
  const meusProfs = () => profsAtivos().filter(p => todos || !D.profId || p.id === D.profId);
  let filtroProf = todos ? "" : D.profId;
  let ags = [], bloqs = [], bloqsTodos = [], espera = [], pendentes = [];
  let paradasDia = [];
  const paradas = [];

  function ouveDia() {
    paradasDia.forEach(f => f());
    paradasDia = [
      D.ouvir("agendamentos", [["data", "==", dia]], l => {
        ags = l; desenha();
        if (abrirVaga) { const a = ags.find(x => x.id === abrirVaga); abrirVaga = ""; if (a) vaga(a); }
      }),
      D.ouvir("bloqueios", [["data", "==", dia]], l => { bloqsTodos = l; bloqs = l.filter(b => !b.ag); desenha(); }),
      D.ouvir("espera", [["data", "==", dia]], l => { espera = l; desenha(); }, () => { })
    ];
  }

  // agrupa blocos de 15 min seguidos num período só
  function periodosBloqueados(profId) {
    const l = bloqs.filter(b => b.profissional === profId).sort((a, b) => a.hora.localeCompare(b.hora));
    const r = [];
    for (const b of l) {
      const t = min(b.hora.slice(0, 2) + ":" + b.hora.slice(2));
      const u = r[r.length - 1];
      if (u && u.fim === t && u.motivo === b.motivo) { u.fim = t + 15; u.itens.push(b); }
      else r.push({ ini: t, fim: t + 15, motivo: b.motivo || "Bloqueado", itens: [b] });
    }
    return r;
  }

  function coluna(p) {
    const e = expediente(p, dia);
    const lista = ags.filter(a => a.profissional === p.id).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const bl = periodosBloqueados(p.id);
    const eventos = [
      ...lista.map(a => ({ t: min(a.inicio), html: `<button class="ag ${a.status}" data-ag="${a.id}">
        <span class="hora"><b>${a.inicio}</b><small>${a.fim || ""}</small></span>
        <span class="meio"><strong>${esc(a.clienteNome || "Cliente")}</strong><small>${esc((a.servicos || []).map(s => s.nome).join(" + "))} · ${reais(a.total)}</small>
        <small><span class="pill ${STATUS[a.status]?.c || ""}">${STATUS[a.status]?.t || a.status}</span>${a.status === "concluido" && a.pagamento ? ` ${esc(nomeForma(a.pagamento.forma))}` : ""}${a.obs ? ` “${esc(a.obs)}”` : ""}</small></span></button>` })),
      ...bl.map(b => ({ t: b.ini, html: `<button class="ag bloq" data-bl="${p.id}|${b.ini}"><span class="hora"><b>${hhmm(b.ini)}</b><small>${hhmm(b.fim)}</small></span><span class="meio"><strong>${esc(b.motivo)}</strong><small>Toque para liberar</small></span></button>` }))
    ].sort((a, b) => a.t - b.t);
    const ativosCount = lista.filter(a => ATIVOS.includes(a.status) || a.status === "concluido").length;
    return `<div class="agenda-col">
      <h3>${avatar(p.nome, p.foto, "p")} ${esc(p.nome)} <span class="muted pequeno">${e ? `${e.abre}–${e.fecha} · ${ativosCount} atend.` : "folga"}</span></h3>
      <div class="lista">${eventos.length ? eventos.map(x => x.html).join("") : `<div class="livre"><span>${e ? "Agenda livre" : "Não trabalha neste dia"}</span>${e ? `<button data-novo="${p.id}">+ encaixar</button>` : ""}</div>`}
      ${eventos.length && e ? `<div class="livre"><span></span><button data-novo="${p.id}">+ encaixar</button></div>` : ""}</div>
    </div>`;
  }

  function desenha() {
    const ps = profsAtivos().filter(p => !filtroProf || p.id === filtroProf);
    const validos = ags.filter(a => a.status !== "cancelado");
    const previsto = validos.filter(a => a.status !== "faltou").reduce((s, a) => s + Number(a.total || 0), 0);
    const feito = ags.filter(a => a.status === "concluido").reduce((s, a) => s + Number(a.total || 0), 0);
    const pend = pendentes.filter(a => a.data >= hoje() && podeMexer(a)).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    // horários que vagaram (cancelados, ainda no futuro) e têm gente na lista de espera
    const vagos = ags.filter(a => a.status === "cancelado" && dataHora(a).getTime() > Date.now() && podeMexer(a))
      .map(a => ({ a, n: interessadosNaVaga(espera, a).length })).filter(x => x.n).sort((x, y) => x.a.inicio.localeCompare(y.a.inicio));
    el.innerHTML = `
      <div class="titulo-tela"><div><h1>Agenda</h1><p>${D.modo === "demo" ? "Demonstração com clientes de exemplo." : "Toque num horário para confirmar, concluir ou falar com o cliente."}</p></div>
        <div class="botoes"><button class="btn mini sec" id="bloquear">${icone("cadeado")} Bloquear</button><button class="btn mini" id="novo">${icone("mais")} Novo horário</button></div></div>
      ${pend.length ? `<div class="faixa alerta" style="margin-bottom:14px">${icone("alerta")}<div style="flex:1;min-width:0"><strong>${pend.length} ${pend.length === 1 ? "horário aguarda" : "horários aguardam"} confirmação</strong>
        <div class="lista" style="margin-top:10px">${pend.slice(0, 5).map(a => `<div class="item"><div class="meio"><strong>${esc(a.clienteNome)}</strong><small>${esc(quando(a.data))} ${a.inicio} · ${esc((a.servicos || []).map(s => s.nome).join(" + "))} · ${esc(a.profissionalNome)}</small></div><div class="lado"><button class="btn mini ok" data-conf="${a.id}">${icone("check")} Confirmar</button></div></div>`).join("")}</div>
        ${pend.length > 5 ? `<p class="pequeno" style="margin-top:6px">e mais ${pend.length - 5}…</p>` : ""}</div></div>` : ""}
      ${vagos.length ? `<div class="faixa" style="margin-bottom:14px">${icone("relogio")}<div style="flex:1;min-width:0"><strong>${vagos.length === 1 ? "Um horário vagou e tem gente esperando" : "Horários vagaram e tem gente esperando"}</strong>
        <div class="lista" style="margin-top:10px">${vagos.map(({ a, n }) => `<div class="item"><div class="meio"><strong>${a.inicio} com ${esc(a.profissionalNome)}</strong><small>${n} na lista de espera · era de ${esc(a.clienteNome || "cliente")}</small></div><div class="lado"><button class="btn mini" data-vaga="${a.id}">Avisar</button></div></div>`).join("")}</div></div></div>` : ""}
      <div class="barra-dia">
        <button class="icone-btn" data-d="-1" aria-label="Dia anterior">${icone("voltar")}</button>
        <div class="meio"><strong>${esc(quando(dia))}</strong><small>${[hoje(), somaDias(hoje(), 1), somaDias(hoje(), -1)].includes(dia) ? esc(dataLonga(dia)) : ""}</small></div>
        ${dia !== hoje() ? `<button class="btn mini sec" id="hoje">Hoje</button>` : ""}
        <span class="icone-btn pick-data" title="Escolher dia">${icone("calendario")}<input type="date" id="pick" value="${dia}" aria-label="Escolher dia"></span>
        <button class="icone-btn" data-d="1" aria-label="Próximo dia">${icone("seta")}</button>
      </div>
      <div class="kpis" style="margin-bottom:14px">
        <div class="kpi"><small>Atendimentos</small><b>${validos.filter(a => a.status !== "faltou").length}</b></div>
        <div class="kpi"><small>Aguardando</small><b>${ags.filter(a => a.status === "marcado").length}</b></div>
        <div class="kpi destaque"><small>Previsto no dia</small><b>${reais(previsto)}</b></div>
        <div class="kpi"><small>Já concluído</small><b>${reais(feito)}</b></div>
      </div>
      ${profsAtivos().length > 1 ? `<div class="chips" style="margin-bottom:12px"><button class="chip ${!filtroProf ? "ativo" : ""}" data-f="">Todos</button>${profsAtivos().map(p => `<button class="chip ${filtroProf === p.id ? "ativo" : ""}" data-f="${esc(p.id)}">${esc(p.nome)}${p.id === D.profId ? " (você)" : ""}</button>`).join("")}</div>` : ""}
      ${espera.length ? `<p class="pequeno muted" style="margin:-4px 0 12px">${icone("relogio")} ${espera.length} ${espera.length === 1 ? "pessoa na lista de espera" : "pessoas na lista de espera"} deste dia. <button class="link" id="verEspera">Ver</button></p>` : ""}
      <div class="agenda-cols" style="--cols:${Math.min(ps.length, 3) || 1}">${ps.length ? ps.map(coluna).join("") : `<div class="card">Cadastre a equipe em Mais → Equipe.</div>`}</div>`;

    el.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => { dia = somaDias(dia, Number(b.dataset.d)); ouveDia(); desenha(); }));
    el.querySelector("#pick").addEventListener("change", e => { if (e.target.value) { dia = e.target.value; ouveDia(); desenha(); } });
    el.querySelector("#hoje")?.addEventListener("click", () => { dia = hoje(); ouveDia(); desenha(); });
    el.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => { filtroProf = b.dataset.f; desenha(); }));
    el.querySelectorAll("[data-ag]").forEach(b => b.addEventListener("click", () => detalhe(ags.find(a => a.id === b.dataset.ag))));
    el.querySelectorAll("[data-conf]").forEach(b => b.addEventListener("click", () => muda(pendentes.find(a => a.id === b.dataset.conf), "confirmado")));
    el.querySelectorAll("[data-bl]").forEach(b => b.addEventListener("click", async () => {
      const [p, ini] = b.dataset.bl.split("|");
      const per = periodosBloqueados(p).find(x => x.ini === Number(ini));
      if (per && await confirma("Liberar horário?", `${hhmm(per.ini)}–${hhmm(per.fim)} (${esc(per.motivo)}) volta a ficar disponível para agendamento.`, "Liberar")) {
        try { await desbloquear(per.itens); toast("Horário liberado.", "ok"); } catch (e) { toast(traduzErro(e), "erro"); }
      }
    }));
    el.querySelectorAll("[data-novo]").forEach(b => b.addEventListener("click", () => novo(b.dataset.novo)));
    el.querySelector("#novo").addEventListener("click", () => novo(filtroProf));
    el.querySelector("#bloquear").addEventListener("click", bloquear);
    el.querySelectorAll("[data-vaga]").forEach(b => b.addEventListener("click", () => vaga(ags.find(a => a.id === b.dataset.vaga))));
    el.querySelector("#verEspera")?.addEventListener("click", () => listaEspera(espera, `Lista de espera · ${quando(dia).toLowerCase()}`));
  }

  // ---------- lista de espera ----------
  /** Um horário vagou: mostra só quem marcou interesse nele, com um toque para avisar. */
  function vaga(a) { if (a) listaEspera(interessadosNaVaga(espera, a), `Vagou: ${a.inicio} com ${a.profissionalNome}`, true, a); }
  function listaEspera(l, titulo, vagou = false, liberado = null) {
    // os blocos do horário recém-cancelado podem ainda não ter sumido da tela: desconsidera-os
    const oc = conjunto(bloqsTodos.filter(b => !liberado || b.ag !== liberado.id)), loja = S.loja || {};
    const linkApp = e => location.origin + location.pathname + "#/agendar?vaga=" + encodeURIComponent(e.id);
    const texto = e => `Olá, ${(e.clienteNome || "").split(" ")[0]}! Abriu o horário de ${quando(e.data).toLowerCase()} às ${e.hora} na ${loja.nome || "Barbearia Rodrigues"}, que você queria. Para garantir, marque pelo app: ${linkApp(e)}`;
    const ordenada = [...l].sort((x, y) => (x.criadoEm || 0) - (y.criadoEm || 0));
    abreModal({
      titulo,
      corpo: ordenada.length ? `<p class="muted" style="margin-bottom:12px">${vagou ? "Só quem marcou interesse neste horário aparece aqui, por ordem de chegada. Quem ativou as notificações já é avisado pelo app; para os outros, mande pelo WhatsApp com um toque." : "Clientes que pediram para ser avisados se um horário ocupado vagar."}</p>
        <div class="lista">${ordenada.map(e => { const livre = !!vagaAberta(e, oc); return `<div class="item" style="flex-wrap:wrap">${avatar(e.clienteNome, "", "p")}
          <div class="meio"><strong>${esc(e.clienteNome || "Cliente")}</strong><small>quer ${e.hora}${e.profissional ? " com " + esc(S.profissional(e.profissional)?.nome || "") : ""} · ${livre ? '<span class="pill ok">horário livre</span>' : '<span class="pill">ainda ocupado</span>'}${e.avisadoEm ? ' <span class="pill info">avisado</span>' : ""}</small>
          <small>${e.push ? "Recebe o aviso pelo app" : "Sem notificação do app: avise pelo WhatsApp"}</small></div>
          <div class="lado" style="flex-direction:row">${e.clienteTelefone ? `<a class="btn mini whats" target="_blank" rel="noopener" data-zap="${esc(e.id)}" href="${linkWhats(e.clienteTelefone, texto(e))}">${icone("whats")} WhatsApp</a>` : ""}
          <button class="btn mini sec" data-app="${esc(e.id)}">${icone("sino")} App</button></div></div>`; }).join("")}</div>`
        : `<p class="muted">Ninguém marcou interesse neste horário. Ele voltou a aparecer como livre para quem abrir o app.</p>`,
      aoAbrir: m => {
        const marca = id => D.salvar("espera", id, { avisadoEm: Date.now() }).catch(() => { });
        m.querySelectorAll("[data-zap]").forEach(b => b.addEventListener("click", () => marca(b.dataset.zap)));
        m.querySelectorAll("[data-app]").forEach(b => b.addEventListener("click", async () => {
          const e = ordenada.find(x => x.id === b.dataset.app);
          b.disabled = true;
          await N.enviar(e.uid, `Abriu o horário das ${e.hora}!`, `${quando(e.data)} às ${e.hora}: o horário que você queria ficou livre. Toque para marcar.`, "agendar?vaga=" + encodeURIComponent(e.id));
          marca(e.id); toast("Aviso enviado no app.", "ok");
        }));
      }
    });
  }

  // ---------- ações ----------
  const MSG = {
    confirmado: a => ["Horário confirmado ✔", `${quando(a.data)} às ${a.inicio} com ${a.profissionalNome}. Te esperamos!`],
    cancelado: a => ["Horário cancelado", `Seu horário de ${quando(a.data).toLowerCase()} às ${a.inicio} foi cancelado pela barbearia. Toque para marcar outro.`],
    concluido: () => ["Obrigado pela visita!", "Conta pra gente como foi: avalie seu atendimento."],
    faltou: a => ["Sentimos sua falta", `Você não compareceu ao horário de ${quando(a.data).toLowerCase()} às ${a.inicio}. Quer marcar outro?`]
  };
  async function muda(a, status) {
    if (status === "concluido") return concluir(a);
    try {
      if (status === "cancelado") await liberar(a, "cancelado", { canceladoPor: "barbearia" });
      // desfazer um atendimento concluído apaga o pagamento e a comissão lançados
      else if (a.status === "concluido") await D.lote([
        { tipo: "salvar", c: "agendamentos", id: a.id, dados: { status, atualizadoEm: Date.now(), pagamento: null, premio: false } },
        { tipo: "apagar", c: "comissoes", id: a.id }
      ]);
      else await D.salvar("agendamentos", a.id, { status, atualizadoEm: Date.now() });
      const m = MSG[status]?.(a);
      if (m) N.enviar(a.uid, m[0], m[1], status === "cancelado" || status === "faltou" ? "agendar" : "horarios");
      toast(STATUS[status].t, "ok");
      if (status === "cancelado" && interessadosNaVaga(espera, a).length) vaga(a);   // vagou e tem gente esperando: pergunta se quer avisar
    } catch (e) { toast(traduzErro(e), "erro"); }
  }

  /** % de comissão de quem atendeu. O barbeiro só conhece a própria; o dono lê a de qualquer um. */
  async function pctDe(profId) {
    if (profId === D.profId) return D.comissao;
    if (!D.ehDono) return null;
    const e = await D.pegar("equipe", profId).catch(() => null);
    return Number(e && e.comissao) || 0;
  }

  /** Concluir = registrar como o cliente pagou. É daqui que saem o caixa, a comissão e a fidelidade. */
  async function concluir(a) {
    const pct = await pctDe(a.profissional);
    if (pct === null) return toast("Só o próprio barbeiro ou o dono conclui este atendimento (por causa da comissão).", "erro");
    const hist = await D.listar("agendamentos", [["uid", "==", a.uid]]).catch(() => []);
    const pg = await pedePagamento({ titulo: "Concluir atendimento", sub: `${a.clienteNome || "Cliente"} · ${(a.servicos || []).map(s => s.nome).join(" + ")}`, valor: a.total, fidel: fidelidade(S.loja, hist) });
    if (!pg) return;
    try {
      // O pagamento fica no agendamento (o cliente pode ver o que pagou). A comissão fica à parte,
      // em comissoes/<id>, que só o dono e o próprio barbeiro leem.
      await D.lote([
        { tipo: "salvar", c: "agendamentos", id: a.id, dados: { status: "concluido", atualizadoEm: Date.now(), concluidoEm: Date.now(), pagamento: { forma: pg.forma, valor: pg.valor, recebido: pg.recebido, troco: pg.troco, gorjeta: pg.gorjeta }, premio: pg.premio } },
        { tipo: "criar", c: "comissoes", id: a.id, dados: { profissional: a.profissional, data: a.data, base: pg.valor, pct, valor: comissaoSobre(pg.valor, pct), em: Date.now() } }
      ]);
      N.enviar(a.uid, ...MSG.concluido(), "horarios");
      toast(`Concluído · ${reais(pg.valor)} em ${nomeForma(pg.forma).toLowerCase()}${pg.troco ? ` · troco ${reais(pg.troco)}` : ""}${pg.gorjeta ? ` · gorjeta ${reais(pg.gorjeta)}` : ""}`, "ok");
      // foi o último horário do dia? Então o relatório do dia já está pronto.
      const meus = x => D.pode("caixaGeral") || !D.profId || x.profissional === D.profId;
      const sobrou = ags.some(x => x.id !== a.id && ATIVOS.includes(x.status) && meus(x));
      if (a.data === hoje() && !sobrou && D.pode("caixa")) abreModal({
        titulo: "Dia encerrado",
        corpo: `<p class="muted">Esse foi o último atendimento marcado para hoje. O relatório do dia está pronto: o que entrou, o que saiu, cancelamentos, horários preenchidos e comissões.</p>`,
        acoes: [{ t: "Agora não", cls: "sec" }, { t: "Ver relatório do dia", fn: () => { ir("dono/caixa?tipo=dia&data=" + a.data); } }]
      });
    } catch (e) { toast(traduzErro(e), "erro"); }
  }

  function detalhe(a) {
    const loja = S.loja || {};
    const tel = a.clienteTelefone, mexe = podeMexer(a);
    const lembrete = `Olá, ${(a.clienteNome || "").split(" ")[0]}! Passando para lembrar do seu horário na ${loja.nome || "Barbearia Rodrigues"}: ${quando(a.data).toLowerCase()} às ${a.inicio} com ${a.profissionalNome}. Até lá!`;
    const fecha = abreModal({
      titulo: a.clienteNome || "Agendamento",
      corpo: `<div class="confirma-card">
        <div class="linha">${icone("calendario")}<div><strong>${esc(dataLonga(a.data))}</strong><div class="muted">${a.inicio}–${a.fim} · ${duracao(a.duracao)} · ${esc(a.profissionalNome)}</div></div></div>
        <div class="linha">${icone("tesoura")}<div style="flex:1">${(a.servicos || []).map(s => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(s.nome)}</span><span class="preco">${reais(s.preco)}</span></div>`).join("")}</div></div>
        ${a.obs ? `<div class="linha">${icone("lapis")}<div class="muted">“${esc(a.obs)}”</div></div>` : ""}
        <div class="linha">${icone("usuario")}<div><span class="pill ${STATUS[a.status]?.c}">${STATUS[a.status]?.t}</span>${tel ? `<div class="muted" style="margin-top:4px">${esc(foneFormata(tel))}</div>` : ""}<div class="muted pequeno">Marcado ${a.origem === "balcao" ? "pela barbearia" : "pelo app"}</div></div></div>
        <div class="total"><span>${a.status === "concluido" && a.pagamento ? `Recebido · ${esc(nomeForma(a.pagamento.forma))}${a.premio ? " · prêmio fidelidade" : ""}` : "Total"}</span><b class="preco">${reais(a.status === "concluido" ? valorPago(a) : a.total)}</b></div>
        ${a.status === "concluido" && a.pagamento && (a.pagamento.troco || a.pagamento.gorjeta) ? `<p class="muted pequeno" style="margin-top:6px">Cliente entregou ${reais(a.pagamento.recebido)} · ${a.pagamento.gorjeta ? `gorjeta ${reais(a.pagamento.gorjeta)}` : `troco ${reais(a.pagamento.troco)}`}</p>` : ""}
      </div>
      ${mexe ? "" : `<p class="muted pequeno" style="margin-top:12px">Este horário é de outro barbeiro: você pode ver, mas só ele ou o dono altera.</p>`}
      <div class="botoes" style="margin-top:16px">
        ${mexe && a.status === "marcado" ? `<button class="btn ok" data-s="confirmado">${icone("check")} Confirmar</button>` : ""}
        ${mexe && ATIVOS.includes(a.status) ? `<button class="btn" data-s="concluido">${icone("dinheiro")} Concluir e receber</button>` : ""}
        ${mexe && tel ? `<a class="btn whats" target="_blank" rel="noopener" href="${linkWhats(tel, lembrete)}">${icone("whats")} Lembrar no WhatsApp</a>` : ""}
        ${D.pode("clientes") ? `<a class="btn sec" href="#/dono/cliente/${encodeURIComponent(a.uid)}">${icone("usuario")} Ficha do cliente</a>` : ""}
        ${mexe && ATIVOS.includes(a.status) ? `<button class="btn fantasma" data-s="faltou">Não compareceu</button><button class="btn fantasma" data-s="cancelado" style="color:var(--perigo)!important">Cancelar</button>` : ""}
        ${mexe && (a.status === "concluido" || a.status === "faltou") ? `<button class="btn fantasma" data-s="confirmado">Desfazer (voltar para confirmado)</button>` : ""}
        ${mexe && a.status === "cancelado" && dataHora(a).getTime() > Date.now() ? `<button class="btn sec" data-vg>${icone("relogio")} Lista de espera deste horário</button>` : ""}
      </div>`,
      aoAbrir: (m, f) => {
        m.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", async () => {
          const s = b.dataset.s;
          if (s === "cancelado" && !await confirma("Cancelar este horário?", "O cliente recebe um aviso no app e o horário fica livre.", "Cancelar horário", true)) return;
          f(); muda(a, s);
        }));
        m.querySelector("[data-vg]")?.addEventListener("click", () => { f(); vaga(a); });
      }
    });
    void fecha;
  }

  // ---------- novo horário (balcão / telefone) ----------
  async function novo(profPadrao) {
    const clientes = D.pode("clientes") ? await D.listar("clientes").catch(() => []) : [];   // sem a permissão, o barbeiro só cadastra na hora
    const st = { cliente: null, sel: [], prof: profPadrao || (meusProfs()[0] || {}).id, data: dia, hora: "", slots: [] };
    const dur = () => st.sel.reduce((s, id) => s + Number(S.servico(id)?.duracao || 0), 0);
    let modal;
    const calcula = async () => {
      if (!st.sel.length || !st.prof) { st.slots = []; return; }
      const oc = await ocupadosDoDia(st.data);
      st.slots = livres(st.data, [S.profissional(st.prof)].filter(Boolean), dur(), oc);
    };
    const corpo = () => `
      <label class="campo"><span>Cliente</span>
        ${st.cliente ? `<div class="item" style="padding:8px 0">${avatar(st.cliente.nome, "", "p")}<div class="meio"><strong>${esc(st.cliente.nome)}</strong><small>${esc(foneFormata(st.cliente.telefone || ""))} ${st.cliente.cpf ? "· " + cpfOculto(st.cliente.cpf) : ""}</small></div><button class="btn mini sec" type="button" id="trocaCli">Trocar</button></div>`
        : `<div class="busca">${icone("busca")}<input id="buscaCli" placeholder="Nome, CPF ou celular" autocomplete="off"></div><div id="resCli" class="lista" style="margin-top:8px;max-height:220px;overflow:auto" hidden></div>
           <button type="button" class="btn mini fantasma" id="semCadastro" style="margin-top:8px">${icone("mais")} Cliente sem cadastro</button>`}
      </label>
      <div class="campo"><span>Serviços</span><div class="lista" style="max-height:240px;overflow:auto">${categorias(S.servicos.filter(s => s.ativo !== false)).map(([c, l]) => l.map(s => `<div class="sel-serv ${st.sel.includes(s.id) ? "on" : ""}" data-s="${esc(s.id)}" role="checkbox" aria-checked="${st.sel.includes(s.id)}" tabindex="0"><span class="marca-sel">${icone("check")}</span><div class="meio"><strong>${esc(s.nome)}</strong><small>${esc(c)} · ${duracao(s.duracao)}</small></div><span class="preco">${precoServ(s)}</span></div>`).join("")).join("")}</div></div>
      <div class="linha2">
        <label class="campo"><span>Profissional</span><select id="prof">${meusProfs().map(p => `<option value="${esc(p.id)}" ${p.id === st.prof ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
        <label class="campo"><span>Dia</span><input type="date" id="data" value="${st.data}" min="${hoje()}"></label>
      </div>
      <div class="campo"><span>Horário ${st.sel.length ? `(${duracao(dur())})` : ""}</span>
        ${!st.sel.length ? `<small>Escolha os serviços para ver os horários livres.</small>` : st.slots.length ? `<div class="slots">${st.slots.map(s => `<button type="button" class="slot ${s.hora === st.hora ? "on" : ""}" data-h="${s.hora}">${s.hora}</button>`).join("")}</div>` : `<small>Sem horário livre neste dia para essa duração.</small>`}
        ${st.sel.length ? `<label class="check" style="margin-top:10px;align-items:center"><span style="flex:1">Encaixe em outro horário (fora da grade):</span><input type="time" id="horaLivre" step="300" value="${st.slots.some(s => s.hora === st.hora) ? "" : st.hora}" style="width:130px;min-height:40px"></label>` : ""}
      </div>`;
    const redesenha = async (recalc) => {
      if (recalc) { st.hora = ""; await calcula(); }
      const m = modal; if (!m) return;
      const y = m.querySelector(".modal-corpo").scrollTop;
      m.querySelector(".modal-corpo").innerHTML = corpo();
      m.querySelector(".modal-corpo").scrollTop = y;
      liga(m);
    };
    const liga = m => {
      const bc = m.querySelector("#buscaCli");
      if (bc) bc.addEventListener("input", () => {
        const t = normaliza(bc.value), d = soDigitos(bc.value);
        const r = m.querySelector("#resCli");
        const ach = t.length < 2 ? [] : clientes.filter(c => normaliza(c.nome).includes(t) || (d.length >= 3 && (soDigitos(c.cpf).includes(d) || soDigitos(c.telefone).includes(d)))).slice(0, 8);
        r.hidden = !ach.length;
        r.innerHTML = ach.map(c => `<button type="button" class="item" data-c="${esc(c.id)}">${avatar(c.nome, "", "p")}<div class="meio"><strong>${esc(c.nome)}</strong><small>${esc(foneFormata(c.telefone || ""))}</small></div></button>`).join("");
        r.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { st.cliente = clientes.find(c => c.id === b.dataset.c); redesenha(); }));
      });
      m.querySelector("#trocaCli")?.addEventListener("click", () => { st.cliente = null; redesenha(); });
      m.querySelector("#semCadastro")?.addEventListener("click", () => novoClienteRapido(c => { clientes.push(c); st.cliente = c; redesenha(); }));
      m.querySelectorAll("[data-s]").forEach(x => x.addEventListener("click", () => { const id = x.dataset.s; st.sel = st.sel.includes(id) ? st.sel.filter(i => i !== id) : [...st.sel, id]; redesenha(true); }));
      m.querySelector("#prof").addEventListener("change", e => { st.prof = e.target.value; redesenha(true); });
      m.querySelector("#data").addEventListener("change", e => { st.data = e.target.value; redesenha(true); });
      m.querySelectorAll("[data-h]").forEach(b => b.addEventListener("click", () => { st.hora = b.dataset.h; redesenha(); }));
      m.querySelector("#horaLivre")?.addEventListener("change", e => { st.hora = e.target.value; m.querySelectorAll(".slot.on").forEach(x => x.classList.remove("on")); });
    };
    abreModal({
      titulo: "Novo horário", largo: true, corpo: corpo(),
      aoAbrir: m => { modal = m; liga(m); },
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Agendar", fn: async () => {
          if (!st.cliente) { toast("Escolha o cliente.", "erro"); return false; }
          if (!st.sel.length || !st.hora) { toast("Escolha os serviços e o horário.", "erro"); return false; }
          try {
            await reservar({
              uid: st.cliente.id, clienteNome: st.cliente.nome, clienteTelefone: st.cliente.telefone || "",
              servicos: st.sel.map(id => { const s = S.servico(id); return { id, nome: s.nome, preco: Number(s.preco), duracao: Number(s.duracao) }; }),
              profissional: st.prof, data: st.data, inicio: st.hora, status: "confirmado", origem: "balcao"
            });
            N.enviar(st.cliente.id, "Horário marcado pela barbearia", `${quando(st.data)} às ${st.hora} com ${S.profissional(st.prof)?.nome || ""}.`);
            toast("Horário agendado!", "ok");
            if (st.data !== dia) { dia = st.data; ouveDia(); }
          } catch (e) { toast(traduzErro(e), "erro"); await redesenha(true); return false; }
        }
      }]
    });
  }

  function bloquear() {
    abreModal({
      titulo: "Bloquear horário",
      corpo: `<p class="muted" style="margin-bottom:12px">Folga, almoço, compromisso… Ninguém consegue marcar nesse período. Horários que já têm cliente não são mexidos.</p>
        <label class="campo"><span>Profissional</span><select id="bp">${todos || !D.profId ? '<option value="*">Todos</option>' : ""}${meusProfs().map(p => `<option value="${esc(p.id)}" ${filtroProf === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
        <label class="campo"><span>Dia</span><input type="date" id="bd" value="${dia}" min="${hoje()}"></label>
        <div class="linha2"><label class="campo"><span>Das</span><input type="time" id="bi" value="12:00" step="900"></label><label class="campo"><span>Até</span><input type="time" id="bf" value="13:00" step="900"></label></div>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" id="btodo"> <span>Dia inteiro</span></label>
        <label class="campo"><span>Motivo</span><input id="bm" maxlength="40" placeholder="Ex.: Folga, Curso, Médico" value="Bloqueado"></label>`,
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Bloquear", fn: async m => {
          const v = id => m.querySelector(id).value;
          const data = v("#bd");
          const alvos = v("#bp") === "*" ? profsAtivos() : [S.profissional(v("#bp"))];
          try {
            for (const p of alvos) {
              const e = expediente(p, data);
              const ini = m.querySelector("#btodo").checked ? (e ? e.abre : "00:00") : v("#bi");
              const fim = m.querySelector("#btodo").checked ? (e ? e.fecha : "23:45") : v("#bf");
              if (min(fim) <= min(ini)) { toast("O fim precisa ser depois do início.", "erro"); return false; }
              // arredonda para blocos de 15 min
              const r = t => hhmm(Math.floor(min(t) / 15) * 15);
              await bloquearPeriodo(p.id, data, r(ini), hhmm(Math.ceil(min(fim) / 15) * 15), v("#bm").trim() || "Bloqueado");
            }
            toast("Horário bloqueado.", "ok");
            if (data !== dia) { dia = data; ouveDia(); desenha(); }
          } catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  paradas.push(D.ouvir("agendamentos", [["status", "==", "marcado"]], l => { pendentes = l; desenha(); }));
  paradas.push(S.ao(q => (q === "profissionais" || q === "loja") && desenha()));
  ouveDia();
  desenha();
  return () => { paradas.forEach(f => f()); paradasDia.forEach(f => f()); };
}

/** Cadastro rápido de cliente sem conta no app (balcão / telefone). */
export function novoClienteRapido(pronto) {
  abreModal({
    titulo: "Cliente sem cadastro no app",
    corpo: `<p class="muted" style="margin-bottom:12px">Para quem marca por telefone ou chega na hora. CPF e nascimento são opcionais aqui.</p>
      <label class="campo"><span>Nome completo *</span><input id="nn" maxlength="120"></label>
      <label class="campo"><span>Celular</span><input id="nt" type="tel" inputmode="tel" maxlength="15"></label>
      <div class="linha2"><label class="campo"><span>CPF</span><input id="nc" inputmode="numeric" maxlength="14"></label><label class="campo"><span>Nascimento</span><input id="nd" type="date" max="${hoje()}"></label></div>`,
    aoAbrir: m => {
      m.querySelector("#nt").addEventListener("input", e => e.target.value = foneFormata(e.target.value));
      m.querySelector("#nc").addEventListener("input", e => e.target.value = cpfFormata(e.target.value));
    },
    acoes: [{ t: "Cancelar", cls: "sec" }, {
      t: "Salvar cliente", fn: async m => {
        const nome = m.querySelector("#nn").value.trim().replace(/\s+/g, " ");
        const cpf = soDigitos(m.querySelector("#nc").value);
        if (nome.length < 3) { toast("Digite o nome.", "erro"); return false; }
        if (cpf && !cpfValido(cpf)) { toast("CPF inválido.", "erro"); return false; }
        const dados = { nome, telefone: soDigitos(m.querySelector("#nt").value), cpf: cpf || "", nascimento: m.querySelector("#nd").value || "", email: "", manual: true, aceite: false, criadoEm: Date.now() };
        try {
          const id = D.novoId();
          const ops = [{ tipo: "criar", c: "clientes", id, dados }];
          if (cpf) ops.push({ tipo: "criar", c: "cpfs", id: cpf, dados: { uid: id } });
          await D.lote(ops);
          pronto({ id, ...dados });
        } catch (e) { toast(/permission|CPF_EM_USO/i.test(e.code || e.message) && cpf ? "Este CPF já está cadastrado." : traduzErro(e), "erro"); return false; }
      }
    }]
  });
}
