// Menu "Mais" do painel do dono
import { D } from "../dados.js";
import { icone } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  const it = (r, ic, t, s) => `<a href="#/${r}">${icone(ic)}<strong>${t}</strong><small>${s}</small></a>`;
  el.innerHTML = titulo("Mais", D.usuario.email) + `<div class="menu-grade">
    ${it("dono/relatorios", "grafico", "Relatórios", "Faturamento, serviços e equipe")}
    ${it("dono/servicos", "tesoura", "Serviços", "Preços, duração e combos")}
    ${it("dono/equipe", "usuarios", "Equipe", "Barbeiros e horários")}
    ${it("dono/avisos", "megafone", "Avisos", "Promoções e recados para todos")}
    ${it("dono/galeria", "imagem", "Galeria", "Fotos dos cortes")}
    ${it("dono/ajustes", "engrenagem", "Ajustes", "Dados da barbearia e regras")}
    ${it("inicio", "olho", "Ver app do cliente", "Como o cliente vê")}
    ${it("notificacoes", "sino", "Notificações", "Novos horários e alertas")}
  </div>`;
}
