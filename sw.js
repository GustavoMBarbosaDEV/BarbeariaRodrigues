// =====================================================================
//  Service worker: deixa o app instalável, abrindo sem internet e
//  recebendo avisos com o app fechado.
//  A versão V acompanha VERSAO em js/app.js (troque as duas com: cd ferramentas && node bump.mjs X.Y.Z).
//  Arquivo novo no app? Acrescente em ARQUIVOS aqui e na lista de ferramentas/build.mjs.
// =====================================================================
const V = "2.0.0";
const PREFIXO = "barbearia-rodrigues-";
const CACHE = PREFIXO + V;
const FB = "vendor/firebase-13.3.0/";
const ARQUIVOS = ["./", "index.html", "firebase-config.js", "manifest.webmanifest",
  "css/fontes.css", "css/tokens.css", "css/base.css", "css/layout.css", "css/components.css", "css/client.css", "css/owner.css", "css/equipe.css", "css/overlays.css", "css/motion.css", "css/intro.css", "css/app-visual.css",
  "js/abertura.js", "js/agenda.js", "js/app.js", "js/caixa.js", "js/dados.js", "js/estado.js", "js/notificacoes.js", "js/seed.js", "js/ui.js", "js/util.js",
  "js/cliente/agendar.js", "js/cliente/carrinho.js", "js/cliente/entrar.js", "js/cliente/galeria.js", "js/cliente/horarios.js", "js/cliente/inicio.js", "js/cliente/notificacoes.js", "js/cliente/perfil.js", "js/cliente/privacidade.js", "js/cliente/servicos.js", "js/cliente/shop.js",
  "js/dono/agenda.js", "js/dono/ajustes.js", "js/dono/avisos.js", "js/dono/caixa.js", "js/dono/cliente.js", "js/dono/clientes.js", "js/dono/equipe.js", "js/dono/estoque.js", "js/dono/galeria.js", "js/dono/horario-editor.js", "js/dono/mais.js", "js/dono/pagamento.js", "js/dono/pedidos.js", "js/dono/relatorios.js", "js/dono/servicos.js",
  FB + "firebase-app.js", FB + "firebase-auth.js", FB + "firebase-firestore.js",
  "fonts/fontsource-variable-5.3.0/inter-latin-wght-normal.woff2", "fonts/fontsource-variable-5.3.0/playfair-display-latin-wght-normal.woff2",
  "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "img/casa/atendimento.jpg", "img/casa/combo.jpg", "img/casa/equipe.jpg", "img/casa/experiencia.jpg", "img/casa/infantil.jpg", "img/casa/produtos.jpg",
  "img/cortes/acabamento.jpg", "img/cortes/barba-degrade.jpg", "img/cortes/cacheado.jpg", "img/cortes/degrade-social.jpg", "img/cortes/low-fade.jpg", "img/cortes/luzes.jpg", "img/cortes/mid-fade.jpg", "img/cortes/platinado.jpg", "img/cortes/social-classico.jpg", "img/cortes/social-tesoura.jpg",
  "img/logo-320.png", "img/logo.png"];

self.addEventListener("install", e => {
  // Guarda cada arquivo separadamente: se um falhar, os outros continuam.
  // NÃO assume o controle sozinho: a versão nova espera a pessoa tocar em "Atualizar" (aviso em js/app.js),
  // para não trocar o app no meio de um agendamento. Na primeira instalação não há versão antiga, então entra direto.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => null)))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIXO) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => {
  const origem = e.source && "url" in e.source ? new URL(e.source.url).origin : e.origin;
  if (origem !== location.origin) return;                     // só aceita ordem do próprio app
  if (e.data && e.data.tipo === "atualizar") self.skipWaiting();
});

// Só os arquivos do próprio site entram no cache. Banco de dados, login e qualquer outro endereço passam direto:
// nenhum dado pessoal fica guardado aqui.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.includes("/__/")) return;
  // Arquivos do app: tenta a versão mais nova; sem internet, usa a cópia guardada
  const req = e.request.mode === "navigate" ? e.request : new Request(e.request, { cache: "no-cache" });
  e.respondWith(fetch(req).then(r => { if (r.ok && r.type === "basic") { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

// Aviso que chega com o app fechado (lembrete do horário, vaga na lista de espera).
// Quem envia é o serviço de avisos (pasta avisos-worker/), com os campos em "data".
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = {}; }
  const d = m.data || {}, n = m.notification || {};
  const titulo = String(d.titulo || n.title || "Barbearia Rodrigues").slice(0, 80);
  e.waitUntil(self.registration.showNotification(titulo, {
    body: String(d.texto || n.body || "").slice(0, 300), icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    tag: d.tag ? String(d.tag).slice(0, 60) : undefined, data: { link: String(d.link || "") }
  }));
});

// Tocar na notificação abre o app na tela certa
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const destino = String((e.notification.data && e.notification.data.link) || "notificacoes").replace(/[^\w\-/?=&%.:]/g, "");   // só caminho interno do app
  const link = "./#/" + destino;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) { c.navigate(link).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(link);
  }));
});
