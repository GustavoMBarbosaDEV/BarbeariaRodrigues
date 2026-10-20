// =====================================================================
//  Utilidades: formatação, datas, CPF, telas (modal/toast) e ícones
// =====================================================================

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/** Escapa texto antes de colocar dentro do HTML (evita que um nome com <script> vire código). */
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Dinheiro ----------
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const reais = v => BRL.format(Number(v) || 0);
/** "35,50" ou "35.5" -> 35.5 */
export function numero(txt) {
  if (typeof txt === "number") return txt;
  const s = String(txt || "").trim().replace(/\s|R\$/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Datas (sempre no horário local, formato AAAA-MM-DD) ----------
export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_C = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const p2 = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => iso(new Date());
export function dataDe(isoStr) { const [a, m, d] = isoStr.split("-").map(Number); return new Date(a, m - 1, d); }
export function somaDias(isoStr, n) { const d = dataDe(isoStr); d.setDate(d.getDate() + n); return iso(d); }
export const diaSemana = isoStr => dataDe(isoStr).getDay();
export function dataLonga(isoStr) { const d = dataDe(isoStr); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; }
export function dataCurta(isoStr) { if (!isoStr) return ""; const [a, m, d] = isoStr.split("-"); return `${d}/${m}/${a}`; }
export function quando(isoStr) {
  const h = hoje();
  if (isoStr === h) return "Hoje";
  if (isoStr === somaDias(h, 1)) return "Amanhã";
  if (isoStr === somaDias(h, -1)) return "Ontem";
  return dataLonga(isoStr);
}
/** "09:30" -> 570 minutos */
export const min = hhmm => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
export const hhmm = minutos => `${p2(Math.floor(minutos / 60))}:${p2(minutos % 60)}`;
export function duracao(m) { m = Number(m) || 0; if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h${p2(r)}` : `${h}h`; }
export function idade(nasc) {
  if (!nasc) return null;
  const n = dataDe(nasc), h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--;
  return i;
}
export function tempoAtras(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : dataCurta(iso(new Date(ms)));
}

// ---------- CPF ----------
export const soDigitos = v => String(v || "").replace(/\D/g, "");
export function cpfValido(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export function cpfFormata(v) {
  const c = soDigitos(v).slice(0, 11);
  return c.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}
/** Mostra só o meio do CPF (padrão usado pela LGPD em listas): ***.456.789-** */
export function cpfOculto(v) { const c = soDigitos(v); return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : "—"; }

// ---------- Telefone ----------
export function foneFormata(v) {
  const c = soDigitos(v).slice(0, 11);
  if (c.length <= 2) return c;
  if (c.length <= 6) return `(${c.slice(0, 2)}) ${c.slice(2)}`;
  if (c.length <= 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
}
export function linkWhats(fone, texto = "") {
  let c = soDigitos(fone);
  if (c && c.length <= 11) c = "55" + c;
  return `https://wa.me/${c}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
}

// ---------- Outros ----------
export const iniciais = nome => String(nome || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("") || "?";
export const primeiroNome = nome => String(nome || "").trim().split(/\s+/)[0] || "";
export const normaliza = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

export const ls = {
  get(k, padrao = null) { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado: segue sem guardar */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/** Diminui uma foto escolhida no celular para caber no banco (JPEG ~ 600px). */
export async function fotoComprimida(arquivo, lado = 600, qualidade = 0.78) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const s = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", qualidade);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Toast ----------
let toastTimer;
export function toast(msg, tipo = "") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.className = "toast show " + tipo;
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- Modal (folha que sobe de baixo no celular) ----------
/**
 * abreModal({titulo, corpo, acoes:[{t, cls, fn}], aoAbrir(el)}) -> fecha()
 * fn pode devolver false para manter o modal aberto.
 */
export function abreModal({ titulo = "", corpo = "", acoes = [], aoAbrir, aoFechar, largo = false }) {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `<div class="modal ${largo ? "largo" : ""}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal-topo"><h3>${esc(titulo)}</h3><button class="icone-btn" data-fecha aria-label="Fechar">${icone("x")}</button></div>
    <div class="modal-corpo">${corpo}</div>
    ${acoes.length ? `<div class="modal-acoes">${acoes.map((a, i) => `<button class="btn ${a.cls || ""}" data-acao="${i}">${a.t}</button>`).join("")}</div>` : ""}
  </div>`;
  const anterior = document.activeElement;
  let fechado = false;
  const fecha = () => {
    if (fechado) return; fechado = true;
    fundo.classList.add("sai"); setTimeout(() => fundo.remove(), 180);
    document.removeEventListener("keydown", tecla); anterior?.focus?.(); aoFechar?.();
  };
  const tecla = e => { if (e.key === "Escape") fecha(); };
  fundo.addEventListener("click", async e => {
    if (e.target === fundo || e.target.closest("[data-fecha]")) return fecha();
    const b = e.target.closest("[data-acao]");
    if (b) {
      const a = acoes[Number(b.dataset.acao)];
      if (!a.fn) return fecha();
      b.disabled = true;
      try { const r = await a.fn(fundo.querySelector(".modal")); if (r !== false) fecha(); }
      finally { b.disabled = false; }
    }
  });
  document.addEventListener("keydown", tecla);
  document.body.appendChild(fundo);
  aoAbrir?.(fundo.querySelector(".modal"), fecha);
  setTimeout(() => (fundo.querySelector("input,select,textarea") || fundo.querySelector("[data-fecha]"))?.focus(), 50);
  return fecha;
}

export function confirma(titulo, texto, sim = "Confirmar", perigo = false) {
  return new Promise(ok => {
    let resp = false;
    abreModal({
      titulo, corpo: `<p class="muted">${texto}</p>`,
      acoes: [{ t: "Voltar", cls: "sec" }, { t: sim, cls: perigo ? "perigo" : "", fn: () => { resp = true; } }],
      aoFechar: () => ok(resp)
    });
  });
}

// ---------- Ícones (traço simples, herdam a cor do texto) ----------
const P = {
  casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendario: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sacola: '<path d="M5 7h14l-1 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 13.5a6.5 6.5 0 0 1 3.5 6.5"/>',
  sino: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  tesoura: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4M14.5 12l1.5 1.5"/>',
  caixa: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  megafone: '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  seta: '<path d="m9 5 7 7-7 7"/>',
  voltar: '<path d="m15 5-7 7 7 7"/>',
  estrela: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  local: '<path d="M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  whats: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.5-2.3-1.6-2.8-2.8l1-1-1-2z"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/>',
  foto: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  lapis: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  sair: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  escudo: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  bolo: '<path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z"/>',
  carrinho: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  subir: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4.5 9.5 8 12 8zM12 8s1.5-5 4-3.5S14.5 8 12 8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  repetir: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'
};
export function icone(nome, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || ""}</svg>`;
}
export function estrelas(nota, tamanho = "") {
  const n = Math.round(Number(nota) || 0);
  return `<span class="estrelas ${tamanho}" aria-label="${n} de 5 estrelas">${[1, 2, 3, 4, 5].map(i => `<svg viewBox="0 0 24 24" class="${i <= n ? "on" : ""}"><path d="${P.estrela.match(/d="([^"]+)"/)[1]}"/></svg>`).join("")}</span>`;
}
export function avatar(nome, foto, cls = "") {
  return foto ? `<img class="avatar ${cls}" src="${esc(foto)}" alt="" loading="lazy">` : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciais(nome))}</span>`;
}
export function vazio(ic, titulo, texto = "", botao = "") {
  return `<div class="vazio">${icone(ic)}<strong>${titulo}</strong>${texto ? `<p>${texto}</p>` : ""}${botao}</div>`;
}
