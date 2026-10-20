// Perfil: cadastro do cliente (nome completo, CPF, nascimento, telefone) e preferências
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, confirma, avatar, cpfValido, cpfFormata, soDigitos, foneFormata, idade, hoje, ls } from "../util.js";
import { N } from "../notificacoes.js";
import { trocaTema, ir } from "../app.js";

export function tela(el, rota) {
  const completar = rota.q.get("completar") === "1";
  const volta = rota.q.get("volta");
  let editando = completar || !S.perfilCompleto();
  const paradas = [];

  function form() {
    const p = S.perfil || {};
    const u = D.usuario;
    return `
      ${completar ? `<div class="faixa" style="margin-bottom:16px">${icone("usuario")}<div><strong>Falta pouco!</strong><p>Complete seu cadastro para agendar e reservar produtos. Só precisa fazer isso uma vez.</p></div></div>` : ""}
      <form id="f" class="card" novalidate>
        <label class="campo"><span>Nome completo *</span><input id="nome" autocomplete="name" maxlength="120" required value="${esc(p.nome || u.nome || "")}" placeholder="Como está no documento"></label>
        <div class="linha2 quebra">
          <label class="campo"><span>CPF *</span><input id="cpf" inputmode="numeric" autocomplete="off" maxlength="14" required value="${esc(cpfFormata(p.cpf || ""))}" placeholder="000.000.000-00"><small class="erro-msg" id="cpfErro" hidden>CPF inválido</small></label>
          <label class="campo"><span>Data de nascimento *</span><input id="nasc" type="date" required max="${hoje()}" min="1900-01-01" value="${esc(p.nascimento || "")}"></label>
        </div>
        <div class="linha2 quebra">
          <label class="campo"><span>Celular / WhatsApp *</span><input id="fone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="15" required value="${esc(foneFormata(p.telefone || ""))}" placeholder="(31) 90000-0000"></label>
          <label class="campo"><span>E-mail</span><input id="email" type="email" value="${esc(p.email || u.email || "")}" ${D.modo === "nuvem" ? "readonly" : ""}><small>${D.modo === "nuvem" ? "Vem da sua conta Google" : ""}</small></label>
        </div>
        <label class="check" style="margin:6px 0 16px"><input type="checkbox" id="aceite" ${p.aceite ? "checked" : ""}><span>Autorizo a Barbearia Rodrigues a guardar esses dados para meus agendamentos e contato, conforme a <a href="#/privacidade">Política de Privacidade</a> (LGPD).</span></label>
        <div class="botoes">${S.perfilCompleto() && !completar ? `<button type="button" class="btn sec" id="cancelaEd">Cancelar</button>` : ""}<button class="btn" type="submit">${completar ? "Salvar e continuar" : "Salvar dados"}</button></div>
      </form>`;
  }

  function resumo() {
    const p = S.perfil;
    if (!p || !p.cpf) return `<div class="carregando"><span></span></div>`;
    const notif = N.ligadas();
    const tema = ls.get("br.tema", "escuro");
    return `
      <div class="lista">
        <div class="config-item"><div class="meio"><small>CPF</small><strong>${esc(cpfFormata(p.cpf))}</strong></div></div>
        <div class="config-item"><div class="meio"><small>Nascimento</small><strong>${esc(p.nascimento.split("-").reverse().join("/"))} · ${idade(p.nascimento)} anos</strong></div></div>
        <div class="config-item"><div class="meio"><small>Celular</small><strong>${esc(foneFormata(p.telefone))}</strong></div></div>
        ${p.email ? `<div class="config-item"><div class="meio"><small>E-mail</small><strong>${esc(p.email)}</strong></div></div>` : ""}
        <div class="config-item"><button class="btn sec mini" id="editar">${icone("lapis")} Editar dados</button></div>
      </div>
      <section class="secao"><div class="secao-topo"><h2>Preferências</h2></div>
      <div class="lista">
        <div class="config-item"><div class="meio"><strong>Notificações no aparelho</strong><small>${N.suportado() ? "Lembrete do horário, confirmação e promoções" : "Este navegador não permite notificações"}</small></div>
          <label class="interruptor"><input type="checkbox" id="notif" ${notif ? "checked" : ""} ${N.suportado() ? "" : "disabled"} aria-label="Notificações no aparelho"><i></i></label></div>
        <div class="config-item"><div class="meio"><strong>Tema</strong></div>
          <div class="seg">${[["escuro", "Escuro"], ["claro", "Claro"], ["auto", "Automático"]].map(([v, t]) => `<button data-tema="${v}" class="${tema === v ? "ativo" : ""}">${t}</button>`).join("")}</div></div>
      </div></section>
      <section class="secao"><div class="lista">
        <a class="item" href="#/horarios">${icone("relogio")}<div class="meio"><strong>Meus horários</strong></div>${icone("seta", "seta")}</a>
        <a class="item" href="#/carrinho">${icone("sacola")}<div class="meio"><strong>Minhas reservas do shop</strong></div>${icone("seta", "seta")}</a>
        <a class="item" href="#/privacidade">${icone("escudo")}<div class="meio"><strong>Privacidade e meus dados</strong></div>${icone("seta", "seta")}</a>
        <button class="item" id="sair">${icone("sair")}<div class="meio"><strong>Sair da conta</strong></div></button>
      </div>
      <p class="centro" style="margin-top:18px"><button class="btn fantasma mini" id="apagar">${icone("lixo")} Apagar meu cadastro</button></p></section>`;
  }

  function desenha() {
    if (!S.perfilCarregado) { el.innerHTML = `<div class="carregando"><span></span></div>`; return; }
    const p = S.perfil || {};
    const u = D.usuario;
    const nome = p.nome || u.nome || "Seu perfil";
    el.innerHTML = `<div class="perfil-topo">${avatar(nome, u.foto, "g")}<div><h1>${esc(nome)}</h1><p class="muted pequeno">${esc(u.email || "")}${D.ehDono ? " · dono" : ""}</p></div></div>` + (editando ? form() : resumo());
    liga();
  }

  function liga() {
    const f = el.querySelector("#f");
    if (f) {
      const cpf = f.querySelector("#cpf"), fone = f.querySelector("#fone");
      cpf.addEventListener("input", () => { cpf.value = cpfFormata(cpf.value); cpf.classList.remove("invalido"); f.querySelector("#cpfErro").hidden = true; });
      cpf.addEventListener("blur", () => { const ok = !cpf.value || cpfValido(cpf.value); cpf.classList.toggle("invalido", !ok); f.querySelector("#cpfErro").hidden = ok; });
      fone.addEventListener("input", () => { fone.value = foneFormata(fone.value); });
      f.querySelector("#cancelaEd")?.addEventListener("click", () => { editando = false; desenha(); });
      f.addEventListener("submit", salvar);
    }
    el.querySelector("#editar")?.addEventListener("click", () => { editando = true; desenha(); });
    el.querySelector("#notif")?.addEventListener("change", async e => {
      if (e.target.checked) { const ok = await N.ligar(); e.target.checked = ok; toast(ok ? "Notificações ligadas." : "O navegador bloqueou as notificações. Libere nas configurações do site.", ok ? "ok" : "erro"); }
      else { N.desligar(); toast("Notificações desligadas."); }
    });
    el.querySelectorAll("[data-tema]").forEach(b => b.addEventListener("click", () => { trocaTema(b.dataset.tema); desenha(); }));
    el.querySelector("#sair")?.addEventListener("click", async () => { if (await confirma("Sair da conta?", "Você pode entrar de novo quando quiser.", "Sair")) D.sair(); });
    el.querySelector("#apagar")?.addEventListener("click", apagar);
  }

  async function salvar(e) {
    e.preventDefault();
    const f = e.currentTarget, v = id => f.querySelector("#" + id).value.trim();
    const nome = v("nome").replace(/\s+/g, " "), cpf = soDigitos(v("cpf")), nasc = v("nasc"), fone = soDigitos(v("fone"));
    const erros = [];
    if (nome.split(" ").length < 2 || nome.length < 5) erros.push(["nome", "Digite o nome completo (nome e sobrenome)."]);
    if (!cpfValido(cpf)) erros.push(["cpf", "CPF inválido. Confira os números."]);
    if (!nasc || nasc > hoje() || idade(nasc) > 120) erros.push(["nasc", "Data de nascimento inválida."]);
    if (fone.length < 10) erros.push(["fone", "Celular com DDD, por favor."]);
    if (!f.querySelector("#aceite").checked) erros.push(["aceite", "Marque a autorização para guardarmos seus dados."]);
    f.querySelectorAll(".invalido").forEach(x => x.classList.remove("invalido"));
    if (erros.length) { erros.forEach(([id]) => f.querySelector("#" + id).classList.add("invalido")); f.querySelector("#" + erros[0][0]).focus(); toast(erros[0][1], "erro"); return; }

    const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    const uid = D.usuario.uid, antigo = S.perfil && S.perfil.cpf;
    const dados = { nome, cpf, nascimento: nasc, telefone: fone, email: v("email") || D.usuario.email || "", aceite: true, aceiteEm: (S.perfil && S.perfil.aceiteEm) || Date.now(), atualizadoEm: Date.now(), criadoEm: (S.perfil && S.perfil.criadoEm) || Date.now() };
    const ops = [{ tipo: "salvar", c: "clientes", id: uid, dados }];
    if (cpf !== antigo) { ops.push({ tipo: "criar", c: "cpfs", id: cpf, dados: { uid } }); if (antigo) ops.push({ tipo: "apagar", c: "cpfs", id: antigo }); }
    try {
      await D.lote(ops);
      S.perfil = { id: uid, ...(S.perfil || {}), ...dados };   // já mostra os dados novos sem esperar o banco responder
      toast("Dados salvos!", "ok");
      editando = false;
      if (volta) return ir(volta);
      desenha();
    } catch (err) {
      const msg = cpf !== antigo && /permission|CPF_EM_USO/i.test(err.code || err.message) ? "Este CPF já está cadastrado em outra conta. Fale com a barbearia." : traduzErro(err);
      toast(msg, "erro"); btn.disabled = false;
    }
  }

  async function apagar() {
    if (!await confirma("Apagar seu cadastro?", "Seus dados pessoais (nome, CPF, nascimento e telefone) serão apagados. O histórico de atendimentos fica com a barbearia por questões fiscais, sem o seu CPF. Para usar o app de novo, basta se cadastrar.", "Apagar meus dados", true)) return;
    try {
      const ops = [{ tipo: "apagar", c: "clientes", id: D.usuario.uid }];
      if (S.perfil && S.perfil.cpf) ops.push({ tipo: "apagar", c: "cpfs", id: S.perfil.cpf });
      await D.lote(ops);
      toast("Cadastro apagado.");
      D.sair();
    } catch (e) { toast(traduzErro(e), "erro"); }
  }

  paradas.push(S.ao(q => { if (q === "perfil" && !el.querySelector("#f")) { if (!S.perfilCompleto()) editando = true; desenha(); } }));
  desenha();
  return () => paradas.forEach(f => f());
}
