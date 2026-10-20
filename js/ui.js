// =====================================================================
//  Pedaços de tela usados em mais de um lugar
// =====================================================================
import { S } from "./estado.js";
import { esc, icone, reais, duracao, DIAS, diaSemana, hoje, min, normaliza } from "./util.js";

const FOTO_CAT = {
  "cortes": "img/cortes/degrade-social.jpg",
  "barba": "img/cortes/barba-degrade.jpg",
  "combos": "img/casa/combo.jpg",
  "quimica": "img/cortes/platinado.jpg"
};
export function fotoServico(s) {
  if (s.foto) return s.foto;
  const n = normaliza(s.nome);
  if (n.includes("infantil")) return "img/casa/infantil.jpg";
  if (n.includes("platinado")) return "img/cortes/platinado.jpg";
  if (n.includes("luzes") || n.includes("clareamento")) return "img/cortes/luzes.jpg";
  if (n.includes("barbaterapia") || n.includes("limpeza")) return "img/casa/experiencia.jpg";
  if (n.includes("freestyle") || n.includes("desenho")) return "img/cortes/acabamento.jpg";
  return FOTO_CAT[normaliza(s.categoria)] || "img/casa/atendimento.jpg";
}
export const fotoCategoria = c => FOTO_CAT[normaliza(c)] || "img/casa/atendimento.jpg";

export const precoServ = s => (s.aPartir ? "a partir de " : "") + reais(s.preco);

export function categorias(lista) {
  const ordem = [];
  const mapa = {};
  for (const s of lista) { const c = s.categoria || "Outros"; if (!mapa[c]) { mapa[c] = []; ordem.push(c); } mapa[c].push(s); }
  return ordem.map(c => [c, mapa[c]]);
}

export function cartaoServico(s) {
  return `<a class="cartao-serv" href="#/agendar?servico=${encodeURIComponent(s.id)}">
    <img src="${esc(fotoServico(s))}" alt="" loading="lazy">
    <div><strong>${esc(s.nome)}</strong><small>${duracao(s.duracao)}</small><span class="preco">${precoServ(s)}</span></div>
  </a>`;
}

/** Está aberto agora? -> {aberto, texto} */
export function situacaoAgora() {
  const h = (S.loja && S.loja.horario) || {};
  const d = new Date();
  const e = h[d.getDay()];
  const agora = d.getHours() * 60 + d.getMinutes();
  if (e && e.abre) {
    const pausa = e.pausa && e.pausa[0] ? [min(e.pausa[0]), min(e.pausa[1])] : null;
    if (agora >= min(e.abre) && agora < min(e.fecha)) {
      if (pausa && agora >= pausa[0] && agora < pausa[1]) return { aberto: false, texto: `Pausa · volta às ${e.pausa[1]}` };
      return { aberto: true, texto: `Aberto · até ${pausa && agora < pausa[0] ? e.pausa[0] : e.fecha}` };
    }
    if (agora < min(e.abre)) return { aberto: false, texto: `Fechado · abre às ${e.abre}` };
  }
  for (let i = 1; i <= 7; i++) {
    const x = h[(d.getDay() + i) % 7];
    if (x && x.abre) return { aberto: false, texto: `Fechado · abre ${i === 1 ? "amanhã" : DIAS[(d.getDay() + i) % 7].toLowerCase()} às ${x.abre}` };
  }
  return { aberto: false, texto: "Fechado" };
}

export function tabelaHorario(horario) {
  const h = horario || {};
  const hj = diaSemana(hoje());
  return `<table class="horario-tab"><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => {
    const e = h[d];
    const txt = e && e.abre ? `${e.abre} – ${e.fecha}${e.pausa && e.pausa[0] ? `<br><small class="muted">pausa ${e.pausa[0]}–${e.pausa[1]}</small>` : ""}` : `<span class="muted">Fechado</span>`;
    return `<tr class="${d === hj ? "hoje" : ""}"><td>${DIAS[d]}</td><td>${txt}</td></tr>`;
  }).join("")}</tbody></table>`;
}

export function enderecoLink(loja) {
  const q = encodeURIComponent([loja.endereco, loja.cidade].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function fotoProduto(p, tamanho = "") {
  if (p.foto) return `<img src="${esc(p.foto)}" alt="" loading="lazy">`;
  return icone(p.categoria === "Barba" ? "tesoura" : p.categoria === "Fragrâncias" ? "presente" : "sacola", tamanho);
}

export function titulo(h, sub = "", direita = "") {
  return `<div class="titulo-tela"><div><h1>${h}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${direita}</div>`;
}

/** Abre as fotos em tela cheia, com setas. */
export function lightbox(fotos, i) {
  const el = document.createElement("div");
  el.className = "lightbox";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Foto ampliada");
  const mostra = () => {
    const f = fotos[i];
    el.innerHTML = `<button class="icone-btn" data-x aria-label="Fechar">${icone("x")}</button>
      ${fotos.length > 1 ? `<button class="icone-btn nav ant" data-ant aria-label="Anterior">${icone("voltar")}</button><button class="icone-btn nav prox" data-prox aria-label="Próxima">${icone("seta")}</button>` : ""}
      <img src="${esc(f.foto)}" alt="${esc(f.titulo || "")}"><p>${esc(f.titulo || "")}</p>`;
  };
  const tecla = e => { if (e.key === "Escape") fecha(); if (e.key === "ArrowRight") { i = (i + 1) % fotos.length; mostra(); } if (e.key === "ArrowLeft") { i = (i - 1 + fotos.length) % fotos.length; mostra(); } };
  const fecha = () => { el.remove(); document.removeEventListener("keydown", tecla); };
  el.addEventListener("click", e => {
    if (e.target.closest("[data-ant]")) { i = (i - 1 + fotos.length) % fotos.length; return mostra(); }
    if (e.target.closest("[data-prox]")) { i = (i + 1) % fotos.length; return mostra(); }
    if (e.target === el || e.target.closest("[data-x]")) fecha();
  });
  document.addEventListener("keydown", tecla);
  mostra();
  document.body.appendChild(el);
  el.querySelector("[data-x]").focus();
}

export const LOGO_GOOGLE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
