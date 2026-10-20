// Galeria (dono): adicionar fotos de cortes, renomear, ordenar e remover
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, confirma, fotoComprimida, vazio, abreModal } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  const desenha = () => {
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Galeria", "As fotos aparecem em “Nossos trabalhos”. As 6 primeiras vão para o início.",
      `<label class="btn mini">${icone("foto")} Adicionar fotos<input type="file" accept="image/*" multiple id="arq" hidden></label>`) +
      (S.galeria.length ? `<div class="galeria">${S.galeria.map((g, i) => `<div style="position:relative">
        <button data-ed="${esc(g.id)}" style="width:100%"><img src="${esc(g.foto)}" alt="${esc(g.titulo)}" loading="lazy"><span>${esc(g.titulo || "Sem título")}</span></button>
        <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px">
          ${i ? `<button class="icone-btn" style="background:rgba(0,0,0,.55);color:#fff!important;width:34px;height:34px" data-sobe="${i}" aria-label="Mover para frente">${icone("voltar")}</button>` : ""}
          <button class="icone-btn" style="background:rgba(0,0,0,.55);color:#fff!important;width:34px;height:34px" data-del="${esc(g.id)}" aria-label="Remover foto">${icone("lixo")}</button></div></div>`).join("")}</div>`
        : vazio("imagem", "Nenhuma foto", "Adicione fotos dos cortes direto do celular."));
    el.querySelector("#arq").addEventListener("change", async e => {
      const fs = [...e.target.files]; if (!fs.length) return;
      toast("Enviando fotos…");
      try {
        let ordem = S.galeria.length;
        for (const f of fs) await D.criar("galeria", { foto: await fotoComprimida(f, 900, .8), titulo: "", ordem: ordem++, em: Date.now() });
        toast(`${fs.length} foto(s) adicionada(s). Toque para dar um nome.`, "ok");
      } catch (x) { toast(traduzErro(x), "erro"); }
    });
    el.querySelectorAll("[data-ed]").forEach(b => b.addEventListener("click", () => renomeia(S.galeria.find(g => g.id === b.dataset.ed))));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (!await confirma("Remover foto?", "Ela sai da galeria do app.", "Remover", true)) return;
      try { await D.apagar("galeria", b.dataset.del); } catch (x) { toast(traduzErro(x), "erro"); }
    }));
    el.querySelectorAll("[data-sobe]").forEach(b => b.addEventListener("click", async () => {
      const l = [...S.galeria], i = Number(b.dataset.sobe);
      [l[i - 1], l[i]] = [l[i], l[i - 1]];
      try { await D.lote(l.map((g, k) => ({ tipo: "salvar", c: "galeria", id: g.id, dados: { ordem: k } }))); } catch (x) { toast(traduzErro(x), "erro"); }
    }));
  };

  function renomeia(g) {
    abreModal({
      titulo: "Nome da foto",
      corpo: `<img src="${esc(g.foto)}" alt="" style="border-radius:12px;max-height:260px;margin:0 auto 12px"><label class="campo"><span>Nome do corte</span><input id="gt" maxlength="40" value="${esc(g.titulo || "")}" placeholder="Ex.: Low fade com risco"></label>`,
      acoes: [{ t: "Cancelar", cls: "sec" }, { t: "Salvar", fn: async m => { try { await D.salvar("galeria", g.id, { titulo: m.querySelector("#gt").value.trim() }); } catch (x) { toast(traduzErro(x), "erro"); return false; } } }]
    });
  }

  const p = S.ao(q => q === "galeria" && desenha());
  desenha();
  return p;
}
