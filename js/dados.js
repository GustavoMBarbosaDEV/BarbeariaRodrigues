// =====================================================================
//  Camada de dados
//  O resto do app só conversa com o objeto D. Por baixo ele usa:
//   - "nuvem": Firebase (login Google + Firestore), quando firebase-config.js está preenchido;
//   - "demo":  um banco de mentira guardado no próprio navegador, para testar sem Firebase.
//  Assim as telas são as mesmas nos dois modos.
// =====================================================================
import { ls, uid as novoId } from "./util.js";
import { dadosIniciais } from "./seed.js";

const FB_V = "10.12.2";
const DEMO_KEY = "br.demo.v1";
const DEMO_USER_KEY = "br.demo.usuario";

let fb = null;                // funções do Firebase quando em modo nuvem
let ouvintesAuth = [];

export const D = {
  modo: "demo",               // "nuvem" | "demo"
  usuario: null,              // { uid, nome, email, foto }
  ehDono: false,
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
    const u = papel === "dono"
      ? { uid: "demo-dono", nome: "Dono (demonstração)", email: "dono@demo", foto: "" }
      : { uid: "demo-cliente", nome: "", email: "cliente@demo", foto: "" };
    ls.set(DEMO_USER_KEY, u);
    trocaUsuario(u, papel === "dono");
  },
  async sair() {
    if (D.modo === "nuvem") await fb.signOut(fb.auth);
    else { ls.del(DEMO_USER_KEY); trocaUsuario(null, false); }
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

function trocaUsuario(u, dono) {
  D.usuario = u; D.ehDono = !!dono; D.pronto = true;
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
  const base = `https://www.gstatic.com/firebasejs/${FB_V}/`;
  const [A, U, F] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]);
  const app = A.initializeApp(cfg);
  const auth = U.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }
  fb = { ...U, ...F, auth, db };
  D.modo = "nuvem";
  U.getRedirectResult(auth).catch(e => console.warn(e));
  await new Promise(pronto => {
    U.onAuthStateChanged(auth, async user => {
      if (!user) { trocaUsuario(null, false); return pronto(); }
      const u = { uid: user.uid, nome: user.displayName || "", email: user.email || "", foto: user.photoURL || "" };
      // É dono? Só quem é dono consegue ler config/admins (as regras do Firestore decidem).
      let dono = false;
      try { await F.getDoc(F.doc(db, "config", "admins")); dono = true; } catch (e) { dono = false; }
      trocaUsuario(u, dono);
      pronto();
    });
  });
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
  if (!banco || !banco.v) { banco = { v: 1, c: dadosIniciais() }; grava(); }
  const u = ls.get(DEMO_USER_KEY);
  trocaUsuario(u, u && u.uid === "demo-dono");
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
