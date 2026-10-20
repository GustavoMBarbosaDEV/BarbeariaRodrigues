// Tela de entrada: login com Google (ou, sem Firebase, botões de demonstração)
import { D, traduzErro } from "../dados.js";
import { icone, toast } from "../util.js";
import { LOGO_GOOGLE } from "../ui.js";

export function tela(el) {
  const demo = D.modo === "demo";
  el.innerHTML = `<section class="entrar">
    <img class="logo-g" src="img/logo-320.png" alt="Logo da Barbearia Rodrigues" width="132" height="132">
    <h1>Barbearia Rodrigues</h1>
    <p>Entre para agendar seu horário, acompanhar seus atendimentos e reservar produtos.</p>
    <div class="caixa">
      ${demo ? `
        <button class="btn bloco" data-demo="cliente">${icone("usuario")} Entrar como cliente</button>
        <button class="btn sec bloco" data-demo="dono">${icone("grafico")} Entrar como dono</button>
        <p class="demo-aviso">Modo demonstração: o Firebase ainda não foi configurado, então os dados ficam só neste aparelho. Veja o DESENVOLVIMENTO.md para ligar o login de verdade.</p>`
      : `<button class="btn google bloco" id="google">${LOGO_GOOGLE} Continuar com Google</button>
        <p class="muted pequeno">Usamos sua conta Google só para identificar você. Ao entrar, você concorda com a <a href="#/privacidade">Política de Privacidade</a>.</p>`}
      <a class="btn fantasma bloco" href="#/inicio">Só olhar por enquanto</a>
    </div>
  </section>`;
  el.querySelectorAll("[data-demo]").forEach(b => b.addEventListener("click", () => D.entrarDemo(b.dataset.demo)));
  el.querySelector("#google")?.addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    try { await D.entrarGoogle(); }
    catch (err) { toast(traduzErro(err), "erro"); }
    finally { e.currentTarget && (e.currentTarget.disabled = false); }
  });
}
