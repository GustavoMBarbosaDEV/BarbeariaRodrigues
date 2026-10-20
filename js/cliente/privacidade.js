// Política de privacidade (LGPD) em linguagem simples
import { S } from "../estado.js";
import { esc, icone } from "../util.js";
import { titulo } from "../ui.js";

export function tela(el) {
  const loja = S.loja || {};
  el.innerHTML = `<button class="voltar" onclick="history.back()">${icone("voltar")} Voltar</button>` + titulo("Privacidade", "Como a Barbearia Rodrigues cuida dos seus dados.") + `
  <div class="card" style="display:grid;gap:14px">
    <div><h3>Quais dados guardamos</h3><p class="muted">Nome completo, CPF, data de nascimento, celular e e-mail; seus agendamentos, reservas do shop e avaliações.</p></div>
    <div><h3>Para que usamos</h3><p class="muted">Identificar você nos agendamentos, evitar cadastros duplicados (CPF), entrar em contato sobre seus horários, lembrar seu aniversário e emitir comprovantes quando necessário. Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</p></div>
    <div><h3>Quem vê</h3><p class="muted">Só você e a equipe da barbearia. Outros clientes nunca veem seus dados. Nas avaliações públicas aparece apenas o seu primeiro nome.</p></div>
    <div><h3>Onde ficam</h3><p class="muted">No Google Firebase, protegidos por regras de acesso. O login é feito pela sua conta Google; não guardamos senhas.</p></div>
    <div><h3>Seus direitos (LGPD)</h3><p class="muted">Você pode ver e corrigir seus dados em Perfil, e apagar seu cadastro a qualquer momento em Perfil → Apagar meu cadastro. O histórico de atendimentos pode ser mantido pela barbearia pelo prazo exigido em lei.</p></div>
    <div><h3>Contato</h3><p class="muted">${esc(loja.nome || "Barbearia Rodrigues")} — ${esc([loja.endereco, loja.cidade].filter(Boolean).join(", "))}${loja.whatsapp ? ` · WhatsApp ${esc(loja.whatsapp)}` : ""}</p></div>
  </div>`;
}
