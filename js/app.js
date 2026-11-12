// =====================================================================
//  Barbearia Rodrigues — app
//  Ponto de partida: liga os dados, monta a moldura (topo + abas) e troca
//  de tela conforme o endereço (#/inicio, #/agendar, #/dono/agenda ...).
// =====================================================================
import { D, traduzErro } from "./dados.js";
import { S } from "./estado.js";
import { $, esc, icone, toast, ls } from "./util.js";
import { N } from "./notificacoes.js";

export const VERSAO = "2.0.0";

// ---------- Tema ----------
export function aplicaTema(t = ls.get("bc.tema", "escuro")) {
  const escuro = t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
  $('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0d0b09" : "#f6f1ea");
}
export function trocaTema(t) { ls.set("bc.tema", t); aplicaTema(t); }
aplicaTema();

// ---------- Rotas ----------
// login: precisa estar logado | perfil: precisa ter o cadastro completo
// equipe: dono ou barbeiro | perm: dono, ou barbeiro com aquela permissão liberada | dono: só o dono
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
  "dono/agenda": { m: "./dono/agenda.js", equipe: true },
  "dono/clientes": { m: "./dono/clientes.js", perm: "clientes" },
  "dono/cliente": { m: "./dono/cliente.js", perm: "clientes" },
  "dono/caixa": { m: "./dono/caixa.js", perm: "caixa" },
  "dono/estoque": { m: "./dono/estoque.js", perm: "estoque" },
  "dono/pedidos": { m: "./dono/pedidos.js", perm: "pedidos" },
  "dono/relatorios": { m: "./dono/relatorios.js", perm: "relatorios" },
  "dono/servicos": { m: "./dono/servicos.js", dono: true },
  "dono/equipe": { m: "./dono/equipe.js", dono: true },
  "dono/avisos": { m: "./dono/avisos.js", dono: true },
  "dono/galeria": { m: "./dono/galeria.js", dono: true },
  "dono/ajustes": { m: "./dono/ajustes.js", dono: true },
  "dono/mais": { m: "./dono/mais.js", equipe: true }
};
const restrita = def => def.equipe || def.perm || def.dono;
const liberada = def => def.dono ? D.ehDono : def.perm ? D.pode(def.perm) : def.equipe ? D.ehEquipe : true;

const ABAS_CLIENTE = [
  ["inicio", "casa", "Início"], ["agendar", "calendario", "Agendar"], ["horarios", "relogio", "Horários"],
  ["shop", "sacola", "Shop"], ["perfil", "usuario", "Perfil"]
];
// O painel mostra só as abas que aquela conta pode abrir (o dono vê todas).
const ABAS_EQUIPE = [
  ["dono/agenda", "calendario", "Agenda"], ["dono/clientes", "usuarios", "Clientes"], ["dono/caixa", "dinheiro", "Caixa"],
  ["dono/pedidos", "sacola", "Pedidos"], ["dono/mais", "menu", "Mais"]
];
const abasEquipe = () => ABAS_EQUIPE.filter(([r]) => liberada(ROTAS[r]));
const NO_MAIS = ["dono/servicos", "dono/equipe", "dono/relatorios", "dono/avisos", "dono/galeria", "dono/ajustes", "dono/estoque"];

let visao = ls.get("bc.visao", "dono");   // o dono pode alternar entre o painel e o app do cliente
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

function rotaPadrao() { return D.ehEquipe && visao === "dono" ? "dono/agenda" : "inicio"; }

async function navega() {
  const meu = ++navId;
  const r = lerRota();
  if (!r.nome || !ROTAS[r.nome]) return ir(rotaPadrao());
  const def = ROTAS[r.nome];
  if ((def.login || restrita(def)) && !D.usuario) return ir("entrar?volta=" + encodeURIComponent(location.hash.slice(2)));
  if (!liberada(def)) return ir(D.ehEquipe ? "dono/agenda" : "inicio");   // a tela some para quem não pode; quem protege os dados são as regras do banco
  if (def.perfil && !D.ehEquipe && S.perfilCarregado && !S.perfilCompleto()) return ir("perfil?completar=1&volta=" + encodeURIComponent(location.hash.slice(2)));
  if (def.perfil && !D.ehEquipe && !S.perfilCarregado) { await esperaPerfil(); if (meu !== navId) return; if (!S.perfilCompleto()) return ir("perfil?completar=1&volta=" + encodeURIComponent(location.hash.slice(2))); }
  if (r.nome.startsWith("dono/")) { visao = "dono"; ls.set("bc.visao", visao); }
  else if (D.ehEquipe && r.nome !== "notificacoes") { visao = "app"; ls.set("bc.visao", visao); }

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
    el.innerHTML = `<div class="vazio">${icone("alerta")}<strong>Não foi possível abrir esta tela.</strong><p>${esc(traduzErro(e))}</p><button class="btn" data-recarregar>Recarregar</button></div>`;
    el.querySelector("[data-recarregar]").addEventListener("click", () => location.reload());
  }
}
function esperaPerfil() {
  return new Promise(ok => { if (S.perfilCarregado) return ok(); const p = S.ao(q => { if (q === "perfil" && S.perfilCarregado) { p(); ok(); } }); setTimeout(ok, 4000); });
}

// ---------- Moldura: topo + abas ----------
function montaMoldura(def) {
  const app = $("#app");
  const painel = D.ehEquipe && visao === "dono";
  const abas = painel ? abasEquipe() : ABAS_CLIENTE;
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
    $("#btnVisao").addEventListener("click", () => { visao = visao === "dono" ? "app" : "dono"; ls.set("bc.visao", visao); ir(visao === "dono" ? "dono/agenda" : "inicio"); });
  }
  document.body.classList.toggle("sem-abas", !!def.semAbas);
  document.body.classList.toggle("modo-dono", painel);
  $("#abas").innerHTML = abas.map(([r, ic, t]) => `<a href="#/${r}" class="${rotaAtual === r || (r === "dono/mais" && NO_MAIS.includes(rotaAtual)) || (r === "dono/clientes" && rotaAtual === "dono/cliente") || (r === "shop" && rotaAtual === "carrinho") ? "ativo" : ""}" ${rotaAtual === r ? 'aria-current="page"' : ""}>${icone(ic)}<span>${t}</span>${r === "dono/pedidos" || r === "shop" ? '<i class="badge" hidden></i>' : ""}</a>`).join("");
  $("#subtitulo").textContent = painel ? (D.ehDono ? "Painel do dono" : "Painel do barbeiro") : (D.modo === "demo" ? "Demonstração" : "Teixeiras, MG");
  const bv = $("#btnVisao");
  bv.hidden = !D.ehEquipe;
  bv.innerHTML = visao === "dono" ? `${icone("olho")}<span>Ver app</span>` : `${icone("grafico")}<span>Painel</span>`;
  $("#btnSino").hidden = !D.usuario;
  $("#btnEntrar").hidden = !!D.usuario || def.semAbas;
  N.atualizaBadges();
}

// ---------- Início ----------
async function inicia() {
  await D.iniciar();
  S.iniciarPublico();
  S.carrinho = ls.get("bc.carrinho", []);
  let primeiro = true;
  D.aoMudarUsuario(u => {
    S.iniciarUsuario(u);
    N.iniciar(u);
    if (!primeiro) {
      const volta = lerRota().q.get("volta");
      const antes = location.hash;
      if (u) ir(volta || (D.ehEquipe ? (visao = "dono", "dono/agenda") : "inicio"));
      else { ir("inicio"); }
      if (location.hash === antes) navega();   // mesmo endereço: o hashchange não dispara sozinho
    }
  });
  S.iniciarUsuario(D.usuario);
  N.iniciar(D.usuario);
  primeiro = false;
  window.addEventListener("hashchange", navega);
  await navega();
  if (typeof window.encerrarAbertura === "function") window.encerrarAbertura();
  else { const b = document.getElementById("boot"); if (b) { b.classList.add("sai"); setTimeout(() => b.remove(), 400); } }
  if (D.modo === "demo" && !ls.get("bc.avisoDemo")) {
    ls.set("bc.avisoDemo", 1);
    toast("Modo demonstração: os dados ficam só neste aparelho.");
  }
  vigiaAtualizacao();
}

// ---------- Aviso de nova versão ----------
// O service worker novo fica esperando; o app mostra um cartão e só troca quando a pessoa tocar em "Atualizar"
// (trocar sozinho no meio do uso poderia perder o que ela estava fazendo).
async function vigiaAtualizacao() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (!reg) return;
  let dispensado = 0;
  const mostra = async w => {
    if (!w || !navigator.serviceWorker.controller || $("#novaVersao") || Date.now() - dispensado < 30 * 60000) return;
    let versao = "";
    try { versao = (/const V = "([0-9.]+)"/.exec(await (await fetch(w.scriptURL, { cache: "no-store" })).text()) || [])[1] || ""; } catch (e) { }
    const el = document.createElement("div");
    el.id = "novaVersao"; el.className = "nova-versao"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-label", "Nova versão disponível");
    el.innerHTML = `<img src="icons/icon-192.png" alt="" width="40" height="40"><div class="meio"><strong>Nova versão pronta</strong><small></small></div><button class="btn mini sec" data-depois>Depois</button><button class="btn mini" data-ok>Atualizar</button>`;
    el.querySelector("small").textContent = versao ? "Versão " + versao : "Toque para atualizar o app";
    el.querySelector("[data-depois]").addEventListener("click", () => { dispensado = Date.now(); el.remove(); });
    el.querySelector("[data-ok]").addEventListener("click", e => {
      e.currentTarget.disabled = true; e.currentTarget.textContent = "Atualizando…";
      w.postMessage({ tipo: "atualizar" });
      setTimeout(() => location.reload(), 5000);   // se nada acontecer, recarrega mesmo assim
    });
    document.body.appendChild(el);
  };
  const confere = () => { if (reg.waiting) mostra(reg.waiting); };
  reg.addEventListener("updatefound", () => { const n = reg.installing; n && n.addEventListener("statechange", () => { if (n.state === "installed") confere(); }); });
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!recarregou && $("#novaVersao")) { recarregou = true; location.reload(); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().then(confere).catch(() => { }); });
  confere();
}

window.addEventListener("error", e => console.error(e.error || e.message));
inicia().catch(e => { console.error(e); toast(traduzErro(e), "erro"); });
