// =====================================================================
//  Serviço de avisos — regras (sem rede, para dar para testar com node --test)
//  Decide QUEM deve receber aviso agora:
//   - lembrete: o horário do cliente começa dentro de "lembreteMin" (padrão 2 h);
//   - vaga: o horário que a pessoa pediu na lista de espera ficou livre.
//  As contas de horário repetem as de js/agenda.js (expediente, pausa, blocos de 15 min).
// =====================================================================
export const BLOCO = 15;
const FUSO_MIN = -180;            // Brasília (UTC-3, sem horário de verão)
const p2 = n => String(n).padStart(2, "0");
export const min = hhmm => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
export const hhmm = t => `${p2(Math.floor(t / 60))}:${p2(t % 60)}`;

/** Relógio da barbearia: { data: "AAAA-MM-DD", minutos desde 00:00, diaSemana 0-6 }. */
export function relogio(ms) {
  const d = new Date(ms + FUSO_MIN * 60000);
  return { data: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, minutos: d.getUTCHours() * 60 + d.getUTCMinutes(), diaSemana: d.getUTCDay() };
}
export function somaDias(data, n) { const [a, m, d] = data.split("-").map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}`; }
/** Momento (ms) em que começa um horário marcado no relógio da barbearia. */
export function inicioMs(data, hora) { const [a, m, d] = data.split("-").map(Number); return Date.UTC(a, m - 1, d) + (min(hora) - FUSO_MIN) * 60000; }

export function cancelarAteMin(loja) {
  const l = loja || {};
  if (l.cancelarAteMin != null) return Number(l.cancelarAteMin) || 0;
  if (l.cancelarAteHoras != null) return (Number(l.cancelarAteHoras) || 0) * 60;
  return 90;
}
export const lembreteMin = loja => Number((loja || {}).lembreteMin ?? 120) || 0;

/** Lembretes que devem sair agora. Devolve [{ id, uid, titulo, texto, link, tag }]. */
export function lembretesDevidos(ags, agoraMs, loja) {
  const antes = lembreteMin(loja) * 60000, prazo = cancelarAteMin(loja) * 60000;
  if (!antes) return [];
  const out = [];
  for (const a of ags) {
    if (!["marcado", "confirmado"].includes(a.status) || a.lembreteEm || !a.uid || !a.data || !a.inicio) continue;
    const ini = inicioMs(a.data, a.inicio), falta = ini - agoraMs;
    if (falta <= 0 || falta > antes) continue;
    if (agoraMs - Number(a.criadoEm || 0) < 15 * 60000) continue;       // acabou de marcar: não precisa lembrar
    const limite = relogio(ini - prazo);
    out.push({
      id: a.id, uid: a.uid, titulo: `Seu horário é às ${a.inicio}`,
      texto: falta > prazo ? `Com ${a.profissionalNome || "a equipe"}. Se não puder vir, cancele pelo app até as ${hhmm(limite.minutos)}.` : `Com ${a.profissionalNome || "a equipe"}. Te esperamos!`,
      link: "horarios", tag: "lembrete_" + a.id
    });
  }
  return out;
}

function expediente(prof, loja, diaSemana) {
  const h = (prof && prof.horario) || (loja && loja.horario) || {};
  const e = h[diaSemana] ?? h[String(diaSemana)];
  return e && e.abre && e.fecha ? e : null;
}
const blocos = (t, dur) => { const r = []; for (let x = t; x < t + dur; x += BLOCO) r.push(x); return r; };

/** O horário pedido na lista de espera está livre? ocupados = Set("prof_HHMM") daquele dia. */
export function vagaAberta(e, ocupados, profs, loja, agoraMs) {
  if (inicioMs(e.data, e.hora) <= agoraMs) return false;
  const [a, m, d] = e.data.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  const t = min(e.hora), dur = Number(e.duracao) || 30, servicos = e.servicos || [];
  return profs.some(p => {
    if (p.ativo === false || (e.profissional && p.id !== e.profissional)) return false;
    if (p.servicos && p.servicos.length && !servicos.every(s => p.servicos.includes(s))) return false;
    const x = expediente(p, loja, diaSemana);
    if (!x || t < min(x.abre) || t + dur > min(x.fecha)) return false;
    if (x.pausa && x.pausa[0] && t < min(x.pausa[1]) && t + dur > min(x.pausa[0])) return false;
    return !blocos(t, dur).some(b => ocupados.has(`${p.id}_${hhmm(b).replace(":", "")}`));
  });
}

/** Vagas que devem ser avisadas agora. bloqueiosPorDia: { "AAAA-MM-DD": [{profissional, hora}] }. */
export function vagasDevidas(esperas, bloqueiosPorDia, profs, loja, agoraMs) {
  const out = [];
  for (const e of esperas) {
    if (!e.push || e.pushEm || !e.uid || !e.data || !e.hora) continue;
    const bl = bloqueiosPorDia[e.data];
    if (!bl) continue;                                                  // dia não consultado nesta rodada
    const ocupados = new Set(bl.map(b => `${b.profissional}_${b.hora}`));
    if (!vagaAberta(e, ocupados, profs, loja, agoraMs)) continue;
    out.push({ id: e.id, uid: e.uid, titulo: `Abriu o horário das ${e.hora}!`, texto: "O horário que você queria ficou livre. Toque para marcar antes que alguém pegue.", link: "agendar?vaga=" + encodeURIComponent(e.id), tag: "vaga_" + e.id });
  }
  return out;
}

// ---------- formato do Firestore (REST) ----------
export function deValor(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(deValor);
  if ("mapValue" in v) return deCampos(v.mapValue.fields || {});
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  return null;
}
export const deCampos = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, deValor(v)]));
export const deDoc = d => ({ id: d.name.split("/").pop(), ...deCampos(d.fields) });
