// Galeria de cortes (portfólio)
import { S } from "../estado.js";
import { esc, vazio } from "../util.js";
import { titulo, lightbox } from "../ui.js";

export function tela(el) {
  const desenha = () => {
    el.innerHTML = `${titulo("Nossos trabalhos", "Cortes, barbas e químicas feitos aqui na barbearia.")}
      ${S.galeria.length ? `<div class="galeria">${S.galeria.map((g, i) => `<button data-i="${i}"><img src="${esc(g.foto)}" alt="${esc(g.titulo)}" loading="lazy"><span>${esc(g.titulo)}</span></button>`).join("")}</div>` : vazio("imagem", "Sem fotos ainda")}
      <div class="botoes" style="margin-top:20px"><a class="btn" href="#/agendar">Quero um desses — agendar</a></div>`;
    el.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => lightbox(S.galeria, Number(b.dataset.i))));
  };
  const p = S.ao(q => q === "galeria" && desenha());
  desenha();
  return p;
}
