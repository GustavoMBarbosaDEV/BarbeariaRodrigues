// Copia as fontes (Inter e Playfair Display) do npm para fonts/ e gera css/fontes.css.
// Uso: cd ferramentas && npm ci && node fontes.mjs
// As fontes ficam no próprio site: nada é pedido ao Google Fonts (privacidade e uma regra a menos na CSP).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const FONTES = [
  ["@fontsource-variable/inter", "inter-latin-wght-normal.woff2", "Inter", "100 900"],
  ["@fontsource-variable/playfair-display", "playfair-display-latin-wght-normal.woff2", "Playfair Display", "400 900"]
];
const versao = JSON.parse(fs.readFileSync(path.join(aqui, "node_modules", FONTES[0][0], "package.json"), "utf8")).version;
const pasta = "fonts/fontsource-variable-" + versao;
fs.mkdirSync(path.join(raiz, pasta), { recursive: true });

let css = "/* Gerado por ferramentas/fontes.mjs. Fontes servidas do próprio site (licença SIL OFL 1.1, veja fonts/). */\n";
for (const [pacote, arquivo, familia, pesos] of FONTES) {
  fs.copyFileSync(path.join(aqui, "node_modules", pacote, "files", arquivo), path.join(raiz, pasta, arquivo));
  fs.copyFileSync(path.join(aqui, "node_modules", pacote, "LICENSE"), path.join(raiz, pasta, "LICENSE-" + familia.replace(/\s+/g, "-") + ".txt"));
  css += `@font-face { font-family: "${familia}"; font-style: normal; font-display: swap; font-weight: ${pesos}; src: url("../${pasta}/${arquivo}") format("woff2-variations"); }\n`;
}
fs.writeFileSync(path.join(raiz, "css/fontes.css"), css);
console.log("fontes em", pasta, "e css/fontes.css gerado");
