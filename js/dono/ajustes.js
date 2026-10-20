// Ajustes: dados da barbearia, horário, regras da agenda, donos, dados iniciais e backup
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, confirma, soDigitos, foneFormata, hoje, ls } from "../util.js";
import { titulo } from "../ui.js";
import { catalogo } from "../seed.js";
import { htmlHorario, ligaHorario, leHorario } from "./horario-editor.js";
import { trocaTema, VERSAO } from "../app.js";

export function tela(el) {
  let admins = [];
  const desenha = () => {
    const l = S.loja || {};
    const tema = ls.get("br.tema", "escuro");
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Ajustes") + `
    ${!S.servicos.length ? `<div class="faixa alerta" style="margin-bottom:16px">${icone("alerta")}<div><strong>Primeira vez aqui?</strong><p>Carregue os serviços (do Booksy), a equipe, os produtos e as fotos com um toque. Depois é só ajustar.</p><button class="btn mini" id="seed2" style="margin-top:10px">Carregar dados iniciais</button></div></div>` : ""}
    <form id="fl" class="card">
      <h3 style="margin-bottom:12px">Dados da barbearia</h3>
      <label class="campo"><span>Nome</span><input id="ln" maxlength="60" value="${esc(l.nome || "")}"></label>
      <label class="campo"><span>Frase de apresentação</span><input id="ls" maxlength="120" value="${esc(l.slogan || "")}"></label>
      <label class="campo"><span>Sobre</span><textarea id="lb" maxlength="400">${esc(l.sobre || "")}</textarea></label>
      <div class="linha2 quebra"><label class="campo"><span>Endereço</span><input id="le" maxlength="100" value="${esc(l.endereco || "")}"></label>
        <label class="campo"><span>Cidade / CEP</span><input id="lc" maxlength="60" value="${esc(l.cidade || "")}"></label></div>
      <div class="linha2 quebra"><label class="campo"><span>WhatsApp da barbearia</span><input id="lw" type="tel" maxlength="15" value="${esc(foneFormata(l.whatsapp || ""))}" placeholder="(31) 90000-0000"><small>Aparece como botão no app.</small></label>
        <label class="campo"><span>Instagram (sem @)</span><input id="li" maxlength="40" value="${esc(l.instagram || "")}"></label></div>
      <h3 style="margin:10px 0 12px">Horário de funcionamento</h3>
      ${htmlHorario(l.horario, "lj")}
      <h3 style="margin:18px 0 12px">Regras da agenda</h3>
      <div class="linha2 quebra">
        <label class="campo"><span>Horários começam a cada</span><select id="ri">${[15, 20, 30, 60].map(v => `<option value="${v}" ${Number(l.intervalo || 30) === v ? "selected" : ""}>${v} minutos</option>`).join("")}</select></label>
        <label class="campo"><span>Antecedência mínima</span><select id="ra">${[0, 15, 30, 60, 120, 240].map(v => `<option value="${v}" ${Number(l.antecedenciaMin ?? 30) === v ? "selected" : ""}>${v ? (v < 60 ? v + " min" : v / 60 + " h") : "nenhuma"}</option>`).join("")}</select></label>
        <label class="campo"><span>Cliente cancela sozinho até</span><select id="rc">${[0, 1, 2, 3, 6, 12, 24].map(v => `<option value="${v}" ${Number(l.cancelarAteHoras ?? 2) === v ? "selected" : ""}>${v ? v + " h antes" : "a qualquer momento"}</option>`).join("")}</select></label>
        <label class="campo"><span>Agenda aberta para</span><select id="rd">${[7, 14, 30, 60, 90].map(v => `<option value="${v}" ${Number(l.diasAFrente || 30) === v ? "selected" : ""}>${v} dias à frente</option>`).join("")}</select></label>
      </div>
      <label class="campo"><span>Mensagem de aniversário (aparece para o cliente no dia)</span><input id="rm" maxlength="160" value="${esc(l.cupomAniversario || "")}"></label>
      <div class="botoes"><button class="btn" type="submit">Salvar ajustes</button></div>
    </form>

    <section class="card" style="margin-top:14px">
      <h3>Quem acessa o painel</h3>
      <p class="muted pequeno" style="margin:4px 0 12px">E-mails Google que entram como dono/equipe. O dono principal fica fixo nas regras do Firebase.</p>
      <div id="adms">${admins.map((e, i) => `<div class="item" style="padding:8px 0;min-height:0"><div class="meio"><strong>${esc(e)}</strong></div><button class="icone-btn" data-rm="${i}" aria-label="Remover">${icone("x")}</button></div>`).join("") || `<p class="muted pequeno">Ninguém além do dono principal.</p>`}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><input id="novoAdm" type="email" placeholder="email@gmail.com"><button class="btn mini" id="addAdm">Adicionar</button></div>
    </section>

    <section class="card" style="margin-top:14px">
      <h3>Aparência</h3>
      <div class="seg" style="margin-top:10px">${[["escuro", "Escuro"], ["claro", "Claro"], ["auto", "Automático"]].map(([v, t]) => `<button data-tema="${v}" class="${tema === v ? "ativo" : ""}">${t}</button>`).join("")}</div>
    </section>

    <section class="card" style="margin-top:14px">
      <h3>Dados</h3>
      <div class="botoes" style="margin-top:12px">
        <button class="btn sec" id="backup">${icone("baixar")} Baixar backup (JSON)</button>
        <button class="btn sec" id="seed">${icone("subir")} Carregar dados iniciais</button>
        ${D.modo === "demo" ? `<button class="btn fantasma" id="zerar">${icone("repetir")} Recomeçar demonstração</button>` : ""}
      </div>
      <p class="muted pequeno" style="margin-top:10px">“Carregar dados iniciais” adiciona os serviços e preços do Booksy, a equipe (Arlley e Miguel), produtos de exemplo e as fotos. Não apaga clientes nem agendamentos.</p>
    </section>
    <p class="centro" style="margin-top:20px"><button class="btn fantasma mini" id="sair">${icone("sair")} Sair da conta</button></p>
    <p class="centro fraco pequeno" style="margin-top:8px">Barbearia Rodrigues · app v${VERSAO} · ${D.modo === "demo" ? "modo demonstração" : "Firebase"}</p>`;

    ligaHorario(el, "lj");
    el.querySelector("#lw").addEventListener("input", e => e.target.value = foneFormata(e.target.value));
    el.querySelector("#fl").addEventListener("submit", salvar);
    el.querySelectorAll("[data-tema]").forEach(b => b.addEventListener("click", () => { trocaTema(b.dataset.tema); desenha(); }));
    el.querySelector("#addAdm").addEventListener("click", addAdm);
    el.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => salvaAdmins(admins.filter((_, i) => i !== Number(b.dataset.rm)))));
    el.querySelector("#backup").addEventListener("click", backup);
    el.querySelector("#seed").addEventListener("click", carregar);
    el.querySelector("#seed2")?.addEventListener("click", carregar);
    el.querySelector("#zerar")?.addEventListener("click", async () => { if (await confirma("Recomeçar a demonstração?", "Apaga tudo que foi feito no modo demonstração neste aparelho.", "Recomeçar", true)) D.zerarDemo(); });
    el.querySelector("#sair").addEventListener("click", async () => { if (await confirma("Sair da conta?", "", "Sair")) D.sair(); });
  };

  async function salvar(e) {
    e.preventDefault();
    const f = e.currentTarget, v = id => f.querySelector("#" + id).value.trim();
    const h = leHorario(f, "lj");
    if (h.erro) return toast(h.erro, "erro");
    const dados = {
      nome: v("ln") || "Barbearia Rodrigues", slogan: v("ls"), sobre: v("lb"), endereco: v("le"), cidade: v("lc"),
      whatsapp: soDigitos(v("lw")), instagram: v("li").replace(/^@/, ""), horario: h.horario,
      intervalo: Number(v("ri")), antecedenciaMin: Number(v("ra")), cancelarAteHoras: Number(v("rc")), diasAFrente: Number(v("rd")),
      cupomAniversario: v("rm"), atualizadoEm: Date.now()
    };
    try { await D.salvar("config", "loja", dados); toast("Ajustes salvos!", "ok"); } catch (x) { toast(traduzErro(x), "erro"); }
  }

  async function addAdm() {
    const e = el.querySelector("#novoAdm").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("E-mail inválido.", "erro");
    if (admins.includes(e)) return;
    salvaAdmins([...admins, e]);
  }
  async function salvaAdmins(l) {
    try { await D.salvar("config", "admins", { emails: l }); admins = l; toast("Acesso atualizado.", "ok"); desenha(); } catch (x) { toast(traduzErro(x), "erro"); }
  }

  async function carregar() {
    if (!await confirma("Carregar dados iniciais?", "Adiciona serviços, equipe, produtos, fotos da galeria e os dados da barbearia. Se já existirem itens com o mesmo nome, eles não são duplicados.", "Carregar")) return;
    const c = catalogo();
    const nomes = (l, k = "nome") => new Set(l.map(x => (x[k] || "").toLowerCase()));
    const ns = nomes(S.servicos), np = nomes(S.profissionais), npr = nomes(S.produtos), ng = new Set(S.galeria.map(g => g.foto));
    const ops = [];
    if (!S.loja) ops.push({ tipo: "salvar", c: "config", id: "loja", dados: c.loja });
    c.servicos.filter(s => !ns.has(s.nome.toLowerCase())).forEach(s => ops.push({ tipo: "salvar", c: "servicos", id: D.novoId(), dados: s }));
    c.profissionais.filter(p => !np.has(p.nome.toLowerCase())).forEach(p => ops.push({ tipo: "salvar", c: "profissionais", id: D.novoId(), dados: p }));
    c.produtos.filter(p => !npr.has(p.nome.toLowerCase())).forEach(p => {
      const id = D.novoId(), { custo, quantidade, minimo, ...pub } = p;
      ops.push({ tipo: "salvar", c: "produtos", id, dados: { ...pub, foto: "", ativo: true, disponivel: quantidade > 0 } });
      ops.push({ tipo: "salvar", c: "estoque", id, dados: { custo, quantidade, minimo, atualizadoEm: Date.now() } });
    });
    c.galeria.filter(g => !ng.has(g.foto)).forEach(g => ops.push({ tipo: "salvar", c: "galeria", id: D.novoId(), dados: g }));
    if (!S.avisos.length) c.avisos.forEach(a => ops.push({ tipo: "salvar", c: "avisos", id: D.novoId(), dados: a }));
    if (!ops.length) return toast("Tudo já estava carregado.");
    try {
      for (let i = 0; i < ops.length; i += 400) await D.lote(ops.slice(i, i + 400));   // o Firestore aceita até 500 por vez
      toast(`${ops.length} itens carregados!`, "ok");
    } catch (x) { toast(traduzErro(x), "erro"); }
  }

  async function backup() {
    const cols = ["clientes", "fichas", "agendamentos", "pedidos", "produtos", "estoque", "movimentos", "servicos", "profissionais", "galeria", "avisos", "avaliacoes"];
    const out = { app: "Barbearia Rodrigues", versao: VERSAO, geradoEm: new Date().toISOString(), config: { loja: S.loja } };
    try {
      for (const c of cols) out[c] = await D.listar(c);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
      a.download = `backup-barbearia-rodrigues-${hoje()}.json`; a.click();
      toast("Backup baixado. Guarde em lugar seguro: tem dados pessoais (LGPD).", "ok");
    } catch (x) { toast(traduzErro(x), "erro"); }
  }

  const p = S.ao(q => (q === "loja" || q === "servicos") && !el.querySelector("#fl :focus") && desenha());
  D.pegar("config", "admins").then(d => { admins = (d && d.emails) || []; desenha(); }).catch(() => desenha());
  desenha();
  return p;
}
