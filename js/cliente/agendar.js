// =====================================================================
//  Agendar: 1) serviços  2) profissional  3) dia e hora  4) confirmar
// =====================================================================
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, duracao, avatar, toast, DIAS_C, MESES, dataDe, dataLonga, min, linkWhats, vazio } from "../util.js";
import { categorias, precoServ } from "../ui.js";
import { livres, ocupadosDoDia, reservar, liberar, expediente, fazServico, profsAtivos, diasDisponiveis, arquivoCalendario } from "../agenda.js";

export function tela(el, rota) {
  const q = rota.q;
  const st = {
    passo: 1,
    sel: q.get("servico") ? [q.get("servico")] : [],
    prof: q.get("prof") || "",          // "" = sem preferência
    data: "", hora: "", obs: "",
    remarcar: q.get("remarcar") || "",
    antigo: null, feito: null, slots: null, carregando: false
  };
  if (st.sel.length) st.passo = 2;
  let paradaS;

  const servSel = () => st.sel.map(id => S.servico(id)).filter(Boolean);
  const durTotal = () => servSel().reduce((s, x) => s + Number(x.duracao || 0), 0);
  const precoTotal = () => servSel().reduce((s, x) => s + Number(x.preco || 0), 0);
  const candidatos = () => profsAtivos().filter(p => fazServico(p, st.sel) && (!st.prof || p.id === st.prof));

  const topo = (t, sub) => `
    ${st.passo > 1 ? `<button class="voltar" data-voltar>${icone("voltar")} Voltar</button>` : ""}
    <div class="passos" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= st.passo ? "on" : ""}"></i>`).join("")}</div>
    ${st.antigo ? `<div class="faixa" style="margin-bottom:14px">${icone("repetir")}<div><strong>Remarcando</strong><p>O horário de ${esc(dataLonga(st.antigo.data))} às ${st.antigo.inicio} será cancelado quando você confirmar o novo.</p></div></div>` : ""}
    <div class="titulo-tela"><div><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}</div></div>`;

  const resumo = (botao, ok) => st.sel.length ? `<div class="resumo-fixo"><div class="meio"><strong>${st.sel.length} ${st.sel.length === 1 ? "serviço" : "serviços"} · ${reais(precoTotal())}</strong><small>${duracao(durTotal())}${st.hora ? ` · ${dataLonga(st.data)} às ${st.hora}` : ""}</small></div><button class="btn" data-avanca ${ok ? "" : "disabled"}>${botao}</button></div>` : "";

  // ---------- Passo 1: serviços ----------
  function passo1() {
    const ativos = S.servicos.filter(s => s.ativo !== false);
    el.innerHTML = topo("Escolha os serviços", "Pode escolher mais de um — a gente soma o tempo.") +
      categorias(ativos).map(([c, l]) => `<h2 class="periodo">${esc(c)}</h2><div class="lista">${l.map(s => `
        <div class="sel-serv ${st.sel.includes(s.id) ? "on" : ""}" role="checkbox" tabindex="0" aria-checked="${st.sel.includes(s.id)}" data-s="${esc(s.id)}">
          <span class="marca-sel">${icone("check")}</span>
          <div class="meio"><strong>${esc(s.nome)}</strong><small>${duracao(s.duracao)}${s.descricao ? " · " + esc(s.descricao.slice(0, 70)) + (s.descricao.length > 70 ? "…" : "") : ""}</small></div>
          <span class="preco">${precoServ(s)}</span>
        </div>`).join("")}</div>`).join("") + resumo("Continuar", st.sel.length);
    el.querySelectorAll("[data-s]").forEach(x => {
      const alterna = () => { const id = x.dataset.s; st.sel = st.sel.includes(id) ? st.sel.filter(i => i !== id) : [...st.sel, id]; const y = window.scrollY; desenha(); window.scrollTo(0, y); };
      x.addEventListener("click", alterna);
      x.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alterna(); } });
    });
  }

  // ---------- Passo 2: profissional ----------
  function passo2() {
    const ps = profsAtivos().filter(p => fazServico(p, st.sel));
    if (st.prof && !ps.some(p => p.id === st.prof)) st.prof = "";
    el.innerHTML = topo("Com quem?", "Escolha o profissional ou deixe que a gente encaixe no primeiro horário livre.") + `
      <div class="profs">
        <button class="prof-op ${!st.prof ? "on" : ""}" data-p=""><span class="avatar">${icone("usuarios")}</span><strong>Sem preferência</strong><small>Primeiro horário livre</small></button>
        ${ps.map(p => `<button class="prof-op ${st.prof === p.id ? "on" : ""}" data-p="${esc(p.id)}">${avatar(p.nome, p.foto)}<strong>${esc(p.nome)}</strong><small>${esc(p.funcao || "Barbeiro")}</small></button>`).join("")}
      </div>` + resumo("Ver horários", true);
    el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { st.prof = b.dataset.p; st.data = ""; st.hora = ""; desenha(); }));
  }

  // ---------- Passo 3: dia e hora ----------
  async function carregaSlots(auto = false) {
    st.carregando = true; st.slots = null; desenha();
    try {
      // na primeira abertura, pula para o primeiro dia que ainda tem horário livre
      const dias = diasDisponiveis(Number((S.loja || {}).diasAFrente) || 30);
      for (let i = 0; i < (auto ? 14 : 1); i++) {
        const oc = await ocupadosDoDia(st.data);
        st.slots = livres(st.data, candidatos(), durTotal(), oc);
        if (st.slots.length || !auto) break;
        const prox = dias.slice(dias.indexOf(st.data) + 1).find(d => candidatos().some(p => expediente(p, d)));
        if (!prox) break;
        st.data = prox;
      }
    } catch (e) { toast(traduzErro(e), "erro"); st.slots = []; }
    st.carregando = false; desenha();
  }
  function passo3() {
    const dias = diasDisponiveis(Number((S.loja || {}).diasAFrente) || 30);
    const abre = d => candidatos().some(p => expediente(p, d));
    if (!st.data) { st.data = dias.find(abre) || dias[0]; setTimeout(() => carregaSlots(true), 0); }
    const grupos = { "Manhã": [], "Tarde": [], "Noite": [] };
    (st.slots || []).forEach(s => grupos[min(s.hora) < 720 ? "Manhã" : min(s.hora) < 1080 ? "Tarde" : "Noite"].push(s));
    const mes = dataDe(st.data);
    el.innerHTML = topo("Dia e horário", `${MESES[mes.getMonth()][0].toUpperCase() + MESES[mes.getMonth()].slice(1)} de ${mes.getFullYear()}`) + `
      <div class="dias" id="dias">${dias.map(d => { const x = dataDe(d); const ok = abre(d); return `<button class="dia ${d === st.data ? "on" : ""}" data-d="${d}" ${ok ? "" : "disabled"} aria-label="${dataLonga(d)}${ok ? "" : " (fechado)"}"><small>${DIAS_C[x.getDay()]}</small><b>${x.getDate()}</b><i>${ok ? MESES[x.getMonth()].slice(0, 3) : "fechado"}</i></button>`; }).join("")}</div>
      <div id="slots">${st.carregando || !st.slots ? `<div class="carregando"><span></span></div>` :
        st.slots.length ? Object.entries(grupos).filter(([, l]) => l.length).map(([g, l]) => `<div class="periodo">${g}</div><div class="slots">${l.map(s => `<button class="slot ${s.hora === st.hora ? "on" : ""}" data-h="${s.hora}">${s.hora}</button>`).join("")}</div>`).join("")
          : vazio("relogio", "Sem horários livres neste dia", "Tente outro dia ou outro profissional.")}</div>` + resumo("Continuar", !!st.hora);
    el.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => { st.data = b.dataset.d; st.hora = ""; carregaSlots(); }));
    el.querySelectorAll("[data-h]").forEach(b => b.addEventListener("click", () => { st.hora = b.dataset.h; const y = window.scrollY; desenha(); window.scrollTo(0, y); }));
    const ativo = el.querySelector(".dia.on"); if (ativo) ativo.scrollIntoView({ block: "nearest", inline: "center" });
  }

  // ---------- Passo 4: confirmar ----------
  function profEscolhido() {
    if (st.prof) return S.profissional(st.prof);
    const s = (st.slots || []).find(x => x.hora === st.hora);
    return s ? S.profissional(s.profs[0]) : null;
  }
  function passo4() {
    const p = profEscolhido();
    const loja = S.loja || {};
    el.innerHTML = topo("Confirme seu horário") + `
      <div class="card confirma-card">
        <div class="linha">${icone("calendario")}<div><strong>${esc(dataLonga(st.data))}</strong><div class="muted">${st.hora} às ${hhmmFim()} · ${duracao(durTotal())}</div></div></div>
        <div class="linha">${icone("usuario")}<div><strong>${esc(p ? p.nome : "Equipe")}</strong><div class="muted">${st.prof ? "Escolhido por você" : "Primeiro profissional livre"}</div></div></div>
        <div class="linha">${icone("tesoura")}<div style="flex:1">${servSel().map(s => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(s.nome)}</span><span class="preco">${precoServ(s)}</span></div>`).join("")}</div></div>
        <div class="linha">${icone("local")}<div><strong>${esc(loja.nome || "Barbearia Rodrigues")}</strong><div class="muted">${esc([loja.endereco, loja.cidade].filter(Boolean).join(" · "))}</div></div></div>
        <div class="total"><span>Total</span><b class="preco">${reais(precoTotal())}</b></div>
      </div>
      <label class="campo" style="margin-top:16px"><span>Observação para o barbeiro (opcional)</span><textarea id="obs" maxlength="300" placeholder="Ex.: quero manter o comprimento em cima">${esc(st.obs)}</textarea></label>
      <p class="muted pequeno">O pagamento é feito na barbearia. Você pode cancelar pelo app até ${Number(loja.cancelarAteHoras ?? 2)} h antes.</p>
      <div class="botoes" style="margin-top:16px"><button class="btn bloco" id="confirmar">${icone("check")} Confirmar agendamento</button></div>`;
    el.querySelector("#obs").addEventListener("input", e => st.obs = e.target.value);
    el.querySelector("#confirmar").addEventListener("click", confirmar);
  }
  const hhmmFim = () => { const t = min(st.hora) + durTotal(); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

  async function confirmar(e) {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Reservando…";
    const p = profEscolhido();
    try {
      const ag = await reservar({
        uid: D.usuario.uid,
        clienteNome: (S.perfil && S.perfil.nome) || D.usuario.nome || "",
        clienteTelefone: (S.perfil && S.perfil.telefone) || "",
        servicos: servSel().map(s => ({ id: s.id, nome: s.nome, preco: Number(s.preco), duracao: Number(s.duracao) })),
        profissional: p.id, data: st.data, inicio: st.hora, obs: st.obs.trim()
      });
      if (st.antigo) { try { await liberar(st.antigo, "cancelado", { canceladoPor: "cliente", remarcadoPara: ag.id }); } catch (x) { console.warn(x); } }
      st.feito = ag; desenha();
    } catch (err) {
      toast(traduzErro(err), "erro");
      if (/HORARIO_OCUPADO/.test(err.code || err.message)) { st.passo = 3; st.hora = ""; carregaSlots(); }
      else { b.disabled = false; b.textContent = "Confirmar agendamento"; }
    }
  }

  function sucesso() {
    const ag = st.feito, loja = S.loja || {};
    el.innerHTML = `<div class="sucesso">
      <div class="selo">${icone("check")}</div>
      <h1>Horário reservado!</h1>
      <p>${esc(dataLonga(ag.data))} às ${ag.inicio} com ${esc(ag.profissionalNome)}. A barbearia vai confirmar e você recebe o aviso aqui no app.</p>
      <div class="botoes" style="max-width:420px;margin:0 auto">
        <button class="btn bloco" id="cal">${icone("calendario")} Adicionar à agenda do celular</button>
        <a class="btn sec bloco" href="#/horarios">Ver meus horários</a>
        ${loja.whatsapp ? `<a class="btn fantasma bloco" target="_blank" rel="noopener" href="${linkWhats(loja.whatsapp, `Olá! Acabei de agendar pelo app: ${dataLonga(ag.data)} às ${ag.inicio} (${ag.servicos.map(s => s.nome).join(" + ")}).`)}">${icone("whats")} Avisar no WhatsApp</a>` : ""}
      </div>
      <p class="pequeno" style="margin-top:18px">A agenda do celular te lembra 1 dia e 1 hora antes, mesmo com o app fechado.</p>
    </div>`;
    el.querySelector("#cal").addEventListener("click", () => arquivoCalendario(ag));
  }

  function desenha() {
    if (st.feito) return sucesso();
    if (!S.servicos.length) { el.innerHTML = `<div class="carregando"><span></span></div>`; return; }
    if (!st.sel.length && st.passo > 1) st.passo = 1;
    [null, passo1, passo2, passo3, passo4][st.passo]();
    el.querySelector("[data-voltar]")?.addEventListener("click", () => { st.passo--; if (st.passo < 3) { st.hora = ""; } desenha(); window.scrollTo(0, 0); });
    el.querySelector("[data-avanca]")?.addEventListener("click", () => {
      if (st.passo === 2) { st.data = ""; st.hora = ""; st.slots = null; }
      st.passo++; desenha(); window.scrollTo(0, 0);
    });
  }

  (async () => {
    if (st.remarcar) {
      const a = await D.pegar("agendamentos", st.remarcar).catch(() => null);
      if (a && a.uid === D.usuario.uid) { st.antigo = a; st.sel = (a.servicos || []).map(s => s.id).filter(id => S.servico(id) || !S.servicos.length); st.prof = a.profissional; st.passo = st.sel.length ? 3 : 1; }
    }
    desenha();
  })();
  paradaS = S.ao(q => { if ((q === "servicos" || q === "profissionais") && st.passo <= 2 && !st.feito) desenha(); });
  return () => { paradaS?.(); };
}
