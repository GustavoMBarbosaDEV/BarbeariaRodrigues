// Testes das regras do serviço de avisos (avisos-worker/src/logica.js): quem recebe lembrete e aviso de vaga.
// Rodar na raiz do projeto:  node --test "testes/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { relogio, inicioMs, lembretesDevidos, vagaAberta, vagasDevidas, deDoc } from "../avisos-worker/src/logica.js";

const loja = { lembreteMin: 120, cancelarAteMin: 90, horario: { 0: null, 1: { abre: "08:00", fecha: "19:00", pausa: ["12:00", "13:00"] }, 2: { abre: "08:00", fecha: "19:00", pausa: ["12:00", "13:00"] } } };
const profs = [{ id: "p0", ativo: true, servicos: [] }, { id: "p1", ativo: true, servicos: [], horario: { 1: { abre: "13:00", fecha: "18:00" } } }];
// 09/11/2026 é segunda-feira. 10:00 em Brasília = 13:00 UTC.
const as = (data, hora) => inicioMs(data, hora);

test("relógio da barbearia é o de Brasília (UTC-3)", () => {
  assert.deepEqual(relogio(Date.UTC(2026, 10, 9, 13, 0)), { data: "2026-11-09", minutos: 600, diaSemana: 1 });
  assert.deepEqual(relogio(Date.UTC(2026, 10, 10, 1, 30)), { data: "2026-11-09", minutos: 22 * 60 + 30, diaSemana: 1 });
  assert.equal(as("2026-11-09", "10:00"), Date.UTC(2026, 10, 9, 13, 0));
});

test("lembrete sai dentro das 2 horas, uma vez só, com o prazo de cancelamento", () => {
  const ag = o => ({ id: "a1", uid: "u1", data: "2026-11-09", inicio: "10:00", status: "confirmado", profissionalNome: "Arlley", criadoEm: 0, ...o });
  const agora = as("2026-11-09", "08:00");
  const l = lembretesDevidos([ag({})], agora, loja);
  assert.equal(l.length, 1);
  assert.equal(l[0].titulo, "Seu horário é às 10:00");
  assert.match(l[0].texto, /cancele pelo app até as 08:30/);
  assert.equal(lembretesDevidos([ag({})], as("2026-11-09", "07:55"), loja).length, 0);           // ainda faltam mais de 2 h
  assert.equal(lembretesDevidos([ag({ lembreteEm: 123 })], agora, loja).length, 0);               // já avisado
  assert.equal(lembretesDevidos([ag({ status: "cancelado" })], agora, loja).length, 0);
  assert.equal(lembretesDevidos([ag({})], as("2026-11-09", "10:05"), loja).length, 0);           // já começou
  assert.equal(lembretesDevidos([ag({ criadoEm: agora - 60000 })], agora, loja).length, 0);       // acabou de marcar
  assert.match(lembretesDevidos([ag({})], as("2026-11-09", "09:00"), loja)[0].texto, /Te esperamos/);   // prazo de cancelar já passou
  assert.equal(lembretesDevidos([ag({})], agora, { ...loja, lembreteMin: 0 }).length, 0);          // lembrete desligado
});

test("vaga: livre só se algum profissional que atende naquele horário está sem bloqueio", () => {
  const e = { id: "u1_2026-11-09_0900", uid: "u1", data: "2026-11-09", hora: "09:00", duracao: 30, servicos: [], profissional: "", push: true };
  const agora = as("2026-11-09", "07:00");
  assert.equal(vagaAberta(e, new Set(), profs, loja, agora), true);
  assert.equal(vagaAberta(e, new Set(["p0_0900"]), profs, loja, agora), false);     // p0 ocupado; p1 só trabalha à tarde na segunda
  assert.equal(vagaAberta(e, new Set(["p0_0915"]), profs, loja, agora), false);     // o segundo bloco de 15 min está ocupado
  assert.equal(vagaAberta({ ...e, hora: "14:00" }, new Set(["p0_1400"]), profs, loja, agora), true);   // à tarde o p1 atende
  assert.equal(vagaAberta({ ...e, hora: "14:00", profissional: "p0" }, new Set(["p0_1400"]), profs, loja, agora), false);
  assert.equal(vagaAberta({ ...e, hora: "12:00" }, new Set(), profs, loja, agora), false);             // pausa do almoço
  assert.equal(vagaAberta(e, new Set(), profs, loja, as("2026-11-09", "09:01")), false);               // já passou
  assert.equal(vagaAberta({ ...e, data: "2026-11-08" }, new Set(), profs, loja, as("2026-11-07", "09:00")), false);   // domingo fechado
});

test("vagas devidas: só quem tem aviso ligado e ainda não foi avisado", () => {
  const base = { uid: "u1", data: "2026-11-09", hora: "09:00", duracao: 30, servicos: [], profissional: "" };
  const esperas = [{ id: "a", ...base, push: true }, { id: "b", ...base, push: false }, { id: "c", ...base, push: true, pushEm: 5 }, { id: "d", ...base, push: true, data: "2026-11-10" }];
  const v = vagasDevidas(esperas, { "2026-11-09": [] }, profs, loja, as("2026-11-09", "07:00"));
  assert.deepEqual(v.map(x => x.id), ["a"]);
  assert.equal(v[0].link, "agendar?vaga=a");
  assert.equal(vagasDevidas(esperas, { "2026-11-09": [{ profissional: "p0", hora: "0900" }] }, profs, loja, as("2026-11-09", "07:00")).length, 0);
});

test("lê o formato de documento do Firestore", () => {
  const d = deDoc({ name: "projects/p/databases/(default)/documents/agendamentos/ag1", fields: { uid: { stringValue: "u1" }, total: { integerValue: "40" }, ok: { booleanValue: true }, servicos: { arrayValue: { values: [{ mapValue: { fields: { nome: { stringValue: "Corte" } } } }] } } } });
  assert.deepEqual(d, { id: "ag1", uid: "u1", total: 40, ok: true, servicos: [{ nome: "Corte" }] });
});
