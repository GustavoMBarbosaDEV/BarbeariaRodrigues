// Lista completa de serviços por categoria, com botão de reservar
import { S } from "../estado.js";
import { esc, duracao } from "../util.js";
import { categorias, fotoCategoria, precoServ, titulo } from "../ui.js";

export function tela(el) {
  let filtro = "Todos";
  const desenha = () => {
    const ativos = S.servicos.filter(s => s.ativo !== false);
    const cats = categorias(ativos);
    el.innerHTML = `${titulo("Serviços", "Escolha um serviço para ver os horários livres.")}
      <div class="chips" role="tablist">${["Todos", ...cats.map(c => c[0])].map(c => `<button class="chip ${c === filtro ? "ativo" : ""}" data-c="${esc(c)}" role="tab" aria-selected="${c === filtro}">${esc(c)}</button>`).join("")}</div>
      ${cats.filter(([c]) => filtro === "Todos" || c === filtro).map(([c, l]) => `
        <div class="cat-titulo"><img src="${esc(fotoCategoria(c))}" alt="" loading="lazy"><h2>${esc(c)}</h2><span class="muted pequeno">${l.length}</span></div>
        <div class="lista">${l.map(s => `<div class="serv">
          <div class="meio"><strong>${esc(s.nome)}</strong>${s.descricao ? `<p>${esc(s.descricao)}</p>` : ""}</div>
          <div class="lado"><span class="preco">${precoServ(s)}</span><small>${duracao(s.duracao)}</small><a class="btn mini" href="#/agendar?servico=${encodeURIComponent(s.id)}">Reservar</a></div>
        </div>`).join("")}</div>`).join("")}`;
    el.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { filtro = b.dataset.c; desenha(); }));
  };
  const p = S.ao(q => q === "servicos" && desenha());
  desenha();
  return p;
}
