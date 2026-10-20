// Shop: produtos de cabelo, barba e beleza que a barbearia vende
import { D } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, toast, abreModal, ls, normaliza, vazio } from "../util.js";
import { titulo, fotoProduto } from "../ui.js";
import { N } from "../notificacoes.js";

export function addCarrinho(id, qtd = 1) {
  const i = S.carrinho.find(x => x.id === id);
  if (i) i.qtd += qtd; else S.carrinho.push({ id, qtd });
  S.carrinho = S.carrinho.filter(x => x.qtd > 0);
  ls.set("br.carrinho", S.carrinho);
  N.atualizaBadges();
  S.avisar("carrinho");
}

export function tela(el, rota) {
  let cat = "Todos", busca = "";
  const desenha = () => {
    const ativos = S.produtos.filter(p => p.ativo !== false);
    const cats = ["Todos", ...new Set(ativos.map(p => p.categoria || "Outros"))];
    const termo = normaliza(busca);
    const lista = ativos.filter(p => (cat === "Todos" || (p.categoria || "Outros") === cat) && (!termo || normaliza(p.nome + " " + (p.descricao || "")).includes(termo)));
    const noCarrinho = S.carrinho.reduce((s, i) => s + i.qtd, 0);
    el.innerHTML = titulo("Shop", "Reserve pelo app e retire na barbearia. Pagamento na hora da retirada.",
      `<a class="btn mini ${noCarrinho ? "" : "sec"}" href="#/carrinho">${icone("carrinho")} Sacola${noCarrinho ? ` (${noCarrinho})` : ""}</a>`) + `
      ${!busca && cat === "Todos" ? `<div class="banner-shop"><img src="img/casa/produtos.jpg" alt=""><div><strong>Os produtos que usamos na cadeira</strong><p>Pomadas, géis, óleos e cuidados para barba. Reserve e retire quando vier cortar.</p></div></div>` : ""}
      <div class="busca" style="margin-bottom:12px">${icone("busca")}<input type="search" id="busca" placeholder="Buscar produto" value="${esc(busca)}" aria-label="Buscar produto"></div>
      <div class="chips" style="margin-bottom:12px">${cats.map(c => `<button class="chip ${c === cat ? "ativo" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      ${lista.length ? `<div class="produtos">${lista.map(p => `<article class="produto">
        <button class="foto" data-ver="${esc(p.id)}" style="border:0;cursor:pointer" aria-label="Ver ${esc(p.nome)}">${fotoProduto(p)}${p.disponivel === false ? '<span class="pill perigo">Esgotado</span>' : ""}</button>
        <div class="corpo"><small>${esc(p.categoria || "")}</small><strong>${esc(p.nome)}</strong>
          <div class="rodape"><span class="preco">${reais(p.preco)}</span><button class="icone-btn" data-add="${esc(p.id)}" ${p.disponivel === false ? "disabled" : ""} aria-label="Adicionar ${esc(p.nome)} à sacola">${icone("mais")}</button></div>
        </div></article>`).join("")}</div>` : vazio("sacola", "Nenhum produto encontrado")}`;
    const ib = el.querySelector("#busca");
    ib.addEventListener("input", e => { busca = e.target.value; const pos = e.target.selectionStart; desenha(); const n = el.querySelector("#busca"); n.focus(); n.setSelectionRange(pos, pos); });
    el.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { cat = b.dataset.c; desenha(); }));
    el.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => { addCarrinho(b.dataset.add); toast("Adicionado à sacola", "ok"); desenha(); }));
    el.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", () => ver(b.dataset.ver)));
  };

  function ver(id) {
    const p = S.produto(id); if (!p) return;
    let qtd = 1;
    abreModal({
      titulo: p.nome,
      corpo: `<div class="produto" style="border:0;background:none"><div class="foto" style="border-radius:16px;overflow:hidden">${fotoProduto(p)}</div></div>
        <p class="rotulo" style="margin-top:14px">${esc(p.categoria || "")}</p>
        <p style="margin:6px 0 12px">${esc(p.descricao || "")}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b class="preco" style="font-size:22px">${reais(p.preco)}</b>
        ${p.disponivel === false ? '<span class="pill perigo">Esgotado</span>' : `<div class="qtd"><button data-q="-1" aria-label="Menos">${icone("menos")}</button><span id="q">1</span><button data-q="1" aria-label="Mais">${icone("mais")}</button></div>`}</div>`,
      aoAbrir: m => m.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => { qtd = Math.max(1, Math.min(20, qtd + Number(b.dataset.q))); m.querySelector("#q").textContent = qtd; })),
      acoes: p.disponivel === false ? [{ t: "Fechar", cls: "sec" }] : [{ t: "Fechar", cls: "sec" }, { t: "Adicionar à sacola", fn: () => { addCarrinho(p.id, qtd); toast("Adicionado à sacola", "ok"); desenha(); } }]
    });
  }

  const parada = S.ao(q => (q === "produtos") && desenha());
  desenha();
  if (rota.q.get("p")) setTimeout(() => ver(rota.q.get("p")), 50);
  void D;
  return parada;
}
