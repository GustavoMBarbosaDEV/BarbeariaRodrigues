// =====================================================================
//  Serviço de avisos da Barbearia Rodrigues (Cloudflare Workers, plano grátis)
//  Roda sozinho a cada 5 minutos e envia, para o celular do cliente, mesmo com o app fechado:
//   - o lembrete do horário (2 h antes, com o prazo para cancelar);
//   - "abriu o horário que você queria" para quem está na lista de espera.
//  Lê e marca no Firestore com uma conta de serviço (segredo CONTA_SERVICO) e envia pelo
//  Firebase Cloud Messaging. Não guarda nada: quem já foi avisado fica marcado no próprio banco.
//
//  Limites do plano grátis que este código respeita:
//   - 50 chamadas a outros endereços por execução  -> no máximo MAX_AVISOS por rodada (o resto sai na próxima);
//   - 10 ms de processamento por execução          -> a credencial do Google é assinada 1 vez por hora e reaproveitada.
//  Como publicar: veja avisos-worker/LEIAME.md.
// =====================================================================
import { relogio, somaDias, lembretesDevidos, vagasDevidas, deDoc } from "./logica.js";

const MAX_AVISOS = 8;
const ESCOPOS = "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging";
let credencial = null;      // { token, ate } — vive enquanto a Cloudflare mantiver este processo no ar

export default {
  async scheduled(evento, env, ctx) { ctx.waitUntil(rodada(env)); },
  // Abrir o endereço do worker só diz que ele existe. Nada é disparado por fora: só o relógio da Cloudflare chama a rodada.
  async fetch() { return new Response("Serviço de avisos da Barbearia Rodrigues: no ar.", { headers: { "content-type": "text/plain; charset=utf-8" } }); }
};

export async function rodada(env, agoraMs = Date.now()) {
  const conta = JSON.parse(env.CONTA_SERVICO);
  const projeto = env.PROJETO || conta.project_id;
  const token = await acesso(conta);
  const fs = `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents`;
  const chama = (url, corpo, metodo = "POST") => fetch(url, { method: metodo, headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const entre = (colecao, campo, de, ate) => chama(fs + ":runQuery", { structuredQuery: { from: [{ collectionId: colecao }], limit: 300, where: { compositeFilter: { op: "AND", filters: [
    { fieldFilter: { field: { fieldPath: campo }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: de } } },
    { fieldFilter: { field: { fieldPath: campo }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: ate } } }] } } })
    .then(r => r.json()).then(l => (Array.isArray(l) ? l : []).filter(x => x.document).map(x => deDoc(x.document)));
  const lista = colecao => chama(`${fs}/${colecao}?pageSize=100`, null, "GET").then(r => r.json()).then(j => (j.documents || []).map(deDoc));
  const pega = caminho => chama(`${fs}/${caminho}`, null, "GET").then(r => r.ok ? r.json().then(deDoc) : null);
  const marca = (caminho, campo) => chama(`${fs}/${caminho}?updateMask.fieldPaths=${campo}&currentDocument.exists=true`, { fields: { [campo]: { integerValue: String(agoraMs) } } }, "PATCH");

  const hoje = relogio(agoraMs).data;
  const [loja, ags, esperas] = await Promise.all([pega("config/loja"), entre("agendamentos", "data", hoje, somaDias(hoje, 1)), entre("espera", "data", hoje, somaDias(hoje, 30))]);

  const avisos = lembretesDevidos(ags, agoraMs, loja).map(a => ({ ...a, doc: "agendamentos/" + a.id, campo: "lembreteEm" }));
  const pendentes = esperas.filter(e => e.push && !e.pushEm);
  if (pendentes.length && avisos.length < MAX_AVISOS) {
    const dias = [...new Set(pendentes.map(e => e.data))].sort().slice(0, 3);
    const [profs, ...bloqs] = await Promise.all([lista("profissionais"), ...dias.map(d => entre("bloqueios", "data", d, d))]);
    const porDia = Object.fromEntries(dias.map((d, i) => [d, bloqs[i]]));
    avisos.push(...vagasDevidas(pendentes, porDia, profs, loja, agoraMs).map(a => ({ ...a, doc: "espera/" + a.id, campo: "pushEm" })));
  }

  let enviados = 0;
  for (const a of avisos.slice(0, MAX_AVISOS)) {
    const p = await pega("push/" + a.uid);
    const tokens = ((p && p.tokens) || []).slice(0, 2);
    for (const t of tokens) {
      const r = await chama(`https://fcm.googleapis.com/v1/projects/${projeto}/messages:send`, { message: { token: t, data: { titulo: a.titulo, texto: a.texto, link: a.link, tag: a.tag }, webpush: { headers: { Urgency: "high", TTL: "3600" } } } });
      if (r.ok) enviados++;
    }
    await marca(a.doc, a.campo);      // marca mesmo sem aparelho cadastrado, para não tentar de novo a cada 5 minutos
  }
  return { avisos: avisos.length, enviados };
}

// ---------- credencial do Google (conta de serviço -> token de 1 hora) ----------
async function acesso(conta) {
  const agora = Math.floor(Date.now() / 1000);
  if (credencial && credencial.ate - 120 > agora) return credencial.token;
  const b64 = dado => btoa(String.fromCharCode(...new Uint8Array(dado))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const txt = o => b64(new TextEncoder().encode(JSON.stringify(o)));
  const base = txt({ alg: "RS256", typ: "JWT" }) + "." + txt({ iss: conta.client_email, scope: ESCOPOS, aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 });
  const pem = conta.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const chave = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(base)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + base + "." + assinatura });
  if (!r.ok) throw new Error("Google recusou a conta de serviço: " + r.status);
  const j = await r.json();
  credencial = { token: j.access_token, ate: agora + Number(j.expires_in || 3600) };
  return credencial.token;
}
