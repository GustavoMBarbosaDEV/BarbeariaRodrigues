// =====================================================================
//  Estado compartilhado: dados que várias telas usam ao mesmo tempo
//  (loja, serviços, equipe, produtos, galeria, avisos e o perfil do cliente).
//  Cada tela pode se inscrever com S.ao(fn) para se atualizar sozinha.
// =====================================================================
import { D } from "./dados.js";

const ouvintes = new Set();
let paradas = [];

export const S = {
  loja: null,
  servicos: [],
  profissionais: [],
  produtos: [],
  galeria: [],
  avisos: [],
  perfil: null,          // documento clientes/{uid} do usuário logado (null = ainda não preencheu)
  perfilCarregado: false,
  carrinho: [],          // [{id, qtd}] guardado no aparelho

  ao(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  avisar(qual) { ouvintes.forEach(f => { try { f(qual); } catch (e) { console.error(e); } }); },

  /** Escuta os dados públicos (não precisa de login). */
  iniciarPublico() {
    const ord = (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome || a.titulo).localeCompare(String(b.nome || b.titulo));
    D.ouvirDoc("config", "loja", d => { S.loja = d; S.avisar("loja"); });
    D.ouvir("servicos", [], l => { S.servicos = l.sort(ord); S.avisar("servicos"); });
    D.ouvir("profissionais", [], l => { S.profissionais = l.sort(ord); S.avisar("profissionais"); });
    D.ouvir("produtos", [], l => { S.produtos = l.sort(ord); S.avisar("produtos"); });
    D.ouvir("galeria", [], l => { S.galeria = l.sort(ord); S.avisar("galeria"); });
    D.ouvir("avisos", [], l => { S.avisos = l.sort((a, b) => b.em - a.em); S.avisar("avisos"); });
  },

  /** Escuta os dados do usuário logado. */
  iniciarUsuario(u) {
    paradas.forEach(f => f()); paradas = [];
    S.perfil = null; S.perfilCarregado = false;
    if (!u) { S.avisar("perfil"); return; }
    paradas.push(D.ouvirDoc("clientes", u.uid, d => { S.perfil = d; S.perfilCarregado = true; S.avisar("perfil"); },
      () => { S.perfilCarregado = true; S.avisar("perfil"); }));
  },

  servico: id => S.servicos.find(s => s.id === id),
  profissional: id => S.profissionais.find(p => p.id === id),
  produto: id => S.produtos.find(p => p.id === id),
  nomeLoja: () => (S.loja && S.loja.nome) || "Barbearia Rodrigues",
  perfilCompleto: () => !!(S.perfil && S.perfil.nome && S.perfil.cpf && S.perfil.nascimento && S.perfil.telefone && S.perfil.aceite)
};
