// Testes das contas do caixa, das comissões, da fidelidade e das datas dos fechamentos.
// Rodar na raiz do projeto:  node --test testes/
import test from "node:test";
import assert from "node:assert/strict";
import { resumoCaixa, fechamentosProntos, diaEncerrado, fidelidade, periodo, vagasPreenchidas, comissaoSobre, limpaPerm } from "../js/caixa.js";

const ag = (o) => ({ profissional: "p0", profissionalNome: "Arlley", data: "2026-11-10", inicio: "09:00", duracao: 30, total: 40, status: "concluido", ...o });

test("fechamento soma por forma de pagamento e usa o valor do balcão", () => {
  const r = resumoCaixa({
    ini: "2026-11-10", fim: "2026-11-10",
    ags: [ag({ pagamento: { forma: "pix", valor: 45 }, comissaoValor: 18 }), ag({ inicio: "10:00", pagamento: { forma: "dinheiro", valor: 40 }, comissaoValor: 16 }),
      ag({ inicio: "11:00", status: "cancelado", canceladoPor: "cliente" }), ag({ inicio: "12:00", status: "faltou" }), ag({ data: "2026-11-09", pagamento: { forma: "pix", valor: 999 } })],
    lancs: [{ tipo: "saida", valor: 30, data: "2026-11-10" }, { tipo: "entrada", valor: 10, forma: "dinheiro", data: "2026-11-10" }, { tipo: "saida", valor: 500, data: "2026-11-11" }],
    peds: [{ status: "retirado", total: 38, pagamento: { forma: "credito", valor: 38 }, atualizadoEm: new Date(2026, 10, 10, 15).getTime() }, { status: "novo", total: 99, criadoEm: new Date(2026, 10, 10, 15).getTime() }]
  });
  assert.equal(r.servicos, 85);
  assert.equal(r.produtos, 38);
  assert.equal(r.avulsas, 10);
  assert.equal(r.entradas, 133);
  assert.equal(r.saidas, 30);
  assert.equal(r.saldo, 103);
  assert.deepEqual(r.formas, { dinheiro: 50, pix: 45, debito: 0, credito: 38, outro: 0 });
  assert.equal(r.totalComissoes, 34);
  assert.equal(r.liquido, 69);
  assert.equal(r.atendimentos, 2);
  assert.equal(r.cancelados, 1);
  assert.equal(r.canceladosCliente, 1);
  assert.equal(r.faltas, 1);
});

test("atendimento antigo, sem forma de pagamento, entra como não informado pelo total", () => {
  const r = resumoCaixa({ ini: "2026-11-10", fim: "2026-11-10", ags: [ag({})] });
  assert.equal(r.formas.outro, 40);
  assert.equal(r.servicos, 40);
});

test("visão do barbeiro conta só o que é dele e não inclui o shop", () => {
  const r = resumoCaixa({
    ini: "2026-11-10", fim: "2026-11-10", prof: "p1",
    ags: [ag({}), ag({ profissional: "p1", profissionalNome: "Rafael", pagamento: { forma: "pix", valor: 60 }, comissaoValor: 24 })],
    peds: [{ status: "retirado", total: 38, atualizadoEm: new Date(2026, 10, 10, 15).getTime() }]
  });
  assert.equal(r.entradas, 60);
  assert.equal(r.totalComissoes, 24);
  assert.equal(r.produtos, 0);
});

test("horário vago preenchido: outro atendimento por cima de um cancelado", () => {
  assert.equal(vagasPreenchidas([ag({ status: "cancelado" }), ag({ status: "confirmado", inicio: "09:15" })]), 1);
  assert.equal(vagasPreenchidas([ag({ status: "cancelado" }), ag({ status: "confirmado", inicio: "09:30" })]), 0);
  assert.equal(vagasPreenchidas([ag({ status: "cancelado" }), ag({ status: "confirmado", profissional: "p1" })]), 0);
});

test("dinheiro: troco não entra no caixa e gorjeta fica com quem atendeu", () => {
  const r = resumoCaixa({ ini: "2026-11-10", fim: "2026-11-10", ags: [
    ag({ pagamento: { forma: "dinheiro", valor: 40, recebido: 50, troco: 10, gorjeta: 0 }, comissaoValor: 16 }),
    ag({ inicio: "10:00", pagamento: { forma: "dinheiro", valor: 35, recebido: 40, troco: 0, gorjeta: 5 }, comissaoValor: 14 })] });
  assert.equal(r.entradas, 75);            // só o valor dos atendimentos
  assert.equal(r.formas.dinheiro, 75);
  assert.equal(r.troco, 10);
  assert.equal(r.gorjetas, 5);
  assert.equal(r.comissoes.p0.gorjeta, 5);
  assert.equal(r.totalComissoes, 30);      // a gorjeta não mexe na comissão
});

test("comissão arredonda em centavos", () => {
  assert.equal(comissaoSobre(45, 40), 18);
  assert.equal(comissaoSobre(33.33, 35), 11.67);
  assert.equal(comissaoSobre(50, 0), 0);
});

test("semanal fica pronto no domingo ao meio-dia", () => {
  const sem = (d) => fechamentosProntos(d).find(x => x.tipo === "semana").ref;
  assert.equal(sem(new Date(2026, 10, 15, 12, 0)), "2026-11-15");   // domingo, meio-dia em ponto
  assert.equal(sem(new Date(2026, 10, 15, 11, 59)), "2026-11-08");  // domingo antes do meio-dia: ainda o anterior
  assert.equal(sem(new Date(2026, 10, 18, 9, 0)), "2026-11-15");    // quarta: continua o do último domingo
  assert.deepEqual(periodo("semana", "2026-11-15"), { tipo: "semana", ini: "2026-11-09", fim: "2026-11-15", titulo: "Semana de 09/11 a 15/11" });
});

test("mensal em dia de semana: só depois do último atendimento do dia", () => {
  const mes = (d, enc) => fechamentosProntos(d, enc).find(x => x.tipo === "mes").ref;
  // 30/11/2026 é segunda-feira
  assert.equal(mes(new Date(2026, 10, 30, 17, 0), false), "2026-10-31");
  assert.equal(mes(new Date(2026, 10, 30, 17, 0), true), "2026-11-30");
  assert.equal(mes(new Date(2026, 11, 1, 8, 0), false), "2026-11-30");
});

test("mensal no fim de semana segue a regra do domingo ao meio-dia", () => {
  const mes = (d, enc) => fechamentosProntos(d, enc).find(x => x.tipo === "mes").ref;
  // 31/10/2026 é sábado: fica pronto no domingo 01/11 ao meio-dia
  assert.equal(mes(new Date(2026, 9, 31, 18, 0), true), "2026-09-30");
  assert.equal(mes(new Date(2026, 10, 1, 11, 0), true), "2026-09-30");
  assert.equal(mes(new Date(2026, 10, 1, 12, 0), false), "2026-10-31");
  // 31/01/2027 é domingo: pronto no próprio dia ao meio-dia
  assert.equal(mes(new Date(2027, 0, 31, 11, 0), true), "2026-12-31");
  assert.equal(mes(new Date(2027, 0, 31, 12, 30), false), "2027-01-31");
});

test("dia encerrado: havia horário e nenhum ficou em aberto", () => {
  assert.equal(diaEncerrado([]), false);
  assert.equal(diaEncerrado([ag({ status: "cancelado" })]), false);
  assert.equal(diaEncerrado([ag({}), ag({ status: "confirmado" })]), false);
  assert.equal(diaEncerrado([ag({}), ag({ status: "faltou" }), ag({ status: "cancelado" })]), true);
});

test("fidelidade: conta selos, libera prêmio e desconta resgate", () => {
  const loja = { fidelidade: { ativo: true, cortes: 5, premio: "1 corte grátis" } };
  const n = (q, extra = []) => fidelidade(loja, [...Array.from({ length: q }, () => ag({})), ...extra]);
  assert.equal(fidelidade({}, [ag({})]), null);
  assert.equal(fidelidade({ fidelidade: { ativo: false, cortes: 5 } }, []), null);
  assert.deepEqual([n(3).selos, n(3).falta, n(3).disponiveis], [3, 2, 0]);
  assert.deepEqual([n(5).selos, n(5).falta, n(5).disponiveis], [5, 0, 1]);
  const depois = n(6, [ag({ premio: true })]);            // 6 cortes pagos + 1 resgate
  assert.deepEqual([depois.pontos, depois.disponiveis, depois.selos], [1, 0, 1]);
  assert.equal(n(2, [ag({ status: "cancelado" }), ag({ status: "faltou" })]).pontos, 2);
});

test("permissões: só passa o que existe e está ligado", () => {
  assert.deepEqual(limpaPerm({ clientes: true, caixa: false, admin: true, estoque: "sim" }), { clientes: true });
});
