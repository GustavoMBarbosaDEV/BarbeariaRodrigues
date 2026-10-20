// Equipe: barbeiros, foto, serviços que cada um faz e horário próprio
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, abreModal, confirma, avatar, fotoComprimida, vazio } from "../util.js";
import { titulo, categorias } from "../ui.js";
import { htmlHorario, ligaHorario, leHorario } from "./horario-editor.js";

export function tela(el) {
  const desenha = () => {
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Equipe", "Quem atende e em quais horários.", `<button class="btn mini" id="novo">${icone("mais")} Profissional</button>`) +
      (S.profissionais.length ? `<div class="lista">${S.profissionais.map(p => `<button class="item" data-ed="${esc(p.id)}">
        ${avatar(p.nome, p.foto)}
        <div class="meio"><strong>${esc(p.nome)} ${p.ativo === false ? '<span class="pill">inativo</span>' : ""}</strong><small>${esc(p.funcao || "Barbeiro")} · ${p.servicos && p.servicos.length ? `${p.servicos.length} serviços` : "todos os serviços"} · ${p.horario ? "horário próprio" : "horário da barbearia"}</small></div>
        ${icone("seta", "seta")}</button>`).join("")}</div>` : vazio("usuarios", "Ninguém na equipe ainda"));
    el.querySelector("#novo").addEventListener("click", () => editar(null));
    el.querySelectorAll("[data-ed]").forEach(b => b.addEventListener("click", () => editar(b.dataset.ed)));
  };

  function editar(id) {
    const p = id ? S.profissional(id) : { nome: "", funcao: "Barbeiro", foto: "", servicos: [], horario: null, ativo: true };
    let foto = p.foto || "";
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
        ${id ? `<p class="centro" style="margin-top:16px"><button class="btn mini fantasma" id="del" type="button" style="color:var(--perigo)!important">${icone("lixo")} Remover da equipe</button></p>` : ""}`,
      aoAbrir: (m, fecha) => {
        ligaHorario(m, "eq");
        m.querySelector("#arq").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; foto = await fotoComprimida(f, 320, .82); m.querySelector("#prev").innerHTML = `<img src="${foto}" alt="">`; });
        m.querySelector("#del")?.addEventListener("click", async () => {
          if (!await confirma("Remover profissional?", "Os horários já marcados com ele continuam na agenda. Se for temporário, prefira desmarcar “Aparece no app”.", "Remover", true)) return;
          try { await D.apagar("profissionais", id); toast("Removido."); fecha(); } catch (e) { toast(traduzErro(e), "erro"); }
        });
      },
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Salvar", fn: async m => {
          const nome = m.querySelector("#pn").value.trim();
          if (!nome) { toast("Digite o nome.", "erro"); return false; }
          let horario = null;
          if (m.querySelector("#hp").checked) { const r = leHorario(m, "eq"); if (r.erro) { toast(r.erro, "erro"); return false; } horario = r.horario; }
          const dados = { nome, funcao: m.querySelector("#pf").value.trim(), foto, ativo: m.querySelector("#pa").checked, servicos: [...m.querySelectorAll(".sv:checked")].map(x => x.value), horario };
          try { if (id) await D.salvar("profissionais", id, { ...dados, ordem: p.ordem ?? 0 }, false); else await D.criar("profissionais", { ...dados, ordem: S.profissionais.length }); toast("Salvo.", "ok"); }
          catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  const p = S.ao(q => (q === "profissionais" || q === "servicos") && desenha());
  desenha();
  return p;
}
