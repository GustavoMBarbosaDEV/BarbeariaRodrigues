// Gera vendor/firebase-<versão>/ a partir do pacote "firebase" do npm (versão fixa no package.json).
// Uso: cd ferramentas && npm ci && node vendor-firebase.mjs
// Assim o app não depende de nenhum site de terceiros para rodar (o SDK é servido do próprio endereço)
// e só as funções listadas abaixo entram no pacote.
// Mudou a lista MODULOS sem trocar a versão? Suba FB_REV em js/dados.js: vendor/ tem cache longo e o ?r= força o download novo.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const versao = JSON.parse(fs.readFileSync(path.join(aqui, "node_modules/firebase/package.json"), "utf8")).version;
const fbv = /const FB_V = "([0-9.]+)"/.exec(fs.readFileSync(path.join(raiz, "js/dados.js"), "utf8"));
if (!fbv || fbv[1] !== versao) {
  console.error(`FB_V em js/dados.js (${fbv && fbv[1]}) é diferente do firebase instalado (${versao}). Ajuste os dois juntos.`);
  process.exit(1);
}

// As mesmas funções que js/dados.js usa. Precisou de outra? Acrescente aqui e gere de novo.
const MODULOS = {
  "firebase-app": ["firebase/app", ["initializeApp"]],
  "firebase-auth": ["firebase/auth", ["getAuth", "onAuthStateChanged", "getRedirectResult", "signInWithPopup", "signInWithRedirect", "signOut", "GoogleAuthProvider", "reauthenticateWithPopup", "deleteUser"]],
  "firebase-firestore": ["firebase/firestore", ["initializeFirestore", "getFirestore", "persistentLocalCache", "persistentMultipleTabManager", "clearIndexedDbPersistence", "terminate",
    "collection", "doc", "getDoc", "getDocs", "setDoc", "deleteDoc", "onSnapshot", "query", "where", "writeBatch"]],
  "firebase-app-check": ["firebase/app-check", ["initializeAppCheck", "ReCaptchaEnterpriseProvider"]],
  "firebase-messaging": ["firebase/messaging", ["getMessaging", "getToken", "deleteToken", "isSupported"]]
};

const tmp = path.join(aqui, ".entradas");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp);
const entradas = {};
for (const [nome, [pacote, nomes]] of Object.entries(MODULOS)) {
  const arq = path.join(tmp, nome + ".mjs");
  fs.writeFileSync(arq, `export { ${nomes.join(", ")} } from "${pacote}";\n`);
  entradas[nome] = arq;
}

const destino = path.join(raiz, "vendor", "firebase-" + versao);
fs.rmSync(destino, { recursive: true, force: true });
await build({
  entryPoints: entradas,
  outdir: destino,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  chunkNames: "nucleo-[hash]",
  entryNames: "[name]",
  outExtension: { ".js": ".js" },
  nodePaths: [path.join(aqui, "node_modules")],
  logLevel: "warning"
});
const ler = (f) => { try { return fs.readFileSync(path.join(aqui, "node_modules", f), "utf8").trim(); } catch (e) { return "(licença no pacote original)"; } };
fs.writeFileSync(path.join(destino, "LICENSE"), [
  `Firebase JavaScript SDK ${versao} (pacotes firebase e @firebase/*), Copyright Google LLC.`,
  "Licenciado sob a Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0",
  "",
  "Também inclui:",
  "",
  "idb (ISC):", ler("idb/LICENSE"), "",
  "tslib (0BSD):", ler("tslib/LICENSE.txt"), ""
].join("\n"));
fs.rmSync(tmp, { recursive: true, force: true });

for (const f of fs.readdirSync(destino)) console.log(String(fs.statSync(path.join(destino, f)).size).padStart(8), f);
