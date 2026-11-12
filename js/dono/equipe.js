// Equipe: barbeiros, foto, serviços que cada um faz, horário próprio,
// comissão e a conta de acesso de cada um (o dono "contrata" o barbeiro aqui:
// informa o e-mail Google dele e escolhe o que aquela conta pode ver e fazer).
//  - profissionais/<id>: o que o cliente vê (nome, foto, horário). Público.
//  - equipe/<id>:        e-mail de login e % de comissão. Só o dono e o próprio barbeiro leem.
//  - acessos/<e-mail>:   qual profissional é e as permissões. É o que as regras do banco consultam.
//  - comissoes/<agendamento>: a comissão de cada atendimento concluído (gravada na agenda).
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, abreModal, confirma, avatar, fotoComprimida, vazio, numero } from "../util.js";
import { titulo, categorias } from "../ui.js";
import { htmlHorario, ligaHorario, leHorario } from "./horario-editor.js";
import { PERMISSOES, PERM_PADRAO, limpaPerm } from "../caixa.js";

export function tela(el) {
  let equipe = {}, acessos = {};      // por id do profissional / por e-mail
  const desenha = () => {
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Equipe", "Quem atende e em quais horários.", `<button class="btn mini" id="novo">${icone("mais")} Profissional</button>`) +
      (S.profissionais.length ? `<div class="lista">${S.profissionais.map(p => `<button class="item" data-ed="${esc(p.id)}">
        ${avatar(p.nome, p.foto)}
        <div class="meio"><strong>${esc(p.nome)} ${p.ativo === false ? '<span class="pill">inativo</span>' : ""}</strong><small>${esc(p.funcao || "Barbeiro")} · ${p.servicos && p.servicos.length ? `${p.servicos.length} serviços` : "todos os serviços"} · ${p.horario ? "horário próprio" : "horário da barbearia"}</small>
          <small>${(equipe[p.id] || {}).email ? `${icone("cadeado")} entra com ${esc(equipe[p.id].email)}` : "sem conta de acesso"} · comissão ${Number((equipe[p.id] || {}).comissao) || 0}%</small></div>
        ${icone("seta", "seta")}</button>`).join("")}</div>` : vazio("usuarios", "Ninguém na equipe ainda"));
    el.querySelector("#novo").addEventListener("click", () => editar(null));
    el.querySelectorAll("[data-ed]").forEach(b => b.addEventListener("click", () => editar(b.dataset.ed)));
  };

  function editar(id) {
    const p = id ? S.profissional(id) : { nome: "", funcao: "Barbeiro", foto: "", servicos: [], horario: null, ativo: true };
    let foto = p.foto || "";
    const eq = (id && equipe[id]) || { email: "", comissao: 0 };
    const perm = eq.email && acessos[eq.email] ? (acessos[eq.email].perm || {}) : PERM_PADRAO;
    abreModal({
      titulo: id ? p.nome : "Novo profissional", largo: true,
      corpo: `<div class="foto-edit" style="margin-bottom:14px"><span class="prev" id="prev" style="border-radius:50%">${foto ? `<img src="${esc(foto)}" alt="">` : icone("usuario")}</span>
          <label class="btn mini sec">${icone("foto")} Foto<input type="file" accept="image/*" id="arq" hidden></label></div>
        <div class="linha2"><label class="campo"><span>Nome *</span><input id="pn" maxlength="40" value="${esc(p.nome)}"></label>
          <label class="campo"><span>Função</span><input id="pf" maxlength="40" value="${esc(p.funcao || "")}" placeholder="Barbeiro, Proprietário…"></label></div>
        <label class="check" style="margin-bottom:14px"><input type="checkbox" id="pa" ${p.ativo !== false ? "checked" : ""}><span>Aparece no app e recebe agendamentos</span></label>
        <details ${p.servicos && p.servicos.length ? "open" : ""}><summary class="rotulo" style="cursor:pointer;margin-bottom:8px">Serviços que faz</summary>
          <p class="pequeno muted" style="margin-bottom:8px">Sem nada marcado = faz todos.</p>
          ${categorias(S.servicos).map(([c, l]) => `<p class="pequeno" style="margin:8px 0 4px"><b>${esc(c)}</b></p>${l.map(s => `<label class="check" style="margin:4px 0"><input type="checkbox" class="sv" value="${esc(s.id)}" ${(p.servicos || []).includes(s.id) ? "checked" : ""}><span>${esc(s.nome)}</span></label>`).join("")}`).join("")}
        </details>
        <details style="margin-top:14px" ${p.horario ? "open" : ""}><summary class="rotulo" style="cursor:pointer;margin-bottom:8px">Horário próprio</summary>
          <label class="check" style="margin-bottom:10px"><input type="checkbox" id="hp" ${p.horario ? "checked" : ""}><span>Usar um horário diferente do da barbearia</span></label>
          ${htmlHorario(p.horario || (S.loja && S.loja.horario), "eq")}
        </details>
        <details style="margin-top:14px" open><summary class="rotulo" style="cursor:pointer;margin-bottom:8px">Comissão e conta de acesso</summary>
          <label class="campo"><span>Comissão sobre os atendimentos (%)</span><input id="pc" inputmode="decimal" maxlength="5" value="${esc(String(Number(eq.comissao) || 0).replace(".", ","))}"><small>Calculada sobre o valor recebido em cada atendimento concluído. Use 0 para quem não recebe comissão (ex.: o dono).</small></label>
          <label class="campo"><span>E-mail Google do barbeiro</span><input id="pe" type="email" autocomplete="off" maxlength="120" value="${esc(eq.email || "")}" placeholder="barbeiro@gmail.com"><small>Com este e-mail ele entra no app e cai no painel do barbeiro. Deixe em branco para quem não usa o painel. Apagar o e-mail tira o acesso na hora.</small></label>
          <div id="perms" ${eq.email ? "" : "hidden"}>
            <p class="pequeno" style="margin:4px 0 8px"><b>O que esta conta pode fazer</b> <span class="muted">(a agenda do dia e os próprios horários ele sempre vê)</span></p>
            ${PERMISSOES.map(([k, t, d]) => `<label class="check" style="margin:8px 0"><input type="checkbox" class="pm" value="${k}" ${perm[k] ? "checked" : ""}><span><b>${esc(t)}</b><br><span class="muted pequeno">${esc(d)}</span></span></label>`).join("")}
            <p class="pequeno muted">Serviços, preços, equipe, avisos, galeria e ajustes ficam sempre só com o dono.</p>
          </div>
        </details>
        ${id ? `<p class="centro" style="margin-top:16px"><button class="btn mini fantasma" id="del" type="button" style="color:var(--perigo)!important">${icone("lixo")} Remover da equipe</button></p>` : ""}`,
      aoAbrir: (m, fecha) => {
        ligaHorario(m, "eq");
        m.querySelector("#arq").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; foto = await fotoComprimida(f, 320, .82); m.querySelector("#prev").innerHTML = `<img src="${foto}" alt="">`; });
        m.querySelector("#pe").addEventListener("input", e => { m.querySelector("#perms").hidden = !e.target.value.trim(); });
        m.querySelector("#del")?.addEventListener("click", async () => {
          if (!await confirma("Remover profissional?", "Ele perde o acesso ao painel na hora. Os horários já marcados com ele continuam na agenda. Se for temporário, prefira desmarcar “Aparece no app”.", "Remover", true)) return;
          try {
            const ops = [{ tipo: "apagar", c: "profissionais", id }, { tipo: "apagar", c: "equipe", id }];
            if (eq.email) ops.push({ tipo: "apagar", c: "acessos", id: eq.email });
            await D.lote(ops); await carrega(); toast("Removido."); fecha();
          } catch (e) { toast(traduzErro(e), "erro"); }
        });
      },
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Salvar", fn: async m => {
          const nome = m.querySelector("#pn").value.trim();
          if (!nome) { toast("Digite o nome.", "erro"); return false; }
          let horario = null;
          if (m.querySelector("#hp").checked) { const r = leHorario(m, "eq"); if (r.erro) { toast(r.erro, "erro"); return false; } horario = r.horario; }
          const dados = { nome, funcao: m.querySelector("#pf").value.trim(), foto, ativo: m.querySelector("#pa").checked, servicos: [...m.querySelectorAll(".sv:checked")].map(x => x.value), horario };
          const comissao = Math.round(numero(m.querySelector("#pc").value) * 100) / 100;
          const email = m.querySelector("#pe").value.trim().toLowerCase();
          if (!(comissao >= 0 && comissao <= 100)) { toast("A comissão vai de 0 a 100%.", "erro"); return false; }
          if (email && !/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(email)) { toast("E-mail inválido.", "erro"); return false; }
          const meuId = id || D.novoId();
          if (email && Object.entries(equipe).some(([k, v]) => k !== meuId && v.email === email)) { toast("Este e-mail já é de outro profissional.", "erro"); return false; }
          const ops = [
            { tipo: "criar", c: "profissionais", id: meuId, dados: { ...dados, ordem: id ? (p.ordem ?? 0) : S.profissionais.length } },
            { tipo: "criar", c: "equipe", id: meuId, dados: { email, comissao } }
          ];
          if (eq.email && eq.email !== email) ops.push({ tipo: "apagar", c: "acessos", id: eq.email });
          if (email) ops.push({ tipo: "criar", c: "acessos", id: email, dados: { prof: meuId, perm: limpaPerm(Object.fromEntries([...m.querySelectorAll(".pm:checked")].map(x => [x.value, true]))) } });
          try { await D.lote(ops); await carrega(); toast(email && email !== eq.email ? "Salvo. Ele já pode entrar com esse e-mail." : "Salvo.", "ok"); }
          catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  async function carrega() {
    try {
      equipe = Object.fromEntries((await D.listar("equipe")).map(x => [x.id, x]));
      acessos = Object.fromEntries((await D.listar("acessos")).map(x => [x.id, x]));
    } catch (e) { console.warn(e); }
    desenha();
  }
  const p = S.ao(q => (q === "profissionais" || q === "servicos") && !document.querySelector(".modal-fundo") && desenha());
  desenha(); carrega();
  return p;
}
