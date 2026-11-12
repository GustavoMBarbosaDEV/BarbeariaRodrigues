// =====================================================================
//  Regras da agenda: horários livres, reservar, cancelar e remarcar.
//
//  Como evitamos dois clientes no mesmo horário:
//  cada 15 minutos ocupados viram um documento em "bloqueios" com o id
//  <profissional>_<data>_<HHMM>. Reservar cria esses documentos junto com o
//  agendamento, tudo de uma vez. Se outro cliente já pegou um deles, a
//  gravação inteira falha (as regras do Firestore só deixam CRIAR, nunca
//  sobrescrever) e o app pede para escolher outro horário.
// =====================================================================
import { D } from "./dados.js";
import { S } from "./estado.js";
import { min, hhmm, hoje, diaSemana, iso } from "./util.js";

export const BLOCO = 15;

export const STATUS = {
  marcado: { t: "Aguardando confirmação", c: "aviso" },
  confirmado: { t: "Confirmado", c: "ok" },
  concluido: { t: "Concluído", c: "neutro" },
  cancelado: { t: "Cancelado", c: "perigo" },
  faltou: { t: "Não compareceu", c: "perigo" }
};
export const ATIVOS = ["marcado", "confirmado"];

/** Expediente do profissional no dia (o dele, ou o da barbearia). */
export function expediente(prof, data) {
  const dia = diaSemana(data);
  const h = (prof && prof.horario) || (S.loja && S.loja.horario) || {};
  const e = h[dia] ?? h[String(dia)];
  return e && e.abre && e.fecha ? e : null;
}
export const fazServico = (prof, servicoIds) => !prof.servicos || !prof.servicos.length || servicoIds.every(id => prof.servicos.includes(id));
export const profsAtivos = () => S.profissionais.filter(p => p.ativo !== false);

const chave = (prof, data, t) => `${prof}_${data}_${hhmm(t).replace(":", "")}`;
function blocos(inicioMin, dur) { const r = []; for (let t = inicioMin; t < inicioMin + dur; t += BLOCO) r.push(t); return r; }

/** Bloqueios de um dia (cada um: profissional, hora "HHMM", ag = id do agendamento ou null se for folga/pausa). */
export const bloqueiosDoDia = data => D.listar("bloqueios", [["data", "==", data]]);
export const conjunto = lista => new Set(lista.map(b => `${b.profissional}_${b.hora}`));
/** Lê os bloqueios de um dia: Set com "prof_HHMM". */
export async function ocupadosDoDia(data) { return conjunto(await bloqueiosDoDia(data)); }

/**
 * Horários livres num dia para uma duração.
 * Devolve [{hora:"09:00", profs:[ids que estão livres]}]
 */
export function livres(data, profs, duracao, ocupados) {
  const loja = S.loja || {};
  const passo = Number(loja.intervalo) || 30;
  const agora = new Date();
  const limite = data === hoje() ? agora.getHours() * 60 + agora.getMinutes() + (Number(loja.antecedenciaMin) || 0) : -1;
  if (data < hoje()) return [];
  const mapa = new Map();
  for (const p of profs) {
    const e = expediente(p, data);
    if (!e) continue;
    const abre = min(e.abre), fecha = min(e.fecha);
    const pausa = e.pausa && e.pausa[0] ? [min(e.pausa[0]), min(e.pausa[1])] : null;
    for (let t = abre; t + duracao <= fecha; t += passo) {
      if (t < limite) continue;
      if (pausa && t < pausa[1] && t + duracao > pausa[0]) continue;
      if (blocos(t, duracao).some(b => ocupados.has(`${p.id}_${hhmm(b).replace(":", "")}`))) continue;
      const k = hhmm(t);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(p.id);
    }
  }
  return [...mapa.entries()].sort((a, b) => min(a[0]) - min(b[0])).map(([hora, ps]) => ({ hora, profs: ps }));
}

/**
 * Grava o agendamento + os bloqueios de uma vez.
 * dados: { uid, clienteNome, clienteTelefone, servicos:[{id,nome,preco,duracao}], profissional, data, inicio, obs, status }
 */
export async function reservar(dados) {
  const id = D.novoId();
  const dur = dados.servicos.reduce((s, x) => s + Number(x.duracao || 0), 0);
  const total = dados.servicos.reduce((s, x) => s + Number(x.preco || 0), 0);
  const prof = S.profissional(dados.profissional);
  const ag = {
    uid: dados.uid, clienteNome: dados.clienteNome || "", clienteTelefone: dados.clienteTelefone || "",
    servicos: dados.servicos, duracao: dur, total,
    profissional: dados.profissional, profissionalNome: prof ? prof.nome : "",
    data: dados.data, inicio: dados.inicio, fim: hhmm(min(dados.inicio) + dur),
    status: dados.status || "marcado", obs: dados.obs || "", origem: dados.origem || "app",
    criadoEm: Date.now(), criadoPor: D.usuario ? D.usuario.uid : ""
  };
  const ops = [{ tipo: "criar", c: "agendamentos", id, dados: ag }];
  for (const t of blocos(min(dados.inicio), dur)) {
    ops.push({ tipo: "criar", c: "bloqueios", id: chave(dados.profissional, dados.data, t), dados: { profissional: dados.profissional, data: dados.data, hora: hhmm(t).replace(":", ""), uid: dados.uid, ag: id } });
  }
  await D.lote(ops);
  return { id, ...ag };
}

/** Libera os bloqueios e muda o status (cancelado / faltou). */
export async function liberar(ag, status, extra = {}) {
  const ops = [{ tipo: "salvar", c: "agendamentos", id: ag.id, dados: { status, atualizadoEm: Date.now(), ...extra } }];
  if (status === "cancelado") {
    for (const t of blocos(min(ag.inicio), ag.duracao)) ops.push({ tipo: "apagar", c: "bloqueios", id: chave(ag.profissional, ag.data, t) });
  }
  await D.lote(ops);
}

/** Até quantos minutos antes o cliente cancela sozinho (padrão 1h30). Aceita o ajuste antigo, que era em horas. */
export function cancelarAteMin(loja = S.loja) {
  const l = loja || {};
  if (l.cancelarAteMin != null) return Number(l.cancelarAteMin) || 0;
  if (l.cancelarAteHoras != null) return (Number(l.cancelarAteHoras) || 0) * 60;
  return 90;
}
/** Quantos minutos antes o cliente é lembrado do horário (padrão 2 h). */
export const lembreteMin = (loja = S.loja) => Number((loja || {}).lembreteMin ?? 120) || 0;
export function textoPrazo(m) { return !m ? "a qualquer momento" : m < 60 ? `${m} min antes` : m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")} antes` : `${m / 60} h antes`; }
/** Hora limite ("HH:MM") para o cliente cancelar aquele horário. */
export const limiteCancelar = ag => { const d = new Date(dataHora(ag).getTime() - cancelarAteMin() * 60000); return hhmm(d.getHours() * 60 + d.getMinutes()); };

/** Pode o cliente cancelar sozinho? (até X minutos antes) */
export function podeCancelar(ag) {
  if (!ATIVOS.includes(ag.status)) return false;
  return dataHora(ag).getTime() - Date.now() >= cancelarAteMin() * 60000;
}
export function dataHora(ag) { const [a, m, d] = ag.data.split("-").map(Number); return new Date(a, m - 1, d, ...ag.inicio.split(":").map(Number)); }
export const passou = ag => dataHora(ag).getTime() + (ag.duracao || 30) * 60000 < Date.now();

/** Bloqueia um período na agenda (folga, almoço extra, compromisso). */
export async function bloquearPeriodo(prof, data, inicio, fim, motivo) {
  const ocupados = await ocupadosDoDia(data);   // não mexe nos horários que já têm cliente
  const ops = [];
  for (let t = min(inicio); t < min(fim); t += BLOCO) if (!ocupados.has(`${prof}_${hhmm(t).replace(":", "")}`)) ops.push({ tipo: "criar", c: "bloqueios", id: chave(prof, data, t), dados: { profissional: prof, data, hora: hhmm(t).replace(":", ""), uid: D.usuario.uid, ag: null, motivo: motivo || "Bloqueado" } });
  if (ops.length) await D.lote(ops);
}
export async function desbloquear(lista) {
  await D.lote(lista.map(b => ({ tipo: "apagar", c: "bloqueios", id: b.id })));
}

/** Arquivo .ics: o celular cria o evento com lembrete 1 hora antes, mesmo com o app fechado. */
export function arquivoCalendario(ag) {
  const loja = S.loja || {};
  const z = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ini = dataHora(ag), fim = new Date(ini.getTime() + (ag.duracao || 30) * 60000);
  const txt = s => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const linhas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Barbearia Rodrigues//App//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${ag.id}@barbeariarodrigues`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(ini)}`, `DTEND:${z(fim)}`,
    `SUMMARY:${txt((ag.servicos || []).map(s => s.nome).join(" + ") + " — " + (loja.nome || "Barbearia"))}`,
    `LOCATION:${txt([loja.endereco, loja.cidade].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${txt("Com " + (ag.profissionalNome || "a equipe") + ". Para remarcar ou cancelar, use o app.")}`,
    "BEGIN:VALARM", `TRIGGER:-PT${lembreteMin() || 120}M`, "ACTION:DISPLAY", "DESCRIPTION:Seu horário na barbearia está chegando", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Amanhã tem barbearia", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([linhas.join("\r\n")], { type: "text/calendar" }));
  a.download = `horario-barbearia-${ag.data}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
}

// =====================================================================
//  Lista de espera
//  O cliente marca interesse num horário que já está ocupado. Se o horário
//  vagar, só quem marcou interesse naquele horário é avisado.
//  Documento: espera/<uid>_<data>_<HHMM>
// =====================================================================
export const idEspera = (uid, data, hora) => `${uid}_${data}_${hora.replace(":", "")}`;

/**
 * Horários ocupados por OUTRO CLIENTE (não por folga/pausa da barbearia) em que a
 * duração pedida caberia se o horário vagasse. Devolve ["09:00", ...].
 */
export function ocupadosParaEspera(data, profs, duracao, bloqs) {
  const loja = S.loja || {};
  const passo = Number(loja.intervalo) || 30;
  if (data < hoje()) return [];
  const agora = new Date();
  const limite = data === hoje() ? agora.getHours() * 60 + agora.getMinutes() : -1;
  const porChave = new Map(bloqs.map(b => [`${b.profissional}_${b.hora}`, b]));
  const horas = new Set();
  for (const p of profs) {
    const e = expediente(p, data);
    if (!e) continue;
    const abre = min(e.abre), fecha = min(e.fecha);
    const pausa = e.pausa && e.pausa[0] ? [min(e.pausa[0]), min(e.pausa[1])] : null;
    for (let t = abre; t + duracao <= fecha; t += passo) {
      if (t <= limite) continue;
      if (pausa && t < pausa[1] && t + duracao > pausa[0]) continue;
      const no = blocos(t, duracao).map(b => porChave.get(`${p.id}_${hhmm(b).replace(":", "")}`)).filter(Boolean);
      if (no.length && no.every(b => b.ag)) horas.add(hhmm(t));   // ocupado só por clientes: pode vagar
    }
  }
  return [...horas].sort((a, b) => min(a) - min(b));
}

/** O cliente entra na lista de espera de um horário ocupado. */
export async function entrarNaEspera({ data, hora, profissional = "", servicos = [], duracao = 30, push = false }) {
  const u = D.usuario, p = S.perfil || {};
  const id = idEspera(u.uid, data, hora);
  await D.salvar("espera", id, { uid: u.uid, clienteNome: p.nome || u.nome || "", clienteTelefone: p.telefone || "", data, hora, profissional, servicos, duracao: Number(duracao) || 30, push: !!push, criadoEm: Date.now() }, false);
  return id;
}
export const sairDaEspera = id => D.apagar("espera", id);

/** Profissionais que poderiam atender aquele interesse. */
export function profsDaEspera(e) {
  return profsAtivos().filter(p => (!e.profissional || p.id === e.profissional) && fazServico(p, e.servicos || []));
}
/** O horário daquele interesse está livre agora? Devolve o id do profissional livre, ou "". */
export function vagaAberta(e, ocupados) {
  if (dataHora({ data: e.data, inicio: e.hora }).getTime() <= Date.now()) return "";
  const t = min(e.hora), dur = Number(e.duracao) || 30;
  for (const p of profsDaEspera(e)) {
    const x = expediente(p, e.data);
    if (!x || t < min(x.abre) || t + dur > min(x.fecha)) continue;
    if (x.pausa && x.pausa[0] && t < min(x.pausa[1]) && t + dur > min(x.pausa[0])) continue;
    if (!blocos(t, dur).some(b => ocupados.has(`${p.id}_${hhmm(b).replace(":", "")}`))) return p.id;
  }
  return "";
}
/** Interessados num horário que acabou de vagar (para o barbeiro avisar). */
export function interessadosNaVaga(lista, ag) {
  return lista.filter(e => e.data === ag.data && (!e.profissional || e.profissional === ag.profissional)
    && min(e.hora) < min(ag.inicio) + Number(ag.duracao || 0) && min(ag.inicio) < min(e.hora) + Number(e.duracao || 30));
}

export const diasDisponiveis = (n = 30) => { const r = []; const d = new Date(); for (let i = 0; i < n; i++) { r.push(iso(d)); d.setDate(d.getDate() + 1); } return r; };
