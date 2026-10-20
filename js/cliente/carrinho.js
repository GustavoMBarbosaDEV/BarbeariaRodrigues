// Sacola do shop + meus pedidos (reserva para retirar na barbearia)
import { D, traduzErro } from "../dados.js";
import { S } from "../estado.js";
import { esc, icone, reais, toast, confirma, tempoAtras, vazio, ls } from "../util.js";
import { titulo, fotoProduto } from "../ui.js";
import { addCarrinho } from "./shop.js";
import { N } from "../notificacoes.js";

export const STATUS_PEDIDO = {
  novo: { t: "Recebido", c: "aviso" },
  separado: { t: "Pronto para retirar", c: "ok" },
  retirado: { t: "Retirado", c: "neutro" },
  cancelado: { t: "Cancelado", c: "perigo" }
};

export function tela(el) {
  let pedidos = null, obs = "";
  const paradas = [];
  const itens = () => S.carrinho.map(i => ({ ...i, p: S.produto(i.id) })).filter(i => i.p);

  const desenha = () => {
    const l = itens();
    const total = l.reduce((s, i) => s + i.qtd * Number(i.p.preco), 0);
    el.innerHTML = `<a class="voltar" href="#/shop">${icone("voltar")} Shop</a>` + titulo("Sacola", "Reserve agora e pague na retirada.") + (l.length ? `
      <div class="lista">${l.map(i => `<div class="item">
        <span class="thumb">${fotoProduto(i.p)}</span>
        <div class="meio"><strong>${esc(i.p.nome)}</strong><small>${reais(i.p.preco)} cada${i.p.disponivel === false ? " · <b style='color:var(--perigo)'>esgotado</b>" : ""}</small></div>
        <div class="lado"><div class="qtd"><button data-m="${esc(i.id)}" aria-label="Menos">${icone(i.qtd === 1 ? "lixo" : "menos")}</button><span>${i.qtd}</span><button data-p="${esc(i.id)}" aria-label="Mais">${icone("mais")}</button></div></div>
      </div>`).join("")}</div>
      <label class="campo" style="margin-top:14px"><span>Observação (opcional)</span><input id="obs" maxlength="200" value="${esc(obs)}" placeholder="Ex.: retiro no sábado de manhã"></label>
      <div class="resumo-fixo"><div class="meio"><strong>Total ${reais(total)}</strong><small>${(n => n + (n === 1 ? " item" : " itens"))(l.reduce((s, i) => s + i.qtd, 0))} · pagamento na barbearia</small></div><button class="btn" id="reservar" ${l.some(i => i.p.disponivel === false) ? "disabled" : ""}>Reservar</button></div>`
      : vazio("carrinho", "Sua sacola está vazia", "Veja os produtos que usamos na barbearia.", `<a class="btn" href="#/shop">Ir ao shop</a>`)) + `
      <section class="secao"><div class="secao-topo"><h2>Meus pedidos</h2></div>
      ${pedidos === null ? `<div class="carregando"><span></span></div>` : pedidos.length ? `<div class="lista">${pedidos.map(p => { const st = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.novo; return `<div class="item">
        <div class="meio"><strong>${esc(p.itens.map(i => `${i.qtd}× ${i.nome}`).join(", "))}</strong><small>${reais(p.total)} · ${tempoAtras(p.criadoEm)}</small></div>
        <div class="lado"><span class="pill ${st.c}">${st.t}</span>${p.status === "novo" ? `<button class="btn mini fantasma" data-cancela="${p.id}">Cancelar</button>` : ""}</div></div>`; }).join("")}</div>` : `<p class="muted">Você ainda não fez reservas.</p>`}
      </section>`;
    el.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { addCarrinho(b.dataset.m, -1); desenha(); }));
    el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { addCarrinho(b.dataset.p, 1); desenha(); }));
    el.querySelector("#obs")?.addEventListener("input", e => obs = e.target.value);
    el.querySelector("#reservar")?.addEventListener("click", reservar);
    el.querySelectorAll("[data-cancela]").forEach(b => b.addEventListener("click", async () => {
      if (!await confirma("Cancelar reserva?", "Os produtos voltam para o estoque da barbearia.", "Cancelar reserva", true)) return;
      try { await D.salvar("pedidos", b.dataset.cancela, { status: "cancelado", atualizadoEm: Date.now() }); toast("Reserva cancelada."); } catch (e) { toast(traduzErro(e), "erro"); }
    }));
  };

  async function reservar(e) {
    const b = e.currentTarget; b.disabled = true;
    const l = itens();
    try {
      await D.criar("pedidos", {
        uid: D.usuario.uid, clienteNome: (S.perfil && S.perfil.nome) || D.usuario.nome || "", clienteTelefone: (S.perfil && S.perfil.telefone) || "",
        itens: l.map(i => ({ id: i.id, nome: i.p.nome, preco: Number(i.p.preco), qtd: i.qtd })),
        total: l.reduce((s, i) => s + i.qtd * Number(i.p.preco), 0), obs: obs.trim(), status: "novo", criadoEm: Date.now()
      });
      S.carrinho = []; ls.set("br.carrinho", []); N.atualizaBadges(); obs = "";
      toast("Reserva enviada! Avisamos quando estiver pronta.", "ok");
      desenha();
    } catch (err) { toast(traduzErro(err), "erro"); b.disabled = false; }
  }

  paradas.push(D.ouvir("pedidos", [["uid", "==", D.usuario.uid]], l => { pedidos = l.sort((a, b) => b.criadoEm - a.criadoEm); desenha(); }, () => { pedidos = []; desenha(); }));
  paradas.push(S.ao(q => (q === "produtos") && desenha()));
  desenha();
  return () => paradas.forEach(f => f());
}
