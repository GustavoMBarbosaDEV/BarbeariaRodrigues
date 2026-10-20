// Serviços: criar, editar, ordenar, pausar
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, numero, duracao, toast, abreModal, confirma, vazio } from "../util.js";
import { titulo, categorias, precoServ } from "../ui.js";

export function tela(el) {
  const desenha = () => {
    const cats = categorias(S.servicos);
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Serviços", `${S.servicos.filter(s => s.ativo !== false).length} ativos · aparecem no app na ordem abaixo`, `<button class="btn mini" id="novo">${icone("mais")} Serviço</button>`) +
      (cats.length ? cats.map(([c, l]) => `<h2 class="periodo">${esc(c)}</h2><div class="lista">${l.map(s => `<div class="item">
        <div class="meio"><strong>${esc(s.nome)} ${s.destaque ? '<span class="pill ouro">destaque</span>' : ""} ${s.ativo === false ? '<span class="pill">pausado</span>' : ""}</strong><small>${duracao(s.duracao)}${s.descricao ? " · " + esc(s.descricao) : ""}</small></div>
        <div class="lado"><span class="preco">${precoServ(s)}</span><div style="display:flex;gap:4px">
          <button class="icone-btn" data-sobe="${esc(s.id)}" aria-label="Subir">${icone("subir")}</button>
          <button class="icone-btn" data-ed="${esc(s.id)}" aria-label="Editar">${icone("lapis")}</button></div></div>
      </div>`).join("")}</div>`).join("") : vazio("tesoura", "Nenhum serviço", "Cadastre os serviços ou carregue os dados iniciais em Ajustes."));
    el.querySelector("#novo").addEventListener("click", () => editar(null));
    el.querySelectorAll("[data-ed]").forEach(b => b.addEventListener("click", () => editar(b.dataset.ed)));
    el.querySelectorAll("[data-sobe]").forEach(b => b.addEventListener("click", () => sobe(b.dataset.sobe)));
  };

  async function sobe(id) {
    const l = [...S.servicos];
    const i = l.findIndex(s => s.id === id);
    const j = [...l.keys()].slice(0, i).reverse().find(k => l[k].categoria === l[i].categoria);
    if (j === undefined) return;
    [l[i], l[j]] = [l[j], l[i]];
    try { await D.lote(l.map((s, k) => ({ tipo: "salvar", c: "servicos", id: s.id, dados: { ordem: k } }))); } catch (e) { toast(traduzErro(e), "erro"); }
  }

  function editar(id) {
    const s = id ? S.servico(id) : { nome: "", categoria: "Cortes", preco: "", duracao: 30, descricao: "", ativo: true, aPartir: false, destaque: false };
    const cats = [...new Set(["Cortes", "Barba", "Combos", "Química", ...S.servicos.map(x => x.categoria)])];
    abreModal({
      titulo: id ? "Editar serviço" : "Novo serviço",
      corpo: `<label class="campo"><span>Nome *</span><input id="sn" maxlength="60" value="${esc(s.nome)}"></label>
        <div class="linha2"><label class="campo"><span>Categoria</span><input id="sc" list="scs" maxlength="30" value="${esc(s.categoria)}"><datalist id="scs">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
          <label class="campo"><span>Preço (R$) *</span><input id="sp" inputmode="decimal" value="${String(s.preco).replace(".", ",")}"></label></div>
        <label class="campo"><span>Duração</span><select id="sd">${[10, 15, 20, 30, 35, 40, 45, 60, 75, 90, 105, 120, 150, 180].map(m => `<option value="${m}" ${Number(s.duracao) === m ? "selected" : ""}>${duracao(m)}</option>`).join("")}</select><small>Arredondado em blocos de 15 min na agenda.</small></label>
        <label class="campo"><span>Descrição</span><textarea id="sx" maxlength="300">${esc(s.descricao || "")}</textarea></label>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" id="sa" ${s.aPartir ? "checked" : ""}><span>Preço “a partir de” (varia conforme o cabelo)</span></label>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" id="sdest" ${s.destaque ? "checked" : ""}><span>Destacar no início do app</span></label>
        <label class="check"><input type="checkbox" id="son" ${s.ativo !== false ? "checked" : ""}><span>Disponível para agendar</span></label>
        ${id ? `<p class="centro" style="margin-top:16px"><button class="btn mini fantasma" id="del" type="button" style="color:var(--perigo)!important">${icone("lixo")} Excluir serviço</button></p>` : ""}`,
      aoAbrir: (m, fecha) => m.querySelector("#del")?.addEventListener("click", async () => {
        if (!await confirma("Excluir serviço?", "Os agendamentos antigos continuam com o nome do serviço. Se for só por um tempo, prefira desmarcar “Disponível para agendar”.", "Excluir", true)) return;
        try { await D.apagar("servicos", id); toast("Serviço excluído."); fecha(); } catch (e) { toast(traduzErro(e), "erro"); }
      }),
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Salvar", fn: async m => {
          const v = q => m.querySelector(q).value.trim();
          const dados = { nome: v("#sn"), categoria: v("#sc") || "Outros", preco: numero(v("#sp")), duracao: Number(v("#sd")), descricao: v("#sx"), aPartir: m.querySelector("#sa").checked, destaque: m.querySelector("#sdest").checked, ativo: m.querySelector("#son").checked };
          if (!dados.nome) { toast("Digite o nome.", "erro"); return false; }
          if (dados.preco < 0 || !v("#sp")) { toast("Digite o preço.", "erro"); return false; }
          try { if (id) await D.salvar("servicos", id, dados); else await D.criar("servicos", { ...dados, ordem: S.servicos.length }); toast("Serviço salvo.", "ok"); }
          catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  const p = S.ao(q => q === "servicos" && desenha());
  desenha();
  void reais;
  return p;
}
