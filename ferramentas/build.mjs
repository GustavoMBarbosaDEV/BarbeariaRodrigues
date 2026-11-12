// Monta dist/ para o Firebase Hosting a partir de uma lista fixa de arquivos e pastas.
// Nada fora da lista é publicado: nenhum .md, regra do banco, ferramenta, teste ou nota local vai para o ar.
// Uso: cd ferramentas && npm ci && node build.mjs
// Minifica os .js e .css com esbuild; o resto é copiado como está. O código na raiz continua legível.
// Arquivo novo no app? Ele entra sozinho se estiver numa das PASTAS; se for na raiz, acrescente em ARQUIVOS
// (e em ARQUIVOS do sw.js, para abrir sem internet).
import { transform } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");

const ARQUIVOS = ["index.html", "firebase-config.js", "manifest.webmanifest", "sw.js"];
const PASTAS = ["css", "js", "icons", "img", "fonts", "vendor", ".well-known"];
const SEM_MINIFICAR = /^vendor[\\/]/;      // já vem minificado

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

let antes = 0, depois = 0;
async function copia(rel) {
  const origem = path.join(raiz, rel), destino = path.join(dist, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const ext = path.extname(rel).slice(1);
  if ((ext === "js" || ext === "css") && !SEM_MINIFICAR.test(rel)) {
    const texto = fs.readFileSync(origem, "utf8");
    const r = await transform(texto, { loader: ext, minify: true, charset: "utf8", legalComments: "none", ...(ext === "js" ? { target: "es2020", format: rel === "sw.js" || rel === "firebase-config.js" || rel.endsWith("abertura.js") ? undefined : "esm" } : {}) });
    for (const w of r.warnings) console.warn(`${rel}: ${w.text}`);
    antes += Buffer.byteLength(texto); depois += Buffer.byteLength(r.code);
    fs.writeFileSync(destino, r.code);
  } else fs.copyFileSync(origem, destino);
}
function lista(rel) {
  return fs.readdirSync(path.join(raiz, rel), { withFileTypes: true }).flatMap(e => {
    const p = path.join(rel, e.name);
    return e.isDirectory() ? lista(p) : [p];
  });
}

for (const a of ARQUIVOS) {
  if (!fs.existsSync(path.join(raiz, a))) { console.error("Falta o arquivo:", a); process.exit(1); }
  await copia(a);
}
for (const p of PASTAS) if (fs.existsSync(path.join(raiz, p))) for (const a of lista(p)) await copia(a);

// confere se a versão é a mesma no app e no service worker
const v = (/export const VERSAO = "([0-9.]+)"/.exec(fs.readFileSync(path.join(raiz, "js/app.js"), "utf8")) || [])[1];
const vsw = (/const V = "([0-9.]+)"/.exec(fs.readFileSync(path.join(raiz, "sw.js"), "utf8")) || [])[1];
if (!v || v !== vsw) { console.error(`Versões desencontradas: js/app.js ${v} e sw.js ${vsw}. Rode: node bump.mjs X.Y.Z`); process.exit(1); }

// confere se todo .js e .css do app está na lista do service worker (senão não abre sem internet)
const sw = fs.readFileSync(path.join(raiz, "sw.js"), "utf8");
const fora = [...lista("js"), ...lista("css")].map(a => a.replace(/\\/g, "/")).filter(a => !sw.includes(`"${a}"`));
if (fora.length) { console.error("Faltam em ARQUIVOS do sw.js:", fora.join(", ")); process.exit(1); }

// não publica configuração vazia por engano
if (/COLE_AQUI/.test(fs.readFileSync(path.join(raiz, "firebase-config.js"), "utf8"))) console.warn("ATENÇÃO: firebase-config.js ainda está com COLE_AQUI. O site publicado abriria em modo demonstração.");

const total = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? total(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`dist/ pronta (versão ${v}): ${Math.round(total(dist) / 1024)} KiB no total; JS/CSS minificados ${Math.round(antes / 1024)} → ${Math.round(depois / 1024)} KiB.`);
