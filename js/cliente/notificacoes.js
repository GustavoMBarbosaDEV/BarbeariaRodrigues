// Central de notificações (sininho)
import { N } from "../notificacoes.js";
import { S } from "../estado.js";
import { esc, icone, tempoAtras, vazio, toast } from "../util.js";
import { titulo } from "../ui.js";

const ICONE = { aviso: "megafone", lembrete: "relogio", aniversario: "bolo", agenda: "calendario", pedido: "sacola", estoque: "caixa" };

export function tela(el) {
  let primeiraVez = true;
  const desenha = () => {
    const l = N.itens;
    el.innerHTML = titulo("Notificações", "", l.some(i => !i.lida) ? `<button class="btn mini sec" id="lidas">${icone("check")} Marcar como lidas</button>` : "") +
      (!N.ligadas() && N.suportado() ? `<div class="faixa" style="margin-bottom:14px">${icone("sino")}<div><strong>Receba avisos no aparelho</strong><p>Lembrete do seu horário, confirmação da barbearia e promoções.</p><button class="btn mini" id="ligar" style="margin-top:10px">Ativar notificações</button></div></div>` : "") +
      (l.length ? `<div class="lista">${l.map(i => `<a class="notif ${i.lida ? "" : "nova"}" href="#/${esc(i.link || "inicio")}">
        <span class="bola">${icone(ICONE[i.tipo] || "sino")}</span>
        <div class="meio"><strong>${esc(i.titulo)}</strong><p>${esc(i.texto || "")}</p><time>${i.em ? tempoAtras(i.em) : ""}</time></div></a>`).join("")}</div>`
        : vazio("sino", "Nada por aqui", "Quando houver novidades sobre seus horários e pedidos, elas aparecem aqui."));
    el.querySelector("#lidas")?.addEventListener("click", () => N.marcarLidas());
    el.querySelector("#ligar")?.addEventListener("click", async () => { const ok = await N.ligar(); toast(ok ? "Notificações ligadas." : "O navegador bloqueou as notificações.", ok ? "ok" : "erro"); desenha(); });
    // ao abrir a tela, o que estava novo passa a contar como visto (mas continua destacado nesta visita)
    if (primeiraVez && l.length) { primeiraVez = false; setTimeout(() => N.marcarLidas(), 1500); }
  };
  const p = S.ao(q => q === "notificacoes" && desenha());
  desenha();
  return p;
}
