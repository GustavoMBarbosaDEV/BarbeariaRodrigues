// Janela "como o cliente pagou?": usada ao concluir um atendimento e ao entregar um pedido do shop.
// Em dinheiro, o barbeiro informa quanto o cliente entregou: o app calcula o troco e registra.
// Se o cliente deixou o troco, o barbeiro marca "não teve troco" e a diferença fica como gorjeta.
import { esc, icone, reais, numero, toast, abreModal } from "../util.js";
import { FORMAS, arred } from "../caixa.js";

const txt = v => String(Number(v || 0).toFixed(2)).replace(".", ",");

/**
 * pedePagamento({ titulo, valor, sub, fidel, gorjeta }) -> Promise<null | { forma, valor, recebido, troco, gorjeta, premio }>
 *  - valor: o que estava previsto (o barbeiro pode corrigir: vale o que entrou no balcão)
 *  - fidel: resultado de fidelidade() do cliente; se há prêmio disponível, oferece usar agora
 *  - gorjeta: false esconde a opção de gorjeta (venda do shop)
 *  Na resposta: recebido = dinheiro entregue; troco = devolvido ao cliente; gorjeta = o que ficou com o barbeiro.
 */
export function pedePagamento({ titulo = "Como o cliente pagou?", valor = 0, sub = "", fidel = null, botao = "Concluir", gorjeta = true }) {
  return new Promise(ok => {
    let forma = "", resp = null;
    abreModal({
      titulo,
      corpo: `${sub ? `<p class="muted" style="margin-bottom:12px">${esc(sub)}</p>` : ""}
        <div class="campo"><span>Forma de pagamento</span>
          <div class="formas" role="radiogroup" aria-label="Forma de pagamento">${Object.entries(FORMAS).map(([k, t]) => `<button type="button" class="forma" role="radio" aria-checked="false" data-f="${k}">${icone(k === "dinheiro" ? "dinheiro" : k === "pix" ? "check" : "sacola")}<span>${esc(t)}</span></button>`).join("")}</div></div>
        <label class="campo"><span>Valor do atendimento</span><input id="pv" inputmode="decimal" value="${esc(txt(valor))}"><small>Previsto: ${reais(valor)}. Corrija se cobrou diferente no balcão.</small></label>
        <div id="dinheiro" hidden>
          <label class="campo"><span>Quanto o cliente entregou em dinheiro</span><input id="pr" inputmode="decimal" value="${esc(txt(valor))}"></label>
          <div class="troco" id="troco" role="status" aria-live="polite"></div>
          ${gorjeta ? `<label class="check" id="semTrocoBox" style="margin:10px 0 4px" hidden><input type="checkbox" id="pg"><span><b>Não teve troco</b><br><span class="muted pequeno">O cliente deixou a diferença: ela fica registrada como gorjeta de quem atendeu.</span></span></label>` : ""}
        </div>
        ${fidel && fidel.disponiveis ? `<label class="check faixa" style="margin:12px 0 4px"><input type="checkbox" id="pp"><span><strong>Usar o prêmio do cartão fidelidade</strong><br><span class="muted">${esc(fidel.premio)} · o cliente completou ${fidel.cortes} atendimentos. Ajuste o valor (pode ser R$ 0,00).</span></span></label>` : ""}`,
      aoAbrir: m => {
        const q = s => m.querySelector(s);
        const conta = () => {
          const v = arred(numero(q("#pv").value)), r = arred(numero(q("#pr").value)), dif = arred(r - v);
          const semTroco = !!q("#pg")?.checked;
          const box = q("#semTrocoBox"); if (box) box.hidden = !(dif > 0);
          q("#troco").className = "troco " + (dif < 0 ? "falta" : dif > 0 ? "tem" : "");
          q("#troco").innerHTML = dif < 0 ? `Faltam <b>${reais(-dif)}</b>` : dif > 0 ? (semTroco ? `Gorjeta: <b>${reais(dif)}</b>` : `Troco para o cliente: <b>${reais(dif)}</b>`) : "Valor exato: sem troco.";
        };
        m.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
          forma = b.dataset.f;
          m.querySelectorAll("[data-f]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
          q("#dinheiro").hidden = forma !== "dinheiro";
          if (forma === "dinheiro") conta();
        }));
        // enquanto o barbeiro não mexeu no "entregou", ele acompanha o valor do atendimento
        let mexeu = false;
        q("#pr").addEventListener("input", () => { mexeu = true; conta(); });
        q("#pv").addEventListener("input", () => { if (!mexeu) q("#pr").value = q("#pv").value; conta(); });
        q("#pg")?.addEventListener("change", conta);
        q("#pp")?.addEventListener("change", e => { if (e.target.checked) { q("#pv").value = "0,00"; if (!mexeu) q("#pr").value = "0,00"; conta(); } });
      },
      acoes: [{ t: "Voltar", cls: "sec" }, {
        t: botao, fn: m => {
          const v = arred(numero(m.querySelector("#pv").value)), premio = !!m.querySelector("#pp")?.checked;
          if (!(v >= 0) || v > 100000) { toast("Confira o valor.", "erro"); return false; }
          if (!forma && v > 0) { toast("Escolha a forma de pagamento.", "erro"); return false; }
          let recebido = v, troco = 0, gorj = 0;
          if (forma === "dinheiro") {
            recebido = arred(numero(m.querySelector("#pr").value));
            if (!(recebido >= 0) || recebido > 100000) { toast("Confira quanto o cliente entregou.", "erro"); return false; }
            if (recebido < v) { toast(`Faltam ${reais(v - recebido)}. Corrija o valor entregue ou o valor do atendimento.`, "erro"); return false; }
            const dif = arred(recebido - v);
            if (m.querySelector("#pg")?.checked) gorj = dif; else troco = dif;
          }
          resp = { forma: forma || "dinheiro", valor: v, recebido, troco, gorjeta: gorj, premio };
        }
      }],
      aoFechar: () => ok(resp)
    });
  });
}
