// Troca a versão do app nos lugares que dependem dela.
// Uso: cd ferramentas && node bump.mjs 1.4.1
//   js/app.js  export const VERSAO = "X.Y.Z"
//   sw.js      const V = "X.Y.Z"   (nome do cache)
// O CHANGELOG.md continua à mão.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nova = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(nova || "")) { console.error("Uso: node bump.mjs X.Y.Z"); process.exit(1); }

function troca(arquivo, re, novo) {
  const f = path.join(raiz, arquivo);
  const t = fs.readFileSync(f, "utf8");
  const n = (t.match(re) || []).length;
  if (n !== 1) { console.error(`${arquivo}: esperava 1 ocorrência de ${re}, achei ${n}. Nada foi alterado.`); process.exit(1); }
  return () => { fs.writeFileSync(f, t.replace(re, novo)); console.log("atualizado:", arquivo); };
}

const gravar = [
  troca("js/app.js", /export const VERSAO = "\d+\.\d+\.\d+";/g, `export const VERSAO = "${nova}";`),
  troca("sw.js", /const V = "\d+\.\d+\.\d+";/g, `const V = "${nova}";`)
];
gravar.forEach((g) => g());
console.log(`Versão ${nova}. Falta escrever a entrada no CHANGELOG.md.`);
