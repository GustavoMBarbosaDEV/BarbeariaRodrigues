// Reservas do Shop: separar, entregar (baixa o estoque) ou cancelar
import { D, traduzErro } from "../dados.js";
import { esc, icone, reais, toast, confirma, tempoAtras, vazio, foneFormata, linkWhats } from "../util.js";
import { titulo } from "../ui.js";
import { STATUS_PEDIDO } from "../cliente/carrinho.js";
import { movimentar } from "./estoque.js";
import { N } from "../notificacoes.js";

export function tela(el) {
  let pedidos = null, aba = "abertos";
  const paradas = [];

  const desenha = () => {
    if (!pedidos) { el.innerHTML = titulo("Pedidos do Shop") + `<div class="carregando"><span></span></div>`; return; }
    const abertos = pedidos.filter(p => p.status === "novo" || p.status === "separado");
    const fechados = pedidos.filter(p => !abertos.includes(p));
    const l = aba === "abertos" ? abertos : fechados;
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const vendidoMes = pedidos.filter(p => p.status === "retirado" && (p.atualizadoEm || p.criadoEm) >= mes.getTime()).reduce((s, p) => s + p.total, 0);
    el.innerHTML = titulo("Pedidos do Shop", "Reservas feitas pelos clientes para retirar na barbearia.") + `
      <div class="kpis" style="margin-bottom:14px">
        <div class="kpi"><small>Novos</small><b>${pedidos.filter(p => p.status === "novo").length}</b></div>
        <div class="kpi"><small>Prontos p/ retirar</small><b>${pedidos.filter(p => p.status === "separado").length}</b></div>
        <div class="kpi ouro"><small>Vendido no mês</small><b>${reais(vendidoMes)}</b></div>
        <div class="kpi"><small>Em aberto</small><b>${reais(abertos.reduce((s, p) => s + p.total, 0))}</b></div>
      </div>
      <div class="seg" style="margin-bottom:12px"><button class="${aba === "abertos" ? "ativo" : ""}" data-a="abertos">Em aberto (${abertos.length})</button><button class="${aba === "fechados" ? "ativo" : ""}" data-a="fechados">Finalizados (${fechados.length})</button></div>
      ${l.length ? `<div class="lista">${l.map(p => { const st = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.novo; return `<div class="horario-card" style="grid-template-columns:1fr">
        <div class="meio">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><strong>${esc(p.clienteNome || "Cliente")}</strong><span class="pill ${st.c}">${st.t}</span></div>
          <small>${tempoAtras(p.criadoEm)}${p.clienteTelefone ? " · " + esc(foneFormata(p.clienteTelefone)) : ""}</small>
          <div style="margin:8px 0">${p.itens.map(i => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${i.qtd}× ${esc(i.nome)}</span><span class="preco">${reais(i.qtd * i.preco)}</span></div>`).join("")}</div>
          ${p.obs ? `<small>“${esc(p.obs)}”</small>` : ""}
          <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--borda);padding-top:8px;margin-top:6px"><b>Total</b><b class="preco">${reais(p.total)}</b></div>
          <div class="botoes">
            ${p.status === "novo" ? `<button class="btn mini" data-s="separado" data-id="${p.id}">${icone("check")} Separado / pronto</button>` : ""}
            ${p.status === "novo" || p.status === "separado" ? `<button class="btn mini ok" data-s="retirado" data-id="${p.id}">Entregue e pago</button><button class="btn mini fantasma" data-s="cancelado" data-id="${p.id}">Cancelar</button>` : ""}
            ${p.clienteTelefone ? `<a class="btn mini sec" target="_blank" rel="noopener" href="${linkWhats(p.clienteTelefone, `Olá, ${(p.clienteNome || "").split(" ")[0]}! Sua reserva na Barbearia Rodrigues está pronta para retirar.`)}">${icone("whats")}</a>` : ""}
            <a class="btn mini sec" href="#/dono/cliente/${encodeURIComponent(p.uid)}">${icone("usuario")}</a>
          </div>
        </div></div>`; }).join("")}</div>` : vazio("sacola", aba === "abertos" ? "Nenhuma reserva em aberto" : "Nada finalizado ainda")}`;
    el.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", () => { aba = b.dataset.a; desenha(); }));
    el.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", () => muda(pedidos.find(p => p.id === b.dataset.id), b.dataset.s, b)));
  };

  async function muda(p, status, b) {
    if (status === "cancelado" && !await confirma("Cancelar reserva?", "O cliente recebe um aviso no app.", "Cancelar reserva", true)) return;
    b.disabled = true;
    try {
      if (status === "retirado") for (const i of p.itens) await movimentar(i.id, "shop", i.qtd, "Pedido " + p.id.slice(-5));
      await D.salvar("pedidos", p.id, { status, atualizadoEm: Date.now() });
      if (status === "separado") N.enviar(p.uid, "Sua reserva está pronta! 🛍️", `${p.itens.map(i => `${i.qtd}× ${i.nome}`).join(", ")} — é só retirar na barbearia. Total ${reais(p.total)}.`, "carrinho");
      if (status === "cancelado") N.enviar(p.uid, "Reserva cancelada", "Sua reserva do Shop foi cancelada pela barbearia. Fale com a gente se tiver dúvida.", "carrinho");
      toast(STATUS_PEDIDO[status].t, "ok");
    } catch (e) { toast(traduzErro(e), "erro"); b.disabled = false; }
  }

  paradas.push(D.ouvir("pedidos", [], l => { pedidos = l.sort((a, b) => b.criadoEm - a.criadoEm); desenha(); }));
  desenha();
  return () => paradas.forEach(f => f());
}
