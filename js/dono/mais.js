// Menu "Mais" do painel do dono
import { D } from "../dados.js";
import { icone, confirma } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  // cada item só aparece para quem pode abrir: o dono vê todos; o barbeiro, o que o dono liberou
  const it = (r, ic, t, s, ok = true) => ok ? `<a href="#/${r}">${icone(ic)}<strong>${t}</strong><small>${s}</small></a>` : "";
  const dono = D.ehDono;
  el.innerHTML = titulo("Mais", `${D.usuario.email} · ${dono ? "dono" : "barbeiro"}`) + `<div class="menu-grade">
    ${it("dono/caixa?tipo=semana", "dinheiro", "Fechamentos", "Dia, semana e mês: entradas, saídas e comissões", D.pode("caixa"))}
    ${it("dono/relatorios", "grafico", "Relatórios", "Faturamento, serviços e equipe", D.pode("relatorios"))}
    ${it("dono/estoque", "caixa", "Estoque", "Produtos, quantidades e custos", D.pode("estoque"))}
    ${it("dono/servicos", "tesoura", "Serviços", "Preços, duração e combos", dono)}
    ${it("dono/equipe", "usuarios", "Equipe", "Barbeiros, comissão e acessos", dono)}
    ${it("dono/avisos", "megafone", "Avisos", "Promoções e recados para todos", dono)}
    ${it("dono/galeria", "imagem", "Galeria", "Fotos dos cortes", dono)}
    ${it("dono/ajustes", "engrenagem", "Ajustes", "Dados da barbearia, regras e fidelidade", dono)}
    ${it("inicio", "olho", "Ver app do cliente", "Como o cliente vê")}
    ${it("notificacoes", "sino", "Notificações", "Novos horários e alertas")}
  </div>
  ${dono ? "" : `<p class="centro" style="margin-top:20px"><button class="btn fantasma mini" id="sair">${icone("sair")} Sair da conta</button></p>`}`;
  el.querySelector("#sair")?.addEventListener("click", async () => { if (await confirma("Sair da conta?", "", "Sair")) D.sair(); });
}
