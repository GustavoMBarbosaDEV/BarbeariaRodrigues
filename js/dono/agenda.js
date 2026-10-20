// =====================================================================
//  Agenda do dono: dia a dia por profissional, confirmar/concluir/faltou,
//  encaixar cliente, bloquear horário e lista do que aguarda confirmação.
// =====================================================================
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, toast, abreModal, confirma, hoje, somaDias, dataLonga, quando, min, hhmm, avatar, linkWhats, foneFormata, normaliza, soDigitos, cpfOculto, duracao, cpfFormata, cpfValido } from "../util.js";
import { STATUS, ATIVOS, liberar, reservar, livres, ocupadosDoDia, bloquearPeriodo, desbloquear, profsAtivos, expediente } from "../agenda.js";
import { N } from "../notificacoes.js";
import { precoServ, categorias } from "../ui.js";

export function tela(el, rota) {
  let dia = rota.q.get("data") || hoje();
  let filtroProf = "";
  let ags = [], bloqs = [], pendentes = [];
  let paradasDia = [];
  const paradas = [];

  function ouveDia() {
    paradasDia.forEach(f => f());
    paradasDia = [
      D.ouvir("agendamentos", [["data", "==", dia]], l => { ags = l; desenha(); }),
      D.ouvir("bloqueios", [["data", "==", dia]], l => { bloqs = l.filter(b => !b.ag); desenha(); })
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
        <small><span class="pill ${STATUS[a.status]?.c || ""}">${STATUS[a.status]?.t || a.status}</span>${a.obs ? ` “${esc(a.obs)}”` : ""}</small></span></button>` })),
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
    const pend = pendentes.filter(a => a.data >= hoje()).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    el.innerHTML = `
      <div class="titulo-tela"><div><h1>Agenda</h1><p>${D.modo === "demo" ? "Demonstração com clientes de exemplo." : "Toque num horário para confirmar, concluir ou falar com o cliente."}</p></div>
        <div class="botoes"><button class="btn mini sec" id="bloquear">${icone("cadeado")} Bloquear</button><button class="btn mini" id="novo">${icone("mais")} Novo horário</button></div></div>
      ${pend.length ? `<div class="faixa alerta" style="margin-bottom:14px">${icone("alerta")}<div style="flex:1;min-width:0"><strong>${pend.length} ${pend.length === 1 ? "horário aguarda" : "horários aguardam"} confirmação</strong>
        <div class="lista" style="margin-top:10px">${pend.slice(0, 5).map(a => `<div class="item"><div class="meio"><strong>${esc(a.clienteNome)}</strong><small>${esc(quando(a.data))} ${a.inicio} · ${esc((a.servicos || []).map(s => s.nome).join(" + "))} · ${esc(a.profissionalNome)}</small></div><div class="lado"><button class="btn mini ok" data-conf="${a.id}">${icone("check")} Confirmar</button></div></div>`).join("")}</div>
        ${pend.length > 5 ? `<p class="pequeno" style="margin-top:6px">e mais ${pend.length - 5}…</p>` : ""}</div></div>` : ""}
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
        <div class="kpi ouro"><small>Previsto no dia</small><b>${reais(previsto)}</b></div>
        <div class="kpi"><small>Já concluído</small><b>${reais(feito)}</b></div>
      </div>
      ${profsAtivos().length > 1 ? `<div class="chips" style="margin-bottom:12px"><button class="chip ${!filtroProf ? "ativo" : ""}" data-f="">Todos</button>${profsAtivos().map(p => `<button class="chip ${filtroProf === p.id ? "ativo" : ""}" data-f="${esc(p.id)}">${esc(p.nome)}</button>`).join("")}</div>` : ""}
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
  }

  // ---------- ações ----------
  const MSG = {
    confirmado: a => ["Horário confirmado ✔", `${quando(a.data)} às ${a.inicio} com ${a.profissionalNome}. Te esperamos!`],
    cancelado: a => ["Horário cancelado", `Seu horário de ${quando(a.data).toLowerCase()} às ${a.inicio} foi cancelado pela barbearia. Toque para marcar outro.`],
    concluido: () => ["Obrigado pela visita!", "Conta pra gente como foi: avalie seu atendimento."],
    faltou: a => ["Sentimos sua falta", `Você não compareceu ao horário de ${quando(a.data).toLowerCase()} às ${a.inicio}. Quer marcar outro?`]
  };
  async function muda(a, status) {
    try {
      if (status === "cancelado") await liberar(a, "cancelado", { canceladoPor: "barbearia" });
      else await D.salvar("agendamentos", a.id, { status, atualizadoEm: Date.now() });
      const m = MSG[status]?.(a);
      if (m) N.enviar(a.uid, m[0], m[1], status === "cancelado" || status === "faltou" ? "agendar" : "horarios");
      toast(STATUS[status].t, "ok");
    } catch (e) { toast(traduzErro(e), "erro"); }
  }

  function detalhe(a) {
    const loja = S.loja || {};
    const tel = a.clienteTelefone;
    const lembrete = `Olá, ${(a.clienteNome || "").split(" ")[0]}! Passando para lembrar do seu horário na ${loja.nome || "Barbearia Rodrigues"}: ${quando(a.data).toLowerCase()} às ${a.inicio} com ${a.profissionalNome}. Até lá!`;
    const fecha = abreModal({
      titulo: a.clienteNome || "Agendamento",
      corpo: `<div class="confirma-card">
        <div class="linha">${icone("calendario")}<div><strong>${esc(dataLonga(a.data))}</strong><div class="muted">${a.inicio}–${a.fim} · ${duracao(a.duracao)} · ${esc(a.profissionalNome)}</div></div></div>
        <div class="linha">${icone("tesoura")}<div style="flex:1">${(a.servicos || []).map(s => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(s.nome)}</span><span class="preco">${reais(s.preco)}</span></div>`).join("")}</div></div>
        ${a.obs ? `<div class="linha">${icone("lapis")}<div class="muted">“${esc(a.obs)}”</div></div>` : ""}
        <div class="linha">${icone("usuario")}<div><span class="pill ${STATUS[a.status]?.c}">${STATUS[a.status]?.t}</span>${tel ? `<div class="muted" style="margin-top:4px">${esc(foneFormata(tel))}</div>` : ""}<div class="muted pequeno">Marcado ${a.origem === "balcao" ? "pela barbearia" : "pelo app"}</div></div></div>
        <div class="total"><span>Total</span><b class="preco">${reais(a.total)}</b></div>
      </div>
      <div class="botoes" style="margin-top:16px">
        ${a.status === "marcado" ? `<button class="btn ok" data-s="confirmado">${icone("check")} Confirmar</button>` : ""}
        ${ATIVOS.includes(a.status) ? `<button class="btn" data-s="concluido">Concluir atendimento</button>` : ""}
        ${tel ? `<a class="btn whats" target="_blank" rel="noopener" href="${linkWhats(tel, lembrete)}">${icone("whats")} Lembrar no WhatsApp</a>` : ""}
        <a class="btn sec" href="#/dono/cliente/${encodeURIComponent(a.uid)}">${icone("usuario")} Ficha do cliente</a>
        ${ATIVOS.includes(a.status) ? `<button class="btn fantasma" data-s="faltou">Não compareceu</button><button class="btn fantasma" data-s="cancelado" style="color:var(--perigo)!important">Cancelar</button>` : ""}
        ${a.status === "concluido" || a.status === "faltou" ? `<button class="btn fantasma" data-s="confirmado">Desfazer (voltar para confirmado)</button>` : ""}
      </div>`,
      aoAbrir: (m, f) => m.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", async () => {
        const s = b.dataset.s;
        if (s === "cancelado" && !await confirma("Cancelar este horário?", "O cliente recebe um aviso no app e o horário fica livre.", "Cancelar horário", true)) return;
        f(); muda(a, s);
      }))
    });
    void fecha;
  }

  // ---------- novo horário (balcão / telefone) ----------
  async function novo(profPadrao) {
    const clientes = await D.listar("clientes").catch(() => []);
    const st = { cliente: null, sel: [], prof: profPadrao || (profsAtivos()[0] || {}).id, data: dia, hora: "", slots: [] };
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
        <label class="campo"><span>Profissional</span><select id="prof">${profsAtivos().map(p => `<option value="${esc(p.id)}" ${p.id === st.prof ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
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
        <label class="campo"><span>Profissional</span><select id="bp"><option value="*">Todos</option>${profsAtivos().map(p => `<option value="${esc(p.id)}" ${filtroProf === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
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
