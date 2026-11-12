// =====================================================================
//  Camada de dados
//  O resto do app só conversa com o objeto D. Por baixo ele usa:
//   - "nuvem": Firebase (login Google + Firestore), quando firebase-config.js está preenchido;
//   - "demo":  um banco de mentira guardado no próprio navegador, para testar sem Firebase.
//  Assim as telas são as mesmas nos dois modos.
// =====================================================================
import { ls, uid as novoId } from "./util.js";
import { dadosIniciais } from "./seed.js";

const FB_V = "13.3.0";          // versão do SDK em vendor/ (gerado por ferramentas/vendor-firebase.mjs)
const FB_REV = "1";            // suba quando gerar o vendor de novo sem trocar a versão (fura o cache)
const DEMO_KEY = "bc.demo.v1";
const DEMO_V = 3;             // mude quando o formato dos dados de exemplo mudar (recria a demonstração)
const DEMO_USER_KEY = "bc.demo.usuario";

let fb = null;                // funções do Firebase quando em modo nuvem
let ouvintesAuth = [];

export const D = {
  modo: "demo",               // "nuvem" | "demo"
  usuario: null,              // { uid, nome, email, foto }
  ehDono: false,              // dono/gerente: acesso total ao painel
  ehEquipe: false,            // dono OU barbeiro com login
  profId: "",                 // profissional ligado a este login ("" = nenhum)
  comissao: 0,                // % de comissão do profissional ligado
  perm: {},                   // o que o dono liberou para este barbeiro (veja PERMISSOES em js/caixa.js)
  /** O dono pode tudo; o barbeiro, só o que o dono liberou. */
  pode: k => D.ehDono || (D.ehEquipe && !!D.perm[k]),
  pronto: false,

  aoMudarUsuario(fn) { ouvintesAuth.push(fn); },

  async iniciar() {
    const cfg = window.FIREBASE_CONFIG;
    if (cfg && cfg.apiKey && !/COLE|SUA_/i.test(cfg.apiKey)) {
      try { await iniciaNuvem(cfg); return; }
      catch (e) { console.error("Firebase não carregou, usando demonstração:", e); }
    }
    iniciaDemo();
  },

  entrarGoogle: () => fb ? entrarGoogleNuvem() : Promise.reject(new Error("Firebase não configurado")),
  entrarDemo(papel) {
    const u = papel === "dono" ? { uid: "demo-dono", nome: "Dono (demonstração)", email: "dono@demo", foto: "" }
      : papel === "barbeiro" ? { uid: "demo-barbeiro", nome: "Barbeiro (demonstração)", email: "barbeiro@demo", foto: "" }
      : { uid: "demo-cliente", nome: "", email: "cliente@demo", foto: "" };
    ls.set(DEMO_USER_KEY, u);
    trocaUsuario(u, papelDemo(u));
  },
  async sair() {
    if (D.modo !== "nuvem") { ls.del(DEMO_USER_KEY); trocaUsuario(null, null); return; }
    await fb.signOut(fb.auth);
    await limpaAparelho();
    location.reload();
  },
  /** Apaga a conta de login (LGPD: "excluir minha conta"). Os dados do cadastro são apagados antes, pela tela do Perfil. */
  async apagarConta() {
    if (D.modo !== "nuvem") return D.sair();
    const u = fb.auth.currentUser;
    if (u) {
      try { await fb.deleteUser(u); }
      catch (e) {
        if (!/requires-recent-login/.test(e.code || "")) throw e;
        await fb.reauthenticateWithPopup(u, new fb.GoogleAuthProvider());   // o Google pede para confirmar quem é antes de apagar
        await fb.deleteUser(u);
      }
    }
    await limpaAparelho();
    location.reload();
  },
  /** Endereço deste aparelho para receber aviso com o app fechado ("" se o navegador não permite). */
  async tokenPush(chavePublica) {
    if (!fb) return "";
    const M = await import(`${fb.base}firebase-messaging.js?r=${FB_REV}`);
    if (!(await M.isSupported())) return "";
    const reg = await navigator.serviceWorker.ready;
    return M.getToken(M.getMessaging(fb.app), { vapidKey: chavePublica, serviceWorkerRegistration: reg });
  },
  /** Apaga todos os dados da demonstração e volta ao começo. */
  zerarDemo() { ls.del(DEMO_KEY); ls.del(DEMO_USER_KEY); location.reload(); },

  // ---------- leitura ----------
  pegar: (c, id) => (D.modo === "nuvem" ? nuvem : demo).pegar(c, id),
  listar: (c, filtros = []) => (D.modo === "nuvem" ? nuvem : demo).listar(c, filtros),
  /** Escuta uma coleção; devolve a função para parar de escutar. */
  ouvir: (c, filtros, cb, erro) => (D.modo === "nuvem" ? nuvem : demo).ouvir(c, filtros || [], cb, erro),
  ouvirDoc: (c, id, cb, erro) => (D.modo === "nuvem" ? nuvem : demo).ouvirDoc(c, id, cb, erro),

  // ---------- escrita ----------
  criar: (c, dados) => (D.modo === "nuvem" ? nuvem : demo).criar(c, dados),
  salvar: (c, id, dados, merge = true) => (D.modo === "nuvem" ? nuvem : demo).salvar(c, id, dados, merge),
  apagar: (c, id) => (D.modo === "nuvem" ? nuvem : demo).apagar(c, id),
  /** Várias gravações de uma vez (tudo ou nada). ops: [{tipo:"criar"|"salvar"|"apagar", c, id, dados}] */
  lote: ops => (D.modo === "nuvem" ? nuvem : demo).lote(ops),
  novoId
};

/** papel: { dono: bool, prof: "id do profissional" | "", comissao: número, perm: {…} } */
function trocaUsuario(u, papel) {
  const p = papel || {};
  D.usuario = u; D.ehDono = !!p.dono; D.profId = p.prof || ""; D.comissao = Number(p.comissao) || 0; D.perm = p.perm || {};
  D.ehEquipe = D.ehDono || !!D.profId; D.pronto = true;
  ouvintesAuth.forEach(f => { try { f(u); } catch (e) { console.error(e); } });
}

/** Mensagens de erro do Firebase em português. */
export function traduzErro(e) {
  const c = (e && (e.code || e.message)) || "";
  if (/permission-denied|insufficient permissions/i.test(c)) return "Sem permissão para essa ação.";
  if (/unauthorized-domain/.test(c)) return "Este endereço ainda não foi autorizado no Firebase (Authentication → Domínios autorizados).";
  if (/popup-closed|cancelled-popup/.test(c)) return "Login cancelado.";
  if (/network|unavailable|offline/i.test(c)) return "Sem conexão. Tente de novo em instantes.";
  if (/already-exists|HORARIO_OCUPADO/.test(c)) return "Esse horário acabou de ser ocupado. Escolha outro.";
  if (/CPF_EM_USO/.test(c)) return "Este CPF já está cadastrado em outra conta.";
  return (e && e.message) || "Algo deu errado. Tente de novo.";
}

// =====================================================================
//  Modo NUVEM (Firebase)
// =====================================================================
async function iniciaNuvem(cfg) {
  // O SDK vem da pasta vendor/ do próprio site: o app não depende de nenhum outro endereço para abrir.
  const base = new URL(`../vendor/firebase-${FB_V}/`, import.meta.url).href;
  const mod = nome => import(`${base}${nome}.js?r=${FB_REV}`);
  const [A, U, F] = await Promise.all([mod("firebase-app"), mod("firebase-auth"), mod("firebase-firestore")]);
  const app = A.initializeApp(cfg);
  // App Check: só o app verdadeiro (neste endereço) consegue falar com o banco. Liga quando houver a chave.
  if (window.APPCHECK_SITE_KEY) {
    try {
      if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      const C = await mod("firebase-app-check");
      C.initializeAppCheck(app, { provider: new C.ReCaptchaEnterpriseProvider(window.APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    } catch (e) { console.warn("App Check não iniciou", e); }
  }
  const auth = U.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }
  fb = { ...U, ...F, auth, db, app, base };
  D.modo = "nuvem";
  U.getRedirectResult(auth).catch(e => console.warn(e));
  await new Promise(pronto => {
    U.onAuthStateChanged(auth, async user => {
      if (!user) { trocaUsuario(null, null); return pronto(); }
      const u = { uid: user.uid, nome: user.displayName || "", email: user.email || "", foto: user.photoURL || "" };
      trocaUsuario(u, await papelNuvem(F, db, u.email.toLowerCase()));
      pronto();
    });
  });
}

/**
 * Quem é esta pessoa? As regras do Firestore decidem, o app só pergunta:
 *  - dono: só ele consegue ler config/admins;
 *  - barbeiro: existe acessos/<e-mail> apontando para o profissional dele.
 */
async function papelNuvem(F, db, email) {
  const papel = { dono: false, prof: "", comissao: 0, perm: {} };
  try { await F.getDoc(F.doc(db, "config", "admins")); papel.dono = true; } catch (e) { papel.dono = false; }
  if (!email) return papel;
  try {
    const a = await F.getDoc(F.doc(db, "acessos", email));
    if (a.exists()) {
      papel.prof = a.data().prof || ""; papel.perm = a.data().perm || {};
      const q = papel.prof ? await F.getDoc(F.doc(db, "equipe", papel.prof)) : null;
      if (q && q.exists()) papel.comissao = Number(q.data().comissao) || 0;
    }
  } catch (e) { /* sem acesso = cliente comum */ }
  return papel;
}

/** Ao sair, não deixa dados da pessoa neste aparelho (cópia local do banco, avisos vistos, carrinho). */
async function limpaAparelho() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (/^bc.(notif|push|carrinho|visao)/.test(k)) localStorage.removeItem(k); }
  } catch (e) { }
  try { await fb.terminate(fb.db); await fb.clearIndexedDbPersistence(fb.db); } catch (e) { console.warn(e); }
}

async function entrarGoogleNuvem() {
  const p = new fb.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  try { await fb.signInWithPopup(fb.auth, p); }
  catch (e) {
    const c = e.code || "";
    if (c.includes("popup-blocked") || c.includes("operation-not-supported")) return fb.signInWithRedirect(fb.auth, p);
    throw e;
  }
}

const ref = (c, id) => fb.doc(fb.db, ...c.split("/"), id);
const col = c => fb.collection(fb.db, ...c.split("/"));
const OPS = { "==": "==", "!=": "!=", ">=": ">=", "<=": "<=", ">": ">", "<": "<", "in": "in", "contem": "array-contains" };
function consulta(c, filtros) {
  return filtros.length ? fb.query(col(c), ...filtros.map(([k, op, v]) => fb.where(k, OPS[op], v))) : col(c);
}
const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

const nuvem = {
  async pegar(c, id) { const s = await fb.getDoc(ref(c, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
  async listar(c, filtros) { return docs(await fb.getDocs(consulta(c, filtros))); },
  ouvir(c, filtros, cb, erro) { return fb.onSnapshot(consulta(c, filtros), s => cb(docs(s)), e => { console.error(c, e); erro?.(e); }); },
  ouvirDoc(c, id, cb, erro) { return fb.onSnapshot(ref(c, id), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), e => { console.error(c, id, e); erro?.(e); }); },
  async criar(c, dados) { const r = fb.doc(col(c)); await fb.setDoc(r, dados); return r.id; },
  salvar(c, id, dados, merge) { return fb.setDoc(ref(c, id), dados, { merge }); },
  apagar(c, id) { return fb.deleteDoc(ref(c, id)); },
  async lote(ops) {
    const b = fb.writeBatch(fb.db);
    for (const o of ops) {
      // "criar" usa set sem merge; as regras só permitem CRIAR (não sobrescrever) onde importa, como em bloqueios
      if (o.tipo === "criar") b.set(ref(o.c, o.id), o.dados);
      else if (o.tipo === "salvar") b.set(ref(o.c, o.id), o.dados, { merge: true });
      else if (o.tipo === "apagar") b.delete(ref(o.c, o.id));
    }
    try { await b.commit(); }
    catch (e) {
      if (ops.some(o => o.c === "bloqueios" && o.tipo === "criar") && /permission/i.test(e.code || "")) { const x = new Error("HORARIO_OCUPADO"); x.code = "HORARIO_OCUPADO"; throw x; }
      throw e;
    }
  }
};

// =====================================================================
//  Modo DEMONSTRAÇÃO (tudo no navegador)
// =====================================================================
let banco = null;
const ouvintes = new Set();

function iniciaDemo() {
  D.modo = "demo";
  banco = ls.get(DEMO_KEY);
  if (!banco || banco.v !== DEMO_V) { banco = { v: DEMO_V, c: dadosIniciais() }; grava(); }
  const u = ls.get(DEMO_USER_KEY);
  trocaUsuario(u, papelDemo(u));
}
function papelDemo(u) {
  if (!u) return null;
  const a = (banco.c.acessos || {})[u.email];
  const prof = a ? a.prof : "";
  return { dono: u.uid === "demo-dono", prof, comissao: prof ? ((banco.c.equipe || {})[prof] || {}).comissao : 0, perm: (a && a.perm) || {} };
}
function grava() { ls.set(DEMO_KEY, banco); }
const colecao = c => (banco.c[c] ||= {});
const copia = o => JSON.parse(JSON.stringify(o));

function passa(doc, filtros) {
  return filtros.every(([k, op, v]) => {
    const x = k.split(".").reduce((o, p) => (o == null ? o : o[p]), doc);
    switch (op) {
      case "==": return x === v;
      case "!=": return x !== v;
      case ">=": return x >= v;
      case "<=": return x <= v;
      case ">": return x > v;
      case "<": return x < v;
      case "in": return v.includes(x);
      case "contem": return Array.isArray(x) && x.includes(v);
      default: return true;
    }
  });
}
function avisa(c) {
  grava();
  // como nos dados reais, as telas recebem a mudança logo depois (assíncrono)
  setTimeout(() => ouvintes.forEach(o => { if (o.c === c) o.disparar(); }), 0);
}
const lista = (c, filtros) => Object.entries(colecao(c)).map(([id, d]) => ({ id, ...copia(d) })).filter(d => passa(d, filtros));

const demo = {
  async pegar(c, id) { const d = colecao(c)[id]; return d ? { id, ...copia(d) } : null; },
  async listar(c, filtros) { return lista(c, filtros); },
  ouvir(c, filtros, cb) {
    const o = { c, disparar: () => cb(lista(c, filtros)) };
    ouvintes.add(o); setTimeout(o.disparar, 0);
    return () => ouvintes.delete(o);
  },
  ouvirDoc(c, id, cb) {
    const o = { c, disparar: () => { const d = colecao(c)[id]; cb(d ? { id, ...copia(d) } : null); } };
    ouvintes.add(o); setTimeout(o.disparar, 0);
    return () => ouvintes.delete(o);
  },
  async criar(c, dados) { const id = novoId(); colecao(c)[id] = copia(dados); avisa(c); return id; },
  async salvar(c, id, dados, merge) { const atual = colecao(c)[id]; colecao(c)[id] = merge && atual ? { ...atual, ...copia(dados) } : copia(dados); avisa(c); },
  async apagar(c, id) { delete colecao(c)[id]; avisa(c); },
  async lote(ops) {
    // confere antes de gravar: "criar" num documento que já existe falha (igual às regras da nuvem para bloqueios)
    for (const o of ops) if (o.tipo === "criar" && o.c === "bloqueios" && colecao(o.c)[o.id]) { const e = new Error("HORARIO_OCUPADO"); e.code = "HORARIO_OCUPADO"; throw e; }
    for (const o of ops) if (o.tipo === "criar" && o.c === "cpfs" && colecao(o.c)[o.id] && colecao(o.c)[o.id].uid !== o.dados.uid) { const e = new Error("CPF_EM_USO"); e.code = "CPF_EM_USO"; throw e; }
    const mexidas = new Set();
    for (const o of ops) {
      if (o.tipo === "apagar") delete colecao(o.c)[o.id];
      else if (o.tipo === "salvar") colecao(o.c)[o.id] = { ...(colecao(o.c)[o.id] || {}), ...copia(o.dados) };
      else colecao(o.c)[o.id] = copia(o.dados);
      mexidas.add(o.c);
    }
    mexidas.forEach(avisa);
  }
};
