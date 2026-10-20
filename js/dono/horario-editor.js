// Editor do horário semanal (usado em Ajustes e na Equipe)
import { DIAS } from "../util.js";

export function htmlHorario(h, prefixo = "h") {
  h = h || {};
  return `<div class="dias-semana">${[1, 2, 3, 4, 5, 6, 0].map(d => {
    const e = h[d] || null;
    return `<div class="dia-exp" data-dia="${d}">
      <label class="check"><input type="checkbox" class="${prefixo}-on" ${e ? "checked" : ""}><span><b>${DIAS[d]}</b></span></label>
      <div class="horas" ${e ? "" : 'style="opacity:.45"'}>
        <span>Abre</span><input type="time" class="${prefixo}-abre" value="${e ? e.abre : "08:00"}" step="900" aria-label="${DIAS[d]} abre">
        <span>Fecha</span><input type="time" class="${prefixo}-fecha" value="${e ? e.fecha : "18:00"}" step="900" aria-label="${DIAS[d]} fecha">
        <span>Pausa</span><input type="time" class="${prefixo}-p1" value="${e && e.pausa ? e.pausa[0] : ""}" step="900" aria-label="${DIAS[d]} pausa início">
        <span>até</span><input type="time" class="${prefixo}-p2" value="${e && e.pausa ? e.pausa[1] : ""}" step="900" aria-label="${DIAS[d]} pausa fim">
      </div></div>`;
  }).join("")}</div>
  <p class="pequeno muted" style="margin-top:6px">Deixe a pausa em branco se não houver intervalo.</p>`;
}

export function ligaHorario(raiz, prefixo = "h") {
  raiz.querySelectorAll(".dia-exp").forEach(l => l.querySelector(`.${prefixo}-on`).addEventListener("change", e => { l.querySelector(".horas").style.opacity = e.target.checked ? 1 : .45; }));
}

/** Lê o editor. Devolve {horario} ou {erro}. */
export function leHorario(raiz, prefixo = "h") {
  const h = {};
  for (const l of raiz.querySelectorAll(".dia-exp")) {
    const d = l.dataset.dia;
    if (!l.querySelector(`.${prefixo}-on`).checked) { h[d] = null; continue; }
    const abre = l.querySelector(`.${prefixo}-abre`).value, fecha = l.querySelector(`.${prefixo}-fecha`).value;
    const p1 = l.querySelector(`.${prefixo}-p1`).value, p2 = l.querySelector(`.${prefixo}-p2`).value;
    if (!abre || !fecha || fecha <= abre) return { erro: `${DIAS[d]}: o horário de fechar precisa ser depois do de abrir.` };
    if ((p1 && !p2) || (!p1 && p2) || (p1 && (p2 <= p1 || p1 < abre || p2 > fecha))) return { erro: `${DIAS[d]}: confira a pausa (início e fim dentro do expediente).` };
    h[d] = { abre, fecha, pausa: p1 ? [p1, p2] : null };
  }
  return { horario: h };
}
