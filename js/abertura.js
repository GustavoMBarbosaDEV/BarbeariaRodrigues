// Tela de abertura (logo e frase) e registro do service worker.
// Fica num arquivo separado, e não dentro do index.html, porque a política de segurança do site
// (Content-Security-Policy) não deixa rodar script escrito direto na página.
(function () {
  var boot = document.getElementById("boot");
  var inicio = performance.now();
  var chave = "bc.intro.v2";
  var forcar = new URLSearchParams(location.search).get("intro") === "1";
  var reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var primeira = forcar;
  try {
    primeira = primeira || !sessionStorage.getItem(chave);
    if (primeira) sessionStorage.setItem(chave, "1");
  } catch (_) { primeira = true; }
  var duracao = primeira && !reduzido ? 2600 : 0;
  var encerrando = false;
  window.encerrarAbertura = function (pular) {
    if (encerrando || !boot || !boot.isConnected) return;
    encerrando = true;
    var espera = pular ? 0 : Math.max(0, duracao - (performance.now() - inicio));
    window.setTimeout(function () {
      if (!boot.isConnected) return;
      boot.classList.add("sai");
      boot.setAttribute("aria-hidden", "true");
      boot.removeAttribute("aria-modal");
      window.setTimeout(function () { boot.remove(); }, 720);
    }, espera);
  };
  document.getElementById("intro-entrar").addEventListener("click", function () { window.encerrarAbertura(true); });
  document.getElementById("intro-pular").addEventListener("click", function () { window.encerrarAbertura(true); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && boot.isConnected) window.encerrarAbertura(true);
  });
  if (primeira) document.getElementById("intro-entrar").focus({ preventScroll: true });
  else window.encerrarAbertura(true);
  window.setTimeout(function () { window.encerrarAbertura(true); }, 8000);
})();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function () {}); });
}
