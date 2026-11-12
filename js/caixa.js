// =====================================================================
//  Caixa, comissões, fidelidade e fechamentos (dia, semana e mês).
//  Só contas e regras: nenhuma função aqui mexe na tela nem no banco,
//  por isso dá para testar com "node --test" (pasta testes/).
// =====================================================================
import { iso, dataDe, somaDias, min, dataCurta, dataLonga, MESES, reais } from "./util.js";

export const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão de débito", credito: "Cartão de crédito" };
export const nomeForma = f => FORMAS[f] || "Não informado";

/** O que o dono pode liberar para a conta de um barbeiro. [chave, título, explicação] */
export const PERMISSOES = [
  ["agendaTodos", "Mexer na agenda dos colegas", "Confirmar, concluir e cancelar horários de outros barbeiros. Sem isso, ele vê a agenda do dia mas só mexe nos próprios horários."],
  ["clientes", "Cadastro de clientes", "Ver a lista de clientes, a ficha, o histórico e as anotações."],
  ["caixa", "Lançar no caixa", "Registrar entradas e saídas (despesas) e ver o próprio caixa e a própria comissão."],
  ["caixaGeral", "Ver o caixa da barbearia", "Faturamento de todos, saídas e comissões dos colegas."],
  ["estoque", "Estoque", "Ver e mexer nos produtos, quantidades e custos."],
  ["pedidos", "Pedidos do Shop", "Separar, entregar e cancelar reservas de produtos."],
  ["relatorios", "Relatórios", "Faturamento por período, serviços mais feitos e aniversariantes."]
];
export const PERM_PADRAO = { clientes: true, caixa: true };
export function limpaPerm(p) { const r = {}; for (const [k] of PERMISSOES) if (p && p[k] === true) r[k] = true; return r; }

// ---------- valores ----------
/** Quanto entrou de verdade neste atendimento (o valor do balcão vale mais que o do app). */
export const valorPago = a => Number((a.pagamento && a.pagamento.valor) ?? a.total ?? 0) || 0;
export const arred = v => Math.round((Number(v) || 0) * 100) / 100;
/** Gorjeta: o troco que o cliente deixou. É de quem atendeu, não entra no faturamento da casa. */
export const gorjetaDe = a => Number(a.pagamento && a.pagamento.gorjeta) || 0;
export const comissaoSobre = (valor, pct) => arred((Number(valor) || 0) * (Number(pct) || 0) / 100);
const diaDoPedido = p => iso(new Date(p.atualizadoEm || p.criadoEm || 0));

/** Horário que vagou e foi ocupado de novo: outro atendimento do mesmo barbeiro por cima de um cancelado. */
export function vagasPreenchidas(ags) {
  const validos = ags.filter(a => a.status !== "cancelado");
  return ags.filter(c => c.status === "cancelado" && validos.some(a => a.profissional === c.profissional && a.data === c.data
    && min(a.inicio) < min(c.inicio) + Number(c.duracao || 0) && min(c.inicio) < min(a.inicio) + Number(a.duracao || 0))).length;
}

/**
 * Fechamento de um período.
 * ags, lancs (lançamentos do caixa) e peds (pedidos do shop) podem vir com sobra: o filtro por data é feito aqui.
 * prof: se informado, conta só o que é daquele profissional (visão do barbeiro).
 */
export function resumoCaixa({ ags = [], lancs = [], peds = [], ini, fim, prof = "" }) {
  const noP = ags.filter(a => a.data >= ini && a.data <= fim && (!prof || a.profissional === prof));
  const feitos = noP.filter(a => a.status === "concluido");
  const formas = { dinheiro: 0, pix: 0, debito: 0, credito: 0, outro: 0 };
  const soma = (f, v) => { formas[f in formas ? f : "outro"] += Number(v) || 0; };

  feitos.forEach(a => soma(a.pagamento && a.pagamento.forma, valorPago(a)));
  const servicos = feitos.reduce((s, a) => s + valorPago(a), 0);

  const vendas = prof ? [] : peds.filter(p => p.status === "retirado" && diaDoPedido(p) >= ini && diaDoPedido(p) <= fim);
  const valorVenda = p => Number((p.pagamento && p.pagamento.valor) ?? p.total ?? 0) || 0;
  vendas.forEach(p => soma(p.pagamento && p.pagamento.forma, valorVenda(p)));
  const produtos = vendas.reduce((s, p) => s + valorVenda(p), 0);

  const lp = lancs.filter(l => l.data >= ini && l.data <= fim && (!prof || l.profissional === prof));
  const listaEntradas = lp.filter(l => l.tipo === "entrada"), listaSaidas = lp.filter(l => l.tipo === "saida");
  listaEntradas.forEach(l => soma(l.forma, l.valor));
  const avulsas = listaEntradas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const saidas = listaSaidas.reduce((s, l) => s + Number(l.valor || 0), 0);

  const comissoes = {};
  feitos.forEach(a => {
    const c = (comissoes[a.profissional] ||= { nome: a.profissionalNome || "—", atend: 0, base: 0, valor: 0, gorjeta: 0 });
    c.atend++; c.base += valorPago(a); c.valor += Number(a.comissaoValor || 0); c.gorjeta += gorjetaDe(a);
  });
  const totalComissoes = Object.values(comissoes).reduce((s, c) => s + c.valor, 0);
  const entradas = servicos + produtos + avulsas;
  const r = v => arred(v);
  Object.keys(formas).forEach(k => formas[k] = r(formas[k]));
  Object.values(comissoes).forEach(c => { c.base = r(c.base); c.valor = r(c.valor); c.gorjeta = r(c.gorjeta); });
  const gorjetas = r(feitos.reduce((s, a) => s + gorjetaDe(a), 0));
  const troco = r(feitos.reduce((s, a) => s + (Number(a.pagamento && a.pagamento.troco) || 0), 0));
  return {
    ini, fim, servicos: r(servicos), produtos: r(produtos), avulsas: r(avulsas), entradas: r(entradas), saidas: r(saidas), saldo: r(entradas - saidas),
    formas, comissoes, totalComissoes: r(totalComissoes), liquido: r(entradas - saidas - totalComissoes), gorjetas, troco,
    atendimentos: feitos.length, ticket: feitos.length ? r(servicos / feitos.length) : 0,
    marcados: noP.filter(a => a.status === "marcado" || a.status === "confirmado").length,
    cancelados: noP.filter(a => a.status === "cancelado").length,
    canceladosCliente: noP.filter(a => a.status === "cancelado" && a.canceladoPor === "cliente").length,
    faltas: noP.filter(a => a.status === "faltou").length,
    preenchidos: vagasPreenchidas(noP), premios: feitos.filter(a => a.premio).length,
    vendas: vendas.length, feitos, listaEntradas, listaSaidas, listaVendas: vendas
  };
}

// ---------- períodos ----------
/** tipo: "dia" | "semana" (segunda a domingo) | "mes". ref: uma data AAAA-MM-DD dentro do período. */
export function periodo(tipo, ref) {
  if (tipo === "semana") {
    const d = dataDe(ref), ini = somaDias(ref, -((d.getDay() + 6) % 7)), fim = somaDias(ini, 6);
    return { tipo, ini, fim, titulo: `Semana de ${dataCurta(ini).slice(0, 5)} a ${dataCurta(fim).slice(0, 5)}` };
  }
  if (tipo === "mes") {
    const d = dataDe(ref), fim = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { tipo, ini: ref.slice(0, 8) + "01", fim, titulo: `${MESES[d.getMonth()][0].toUpperCase() + MESES[d.getMonth()].slice(1)} de ${d.getFullYear()}` };
  }
  return { tipo: "dia", ini: ref, fim: ref, titulo: dataLonga(ref) };
}
export function vizinho(tipo, ref, sentido) {
  if (tipo === "semana") return somaDias(ref, 7 * sentido);
  if (tipo === "mes") { const d = dataDe(ref); return iso(new Date(d.getFullYear(), d.getMonth() + sentido, 1)); }
  return somaDias(ref, sentido);
}

/**
 * Quais fechamentos já estão prontos agora?
 *  - Semanal: todo domingo ao meio-dia (semana de segunda a domingo).
 *  - Mensal: no último dia do mês. Se cai de segunda a sexta, fica pronto quando o dia termina
 *    (último atendimento concluído: diaEncerrado). Se cai no sábado ou domingo, segue a regra
 *    do domingo: domingo ao meio-dia (o próprio dia, ou o dia seguinte se o mês acabou no sábado).
 * Devolve [{tipo, ref, em}] com o mais recente de cada tipo.
 */
export function fechamentosProntos(agora, diaEncerrado = false) {
  const out = [];
  const meioDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  // semanal
  const dom = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - agora.getDay());
  if (meioDia(dom) > agora) dom.setDate(dom.getDate() - 7);
  out.push({ tipo: "semana", ref: iso(dom), em: meioDia(dom).getTime() });
  // mensal: testa o mês atual e os dois anteriores, fica com o mais novo que já está pronto
  for (const atras of [0, 1, 2]) {
    const ult = new Date(agora.getFullYear(), agora.getMonth() + 1 - atras, 0);
    const ds = ult.getDay();
    let pronto;
    if (ds === 0) pronto = meioDia(ult);
    else if (ds === 6) pronto = meioDia(new Date(ult.getFullYear(), ult.getMonth(), ult.getDate() + 1));
    else if (iso(ult) === iso(agora)) pronto = diaEncerrado ? agora : null;
    else pronto = new Date(ult.getFullYear(), ult.getMonth(), ult.getDate() + 1);   // já passou: pronto desde a virada do dia
    if (pronto && pronto <= agora) { out.push({ tipo: "mes", ref: iso(ult), em: pronto.getTime() }); break; }
  }
  return out;
}

/** O dia de trabalho acabou? Havia horário marcado e não sobrou nenhum em aberto. */
export function diaEncerrado(agsDoDia) {
  const validos = agsDoDia.filter(a => a.status !== "cancelado");
  return validos.length > 0 && !validos.some(a => a.status === "marcado" || a.status === "confirmado");
}

// ---------- fidelidade ----------
/**
 * Cartão fidelidade: a cada N atendimentos concluídos o cliente ganha um prêmio.
 * loja.fidelidade = { ativo, cortes, premio }. Atendimento com premio:true é um resgate (não conta ponto).
 * Devolve null se o programa está desligado.
 */
export function fidelidade(loja, ags) {
  const f = loja && loja.fidelidade;
  const n = f && Math.floor(Number(f.cortes));
  if (!f || !f.ativo || !(n > 0)) return null;
  const feitos = ags.filter(a => a.status === "concluido");
  const usados = feitos.filter(a => a.premio).length;
  const pontos = Math.max(0, feitos.length - usados - usados * n);
  const disponiveis = Math.floor(pontos / n);
  return { cortes: n, premio: f.premio || "1 corte grátis", pontos, disponiveis, selos: disponiveis ? n : pontos % n, falta: disponiveis ? 0 : n - (pontos % n), usados };
}

// ---------- texto para copiar / mandar no WhatsApp ----------
export function textoFechamento(r, titulo, loja = "Barbearia Rodrigues") {
  const l = [`*${loja} — fechamento*`, titulo, "",
    `Entradas: ${reais(r.entradas)}`,
    `  serviços ${reais(r.servicos)}${r.produtos ? ` · shop ${reais(r.produtos)}` : ""}${r.avulsas ? ` · outras ${reais(r.avulsas)}` : ""}`,
    ...Object.entries(r.formas).filter(([, v]) => v).map(([f, v]) => `  ${nomeForma(f)}: ${reais(v)}`),
    `Saídas: ${reais(r.saidas)}`, `Saldo: ${reais(r.saldo)}`];
  if (r.totalComissoes) l.push(`Comissões: ${reais(r.totalComissoes)}`, ...Object.values(r.comissoes).filter(c => c.valor).map(c => `  ${c.nome}: ${reais(c.valor)}`), `Fica para a casa: ${reais(r.liquido)}`);
  l.push("", `Atendimentos: ${r.atendimentos} (ticket médio ${reais(r.ticket)})`, `Cancelamentos: ${r.cancelados} · Faltas: ${r.faltas}`, `Horários vagos preenchidos: ${r.preenchidos}`);
  if (r.gorjetas) l.push(`Gorjetas (ficam com quem atendeu): ${reais(r.gorjetas)}`);
  if (r.premios) l.push(`Prêmios de fidelidade usados: ${r.premios}`);
  return l.join("\n");
}
