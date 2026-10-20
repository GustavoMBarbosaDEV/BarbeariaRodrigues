// =====================================================================
//  Barbearia Rodrigues — app
//  Ponto de partida: liga os dados, monta a moldura (topo + abas) e troca
//  de tela conforme o endereço (#/inicio, #/agendar, #/dono/agenda ...).
// =====================================================================
import { D, traduzErro } from "./dados.js";
import { S } from "./estado.js";
import { $, esc, icone, toast, ls } from "./util.js";
import { N } from "./notificacoes.js";

export const VERSAO = "1.0.0";

// ---------- Tema ----------
export function aplicaTema(t = ls.get("br.tema", "escuro")) {
  const escuro = t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
  $('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0d0b09" : "#f6f1ea");
}
export function trocaTema(t) { ls.set("br.tema", t); aplicaTema(t); }
aplicaTema();

// ---------- Rotas ----------
// login: precisa estar logado | perfil: precisa ter o cadastro completo | dono: só o dono
const ROTAS = {
  "inicio": { m: "./cliente/inicio.js" },
  "servicos": { m: "./cliente/servicos.js" },
  "galeria": { m: "./cliente/galeria.js" },
  "shop": { m: "./cliente/shop.js" },
  "entrar": { m: "./cliente/entrar.js", semAbas: true },
  "agendar": { m: "./cliente/agendar.js", login: true, perfil: true },
  "horarios": { m: "./cliente/horarios.js", login: true },
  "carrinho": { m: "./cliente/carrinho.js", login: true, perfil: true },
  "perfil": { m: "./cliente/perfil.js", login: true },
  "notificacoes": { m: "./cliente/notificacoes.js", login: true },
  "privacidade": { m: "./cliente/privacidade.js" },
  "dono/agenda": { m: "./dono/agenda.js", dono: true },
  "dono/clientes": { m: "./dono/clientes.js", dono: true },
  "dono/cliente": { m: "./dono/cliente.js", dono: true },
  "dono/estoque": { m: "./dono/estoque.js", dono: true },
  "dono/pedidos": { m: "./dono/pedidos.js", dono: true },
  "dono/servicos": { m: "./dono/servicos.js", dono: true },
  "dono/equipe": { m: "./dono/equipe.js", dono: true },
  "dono/relatorios": { m: "./dono/relatorios.js", dono: true },
  "dono/avisos": { m: "./dono/avisos.js", dono: true },
  "dono/galeria": { m: "./dono/galeria.js", dono: true },
  "dono/ajustes": { m: "./dono/ajustes.js", dono: true },
  "dono/mais": { m: "./dono/mais.js", dono: true }
};

const ABAS_CLIENTE = [
  ["inicio", "casa", "Início"], ["agendar", "calendario", "Agendar"], ["horarios", "relogio", "Horários"],
  ["shop", "sacola", "Shop"], ["perfil", "usuario", "Perfil"]
];
const ABAS_DONO = [
  ["dono/agenda", "calendario", "Agenda"], ["dono/clientes", "usuarios", "Clientes"], ["dono/estoque", "caixa", "Estoque"],
  ["dono/pedidos", "sacola", "Pedidos"], ["dono/mais", "menu", "Mais"]
];

let visao = ls.get("br.visao", "dono");   // o dono pode alternar entre o painel e o app do cliente
let limpaTela = null;
let rotaAtual = "";
let navId = 0;           // cada navegação ganha um número; uma tela antiga que termina de carregar depois é descartada

export function lerRota() {
  const h = location.hash.replace(/^#\/?/, "");
  const [caminho, busca = ""] = h.split("?");
  const partes = caminho.split("/").filter(Boolean);
  let nome = partes[0] === "dono" ? partes.slice(0, 2).join("/") : partes[0];
  const param = partes[0] === "dono" ? partes[2] : partes[1];
  return { nome: nome || "", param: param ? decodeURIComponent(param) : "", q: new URLSearchParams(busca) };
}
export const ir = (r) => { location.hash = "#/" + r; };

function rotaPadrao() { return D.ehDono && visao === "dono" ? "dono/agenda" : "inicio"; }

async function navega() {
  const meu = ++navId;
  const r = lerRota();
  if (!r.nome || !ROTAS[r.nome]) return ir(rotaPadrao());
  const def = ROTAS[r.nome];
  if ((def.login || def.dono) && !D.usuario) return ir("entrar?volta=" + encodeURIComponent(location.hash.slice(2)));
  if (def.dono && !D.ehDono) return ir("inicio");
  if (def.perfil && !D.ehDono && S.perfilCarregado && !S.perfilCompleto()) return ir("perfil?completar=1&volta=" + encodeURIComponent(location.hash.slice(2)));
  if (def.perfil && !D.ehDono && !S.perfilCarregado) { await esperaPerfil(); if (meu !== navId) return; if (!S.perfilCompleto()) return ir("perfil?completar=1&volta=" + encodeURIComponent(location.hash.slice(2))); }
  if (r.nome.startsWith("dono/")) { visao = "dono"; ls.set("br.visao", visao); }
  else if (D.ehDono && r.nome !== "notificacoes") { visao = "app"; ls.set("br.visao", visao); }

  document.querySelectorAll(".modal-fundo, .lightbox").forEach(x => x.remove());   // não deixa janela aberta ao trocar de tela
  try { limpaTela?.(); } catch (e) { console.error(e); }
  limpaTela = null;
  rotaAtual = r.nome;
  montaMoldura(def);
  const el = $("#tela");
  el.innerHTML = `<div class="carregando"><span></span></div>`;
  try {
    const mod = await import(def.m);
    if (meu !== navId) return;
    el.innerHTML = "";
    el.className = "tela tela-" + r.nome.replace("/", "-");
    const limpa = (await mod.tela(el, r)) || null;
    if (meu !== navId) { try { limpa?.(); } catch (e) { } return; }
    limpaTela = limpa;
    window.scrollTo(0, 0);
    el.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="vazio">${icone("alerta")}<strong>Não foi possível abrir esta tela.</strong><p>${esc(traduzErro(e))}</p><button class="btn" onclick="location.reload()">Recarregar</button></div>`;
  }
}
function esperaPerfil() {
  return new Promise(ok => { if (S.perfilCarregado) return ok(); const p = S.ao(q => { if (q === "perfil" && S.perfilCarregado) { p(); ok(); } }); setTimeout(ok, 4000); });
}

// ---------- Moldura: topo + abas ----------
function montaMoldura(def) {
  const app = $("#app");
  const abas = D.ehDono && visao === "dono" ? ABAS_DONO : ABAS_CLIENTE;
  if (!$("#tela")) {
    app.innerHTML = `
      <a class="pular" href="#tela">Pular para o conteúdo</a>
      <header class="topo">
        <a class="marca" href="#/${rotaPadrao()}" aria-label="Início"><img src="img/logo.png" alt="" width="40" height="40"><span><b>Barbearia Rodrigues</b><small id="subtitulo"></small></span></a>
        <div class="topo-acoes">
          <button class="chip-visao" id="btnVisao" hidden></button>
          <a class="icone-btn sino" href="#/notificacoes" id="btnSino" aria-label="Notificações" hidden>${icone("sino")}<i class="badge" hidden></i></a>
          <a class="btn mini" href="#/entrar" id="btnEntrar" hidden>Entrar</a>
        </div>
      </header>
      <nav class="abas" id="abas" aria-label="Menu principal"></nav>
      <main class="tela" id="tela" tabindex="-1"></main>`;
    $("#btnVisao").addEventListener("click", () => { visao = visao === "dono" ? "app" : "dono"; ls.set("br.visao", visao); ir(visao === "dono" ? "dono/agenda" : "inicio"); });
  }
  document.body.classList.toggle("sem-abas", !!def.semAbas);
  document.body.classList.toggle("modo-dono", D.ehDono && visao === "dono");
  $("#abas").innerHTML = abas.map(([r, ic, t]) => `<a href="#/${r}" class="${rotaAtual === r || (r === "dono/mais" && ["dono/servicos", "dono/equipe", "dono/relatorios", "dono/avisos", "dono/galeria", "dono/ajustes"].includes(rotaAtual)) || (r === "dono/clientes" && rotaAtual === "dono/cliente") || (r === "shop" && rotaAtual === "carrinho") ? "ativo" : ""}" ${rotaAtual === r ? 'aria-current="page"' : ""}>${icone(ic)}<span>${t}</span>${r === "dono/pedidos" || r === "shop" ? '<i class="badge" hidden></i>' : ""}</a>`).join("");
  $("#subtitulo").textContent = D.ehDono && visao === "dono" ? "Painel do dono" : (D.modo === "demo" ? "Demonstração" : "Teixeiras · MG");
  const bv = $("#btnVisao");
  bv.hidden = !D.ehDono;
  bv.innerHTML = visao === "dono" ? `${icone("olho")}<span>Ver app</span>` : `${icone("grafico")}<span>Painel</span>`;
  $("#btnSino").hidden = !D.usuario;
  $("#btnEntrar").hidden = !!D.usuario || def.semAbas;
  N.atualizaBadges();
}

// ---------- Início ----------
async function inicia() {
  await D.iniciar();
  S.iniciarPublico();
  S.carrinho = ls.get("br.carrinho", []);
  let primeiro = true;
  D.aoMudarUsuario(u => {
    S.iniciarUsuario(u);
    N.iniciar(u);
    if (!primeiro) {
      const volta = lerRota().q.get("volta");
      const antes = location.hash;
      if (u) ir(volta || (D.ehDono ? (visao = "dono", "dono/agenda") : "inicio"));
      else { ir("inicio"); }
      if (location.hash === antes) navega();   // mesmo endereço: o hashchange não dispara sozinho
    }
  });
  S.iniciarUsuario(D.usuario);
  N.iniciar(D.usuario);
  primeiro = false;
  window.addEventListener("hashchange", navega);
  await navega();
  const b = document.getElementById("boot");
  if (b) { b.classList.add("sai"); setTimeout(() => b.remove(), 400); }
  if (D.modo === "demo" && !ls.get("br.avisoDemo")) {
    ls.set("br.avisoDemo", 1);
    toast("Modo demonstração: os dados ficam só neste aparelho.");
  }
}

window.addEventListener("error", e => console.error(e.error || e.message));
inicia().catch(e => { console.error(e); toast(traduzErro(e), "erro"); });
