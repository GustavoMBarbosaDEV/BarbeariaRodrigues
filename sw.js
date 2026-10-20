// =====================================================================
//  Service worker: deixa o app instalável e abrindo mesmo sem internet.
//  Ao publicar uma versão nova, mude CACHE (acompanha VERSAO em js/app.js).
// =====================================================================
const CACHE = "barbearia-rodrigues-1.0.0";
const ARQUIVOS = ["./", "css/style.css", "firebase-config.js", "index.html", "js/agenda.js", "js/app.js", "js/cliente/agendar.js", "js/cliente/carrinho.js", "js/cliente/entrar.js", "js/cliente/galeria.js", "js/cliente/horarios.js", "js/cliente/inicio.js", "js/cliente/notificacoes.js", "js/cliente/perfil.js", "js/cliente/privacidade.js", "js/cliente/servicos.js", "js/cliente/shop.js", "js/dados.js", "js/dono/agenda.js", "js/dono/ajustes.js", "js/dono/avisos.js", "js/dono/cliente.js", "js/dono/clientes.js", "js/dono/equipe.js", "js/dono/estoque.js", "js/dono/galeria.js", "js/dono/horario-editor.js", "js/dono/mais.js", "js/dono/pedidos.js", "js/dono/relatorios.js", "js/dono/servicos.js", "js/estado.js", "js/notificacoes.js", "js/seed.js", "js/ui.js", "js/util.js", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "img/casa/atendimento.jpg", "img/casa/combo.jpg", "img/casa/equipe.jpg", "img/casa/experiencia.jpg", "img/casa/infantil.jpg", "img/casa/produtos.jpg", "img/cortes/acabamento.jpg", "img/cortes/barba-degrade.jpg", "img/cortes/cacheado.jpg", "img/cortes/degrade-social.jpg", "img/cortes/low-fade.jpg", "img/cortes/luzes.jpg", "img/cortes/mid-fade.jpg", "img/cortes/platinado.jpg", "img/cortes/social-classico.jpg", "img/cortes/social-tesoura.jpg", "img/logo-320.png", "img/logo.png"];

self.addEventListener("install", e => {
  // guarda cada arquivo separadamente: se um falhar, os outros continuam
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Bibliotecas do Firebase e fontes: usa a cópia guardada; se não tiver, busca e guarda
  if ((url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) || url.hostname.endsWith("fonts.gstatic.com") || url.hostname === "fonts.googleapis.com") {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Arquivos do app: tenta a versão mais nova; sem internet, usa a cópia guardada
  const req = e.request.mode === "navigate" ? e.request : new Request(e.request, { cache: "no-cache" });
  e.respondWith(fetch(req).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

// Tocar na notificação abre o app na tela certa
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = "./#/" + ((e.notification.data && e.notification.data.link) || "notificacoes");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) { c.navigate(link).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(link);
  }));
});
