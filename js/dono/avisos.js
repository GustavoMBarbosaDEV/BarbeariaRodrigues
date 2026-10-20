// Avisos e promoções: aparecem no início do app e no sininho de todos os clientes
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, toast, abreModal, confirma, tempoAtras, dataCurta, hoje, vazio } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  const desenha = () => {
    el.innerHTML = `<a class="voltar" href="#/dono/mais">${icone("voltar")} Mais</a>` + titulo("Avisos", "Promoções, horários especiais e recados. Todos os clientes recebem no sininho.", `<button class="btn mini" id="novo">${icone("megafone")} Novo aviso</button>`) + `
      <div class="faixa" style="margin-bottom:14px">${icone("whats")}<div><strong>Dica</strong><p>Para falar com um cliente só, abra a ficha dele em Clientes → “Mensagem no app” ou WhatsApp.</p></div></div>
      ${S.avisos.length ? `<div class="lista">${S.avisos.map(a => `<div class="item"><span class="thumb">${icone("megafone")}</span>
        <div class="meio"><strong>${esc(a.titulo)}</strong><small>${esc(a.texto)}</small><small>${tempoAtras(a.em)}${a.ate ? ` · até ${dataCurta(a.ate)}${a.ate < hoje() ? " (encerrado)" : ""}` : ""}</small></div>
        <button class="icone-btn" data-del="${esc(a.id)}" aria-label="Apagar aviso">${icone("lixo")}</button></div>`).join("")}</div>` : vazio("megafone", "Nenhum aviso publicado")}`;
    el.querySelector("#novo").addEventListener("click", novo);
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (!await confirma("Apagar aviso?", "Ele some do app de todos os clientes.", "Apagar", true)) return;
      try { await D.apagar("avisos", b.dataset.del); toast("Aviso apagado."); } catch (e) { toast(traduzErro(e), "erro"); }
    }));
  };

  function novo() {
    const modelos = [
      ["Horário especial", "Neste feriado vamos atender das 08:00 às 14:00. Garanta seu horário pelo app!"],
      ["Promoção da semana", "Combo Corte + barba com 10% de desconto até sábado. Agende pelo app!"],
      ["Novidade no Shop", "Chegaram produtos novos para cabelo e barba. Reserve pelo app e retire aqui."]
    ];
    abreModal({
      titulo: "Novo aviso",
      corpo: `<div class="chips" style="margin:0 0 12px">${modelos.map((m, i) => `<button class="chip" type="button" data-m="${i}">${esc(m[0])}</button>`).join("")}</div>
        <label class="campo"><span>Título *</span><input id="at" maxlength="60"></label>
        <label class="campo"><span>Mensagem *</span><textarea id="ax" maxlength="300"></textarea></label>
        <label class="campo"><span>Mostrar até (opcional)</span><input id="aa" type="date" min="${hoje()}"></label>`,
      aoAbrir: m => m.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { const [t, x] = modelos[b.dataset.m]; m.querySelector("#at").value = t; m.querySelector("#ax").value = x; })),
      acoes: [{ t: "Cancelar", cls: "sec" }, {
        t: "Publicar", fn: async m => {
          const t = m.querySelector("#at").value.trim(), x = m.querySelector("#ax").value.trim();
          if (!t || !x) { toast("Preencha título e mensagem.", "erro"); return false; }
          try { await D.criar("avisos", { titulo: t, texto: x, ate: m.querySelector("#aa").value || null, em: Date.now() }); toast("Aviso publicado!", "ok"); }
          catch (e) { toast(traduzErro(e), "erro"); return false; }
        }
      }]
    });
  }

  const p = S.ao(q => q === "avisos" && desenha());
  desenha();
  return p;
}
