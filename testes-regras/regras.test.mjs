// Testes das regras do Firestore (../firestore.rules) no emulador do Firebase.
// Rodar: cd testes-regras && npm ci && npm test      (precisa de Java 21; no GitHub roda sozinho a cada mudança das regras)
// O que estes testes garantem: cliente só vê o que é dele; barbeiro só faz o que o dono liberou
// e não consegue se promover nem mexer na própria comissão; o dono pode tudo; deslogado não entra.
import { initializeTestEnvironment, assertSucceeds as ok, assertFails as nega } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import fs from "node:fs";
import test, { before, after, beforeEach } from "node:test";

const DONO = "dono@teste.com";
// troca os e-mails fixos das regras pelos de teste (assim o teste vale antes e depois de o dono colocar os e-mails reais)
const regras = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
  .replace(/meuEmail\(\) in \[[^\]]*\]; \}/, `meuEmail() in ["${DONO}", "dev@teste.com"]; }`);

let amb;
const conta = (uid, email) => amb.authenticatedContext(uid, { email, email_verified: true }).firestore();
let dono, dev, barb, barb2, cliA, cliB, anon;

const AG = (o) => ({ uid: "cliA", clienteNome: "Cliente A", clienteTelefone: "31999990001", servicos: [{ id: "s0", nome: "Corte", preco: 40, duracao: 30 }], duracao: 30, total: 40,
  profissional: "p1", profissionalNome: "Barbeiro Um", data: "2030-01-10", inicio: "09:00", fim: "09:30", status: "marcado", obs: "", origem: "app", criadoEm: 1, criadoPor: "cliA", ...o });

before(async () => {
  amb = await initializeTestEnvironment({ projectId: "demo-barbearia-rodrigues", firestore: { rules: regras } });
});
after(async () => { await amb.cleanup(); });
beforeEach(async () => {
  await amb.clearFirestore();
  dono = conta("dono", DONO); dev = conta("dev", "dev@teste.com");
  barb = conta("barb", "barb@teste.com"); barb2 = conta("barb2", "barb2@teste.com");
  cliA = conta("cliA", "a@teste.com"); cliB = conta("cliB", "b@teste.com");
  anon = amb.unauthenticatedContext().firestore();
  await amb.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "config/loja"), { nome: "Barbearia" });
    await setDoc(doc(db, "config/admins"), { emails: ["gerente@teste.com"] });
    await setDoc(doc(db, "servicos/s0"), { nome: "Corte", preco: 40 });
    await setDoc(doc(db, "equipe/p1"), { email: "barb@teste.com", comissao: 40 });
    await setDoc(doc(db, "equipe/p2"), { email: "barb2@teste.com", comissao: 30 });
    await setDoc(doc(db, "acessos/barb@teste.com"), { prof: "p1", perm: { clientes: true, caixa: true } });
    await setDoc(doc(db, "acessos/barb2@teste.com"), { prof: "p2", perm: {} });
    await setDoc(doc(db, "clientes/cliA"), { nome: "Cliente A Silva", cpf: "52998224725", nascimento: "1990-01-01", telefone: "31999990001", email: "a@teste.com", aceite: true });
    await setDoc(doc(db, "clientes/cliB"), { nome: "Cliente B Souza", cpf: "11144477735", nascimento: "1991-01-01", telefone: "31999990002", email: "b@teste.com", aceite: true });
    await setDoc(doc(db, "agendamentos/ag1"), AG({ status: "confirmado" }));
    await setDoc(doc(db, "agendamentos/ag2"), AG({ uid: "cliB", profissional: "p2", status: "confirmado", inicio: "10:00" }));
    await setDoc(doc(db, "caixa/c1"), { tipo: "saida", valor: 20, descricao: "Lâminas", forma: "dinheiro", data: "2030-01-10", em: 1, por: "barb", porNome: "Barbeiro Um", profissional: "p1" });
    await setDoc(doc(db, "caixa/c2"), { tipo: "saida", valor: 99, descricao: "Conta de luz", forma: "pix", data: "2030-01-10", em: 1, por: "dono", porNome: "Dono", profissional: "" });
    await setDoc(doc(db, "comissoes/ag2"), { profissional: "p2", data: "2030-01-09", base: 40, pct: 30, valor: 12, em: 1 });
    await setDoc(doc(db, "estoque/pr0"), { quantidade: 5, custo: 10, minimo: 2 });
    await setDoc(doc(db, "espera/cliA_2030-01-10_1000"), { uid: "cliA", clienteNome: "Cliente A", clienteTelefone: "31999990001", data: "2030-01-10", hora: "10:00", profissional: "", servicos: ["s0"], duracao: 30, push: false, criadoEm: 1 });
    await setDoc(doc(db, "push/cliA"), { tokens: ["t1"], atualizadoEm: 1 });
    await setDoc(doc(db, "notificacoes/cliA/itens/n1"), { titulo: "Oi", texto: "Teste", link: "horarios", em: 1, lida: false });
  });
});

test("deslogado: vê só o que é público", async () => {
  await ok(getDoc(doc(anon, "config/loja")));
  await ok(getDoc(doc(anon, "servicos/s0")));
  for (const p of ["agendamentos/ag1", "clientes/cliA", "caixa/c1", "comissoes/ag2", "equipe/p1", "acessos/barb@teste.com", "config/admins", "espera/cliA_2030-01-10_1000", "push/cliA", "estoque/pr0"]) await nega(getDoc(doc(anon, p)));
  await nega(setDoc(doc(anon, "servicos/s9"), { nome: "X" }));
  await nega(getDocs(collection(anon, "bloqueios")));
});

test("cliente: só vê e altera o que é dele", async () => {
  await ok(getDoc(doc(cliA, "agendamentos/ag1")));
  await nega(getDoc(doc(cliA, "agendamentos/ag2")));
  await ok(getDocs(query(collection(cliA, "agendamentos"), where("uid", "==", "cliA"))));
  await nega(getDocs(collection(cliA, "agendamentos")));
  await ok(getDoc(doc(cliA, "clientes/cliA")));
  await nega(getDoc(doc(cliA, "clientes/cliB")));
  await nega(getDocs(collection(cliA, "clientes")));
  for (const p of ["caixa/c1", "comissoes/ag2", "equipe/p1", "acessos/barb@teste.com", "config/admins", "estoque/pr0", "fichas/cliA", "push/cliB"]) await nega(getDoc(doc(cliA, p)));
  await nega(getDoc(doc(cliB, "espera/cliA_2030-01-10_1000")));
  await nega(getDoc(doc(cliB, "notificacoes/cliA/itens/n1")));
});

test("cliente: cancela o próprio horário, mas não conclui, não muda preço nem mexe no dos outros", async () => {
  await ok(updateDoc(doc(cliA, "agendamentos/ag1"), { status: "cancelado", atualizadoEm: 2, canceladoPor: "cliente" }));
  await nega(updateDoc(doc(cliA, "agendamentos/ag1"), { status: "confirmado" }));
  await nega(updateDoc(doc(cliB, "agendamentos/ag2"), { status: "concluido" }));
  await nega(updateDoc(doc(cliB, "agendamentos/ag2"), { status: "cancelado", total: 1 }));
  await nega(updateDoc(doc(cliA, "agendamentos/ag2"), { status: "cancelado", atualizadoEm: 2 }));
  await nega(deleteDoc(doc(cliA, "agendamentos/ag1")));
});

test("cliente: agenda só em nome próprio e sem campo extra", async () => {
  await ok(setDoc(doc(cliA, "agendamentos/novo1"), AG({})));
  await nega(setDoc(doc(cliA, "agendamentos/novo2"), AG({ uid: "cliB" })));
  await nega(setDoc(doc(cliA, "agendamentos/novo3"), AG({ status: "concluido" })));
  await nega(setDoc(doc(cliA, "agendamentos/novo4"), AG({ pagamento: { forma: "pix", valor: 0 } })));
  await nega(setDoc(doc(cliA, "agendamentos/novo5"), AG({ total: -5 })));
  await nega(setDoc(doc(cliA, 'agendamentos/x"><img src=x>'), AG({})));          // id com código não entra
});

test("cliente: não consegue virar barbeiro nem dono", async () => {
  await nega(setDoc(doc(cliA, "acessos/a@teste.com"), { prof: "p1", perm: { caixaGeral: true } }));
  await nega(setDoc(doc(cliA, "config/admins"), { emails: ["a@teste.com"] }));
  await nega(setDoc(doc(cliA, "equipe/p1"), { email: "a@teste.com", comissao: 100 }));
  await nega(setDoc(doc(cliA, "comissoes/ag1"), { profissional: "p1", data: "2030-01-10", base: 40, pct: 40, valor: 16, em: 1 }));
  await nega(setDoc(doc(cliA, "caixa/x"), { tipo: "entrada", valor: 10, descricao: "x", forma: "pix", data: "2030-01-10", em: 1, por: "cliA", porNome: "A", profissional: "" }));
  await nega(setDoc(doc(cliA, "notificacoes/cliB/itens/x"), { titulo: "a", texto: "b", link: "", em: 1, lida: false }));
});

test("lista de espera: cada um cuida da sua; a equipe só marca como avisado", async () => {
  const e = { uid: "cliB", clienteNome: "Cliente B", clienteTelefone: "31999990002", data: "2030-01-10", hora: "09:00", profissional: "p1", servicos: ["s0"], duracao: 30, push: true, criadoEm: 1 };
  await ok(setDoc(doc(cliB, "espera/cliB_2030-01-10_0900"), e));
  await nega(setDoc(doc(cliB, "espera/outro_id"), e));
  await nega(setDoc(doc(cliB, "espera/cliA_2030-01-10_0900"), { ...e, uid: "cliA" }));
  await nega(setDoc(doc(cliB, "espera/cliB_2030-01-10_0930"), { ...e, hora: "09:30", admin: true }));
  await ok(getDocs(query(collection(cliB, "espera"), where("uid", "==", "cliB"))));
  await ok(getDocs(query(collection(barb, "espera"), where("data", "==", "2030-01-10"))));
  await ok(updateDoc(doc(barb, "espera/cliA_2030-01-10_1000"), { avisadoEm: 5 }));
  await nega(updateDoc(doc(barb, "espera/cliA_2030-01-10_1000"), { hora: "11:00" }));
  await ok(deleteDoc(doc(cliA, "espera/cliA_2030-01-10_1000")));
});

test("barbeiro: vê a agenda, mexe só nos próprios horários", async () => {
  await ok(getDocs(query(collection(barb, "agendamentos"), where("data", "==", "2030-01-10"))));
  await ok(updateDoc(doc(barb, "agendamentos/ag1"), { status: "concluido", atualizadoEm: 2, concluidoEm: 2, pagamento: { forma: "dinheiro", valor: 40, recebido: 50, troco: 10, gorjeta: 0 }, premio: false }));
  await nega(updateDoc(doc(barb, "agendamentos/ag2"), { status: "concluido" }));
  await nega(updateDoc(doc(barb, "agendamentos/ag1"), { profissional: "p2" }));
  await nega(deleteDoc(doc(barb, "agendamentos/ag1")));
  await ok(setDoc(doc(barb, "agendamentos/balcao1"), AG({ uid: "manual1", status: "confirmado", origem: "balcao", criadoPor: "barb" })));
});

test("barbeiro: lança só a própria comissão, na % que o dono definiu", async () => {
  const c = { profissional: "p1", data: "2030-01-10", base: 40, pct: 40, valor: 16, em: 2 };
  await ok(setDoc(doc(barb, "comissoes/ag1"), c));
  await ok(getDoc(doc(barb, "comissoes/ag1")));
  await nega(setDoc(doc(barb, "comissoes/ag1"), { ...c, pct: 90, valor: 36 }));
  await nega(setDoc(doc(barb, "comissoes/ag1"), { ...c, valor: 400 }));
  await nega(setDoc(doc(barb, "comissoes/ag2"), { ...c, base: 40 }));          // atendimento de outro barbeiro
  await nega(setDoc(doc(barb, "comissoes/ag2"), { ...c, profissional: "p2", pct: 30, valor: 12 }));
  await nega(getDoc(doc(barb, "comissoes/ag2")));
  await ok(getDocs(query(collection(barb, "comissoes"), where("profissional", "==", "p1"))));
  await nega(getDocs(collection(barb, "comissoes")));
  await ok(deleteDoc(doc(barb, "comissoes/ag1")));
  await nega(deleteDoc(doc(barb, "comissoes/ag2")));
});

test("barbeiro: não muda o próprio acesso, a própria comissão nem o catálogo", async () => {
  await ok(getDoc(doc(barb, "acessos/barb@teste.com")));
  await ok(getDoc(doc(barb, "equipe/p1")));
  await nega(getDoc(doc(barb, "equipe/p2")));
  await nega(getDoc(doc(barb, "acessos/barb2@teste.com")));
  await nega(setDoc(doc(barb, "acessos/barb@teste.com"), { prof: "p1", perm: { caixaGeral: true, estoque: true } }));
  await nega(setDoc(doc(barb, "equipe/p1"), { email: "barb@teste.com", comissao: 100 }));
  await nega(setDoc(doc(barb, "config/admins"), { emails: ["barb@teste.com"] }));
  await nega(setDoc(doc(barb, "config/loja"), { nome: "Outra" }));
  await nega(setDoc(doc(barb, "servicos/s0"), { nome: "Corte", preco: 1 }));
  await nega(setDoc(doc(barb, "profissionais/p1"), { nome: "Eu" }));
});

test("barbeiro: só faz o que o dono liberou", async () => {
  // barb tem clientes + caixa; barb2 não tem nada
  await ok(getDocs(collection(barb, "clientes")));
  await nega(getDocs(collection(barb2, "clientes")));
  await nega(getDoc(doc(barb, "estoque/pr0")));
  await nega(getDocs(collection(barb, "pedidos")));
  const l = { tipo: "saida", valor: 15, descricao: "Toalhas", forma: "dinheiro", data: "2030-01-10", em: 3, por: "barb", porNome: "Barbeiro Um", profissional: "p1" };
  await ok(setDoc(doc(barb, "caixa/n1"), l));
  await nega(setDoc(doc(barb, "caixa/n2"), { ...l, por: "dono" }));
  await nega(setDoc(doc(barb, "caixa/n3"), { ...l, valor: -1 }));
  await nega(setDoc(doc(barb, "caixa/n4"), { ...l, aprovado: true }));
  await nega(setDoc(doc(barb2, "caixa/n5"), { ...l, por: "barb2" }));
  await ok(getDoc(doc(barb, "caixa/c1")));
  await nega(getDoc(doc(barb, "caixa/c2")));                                    // lançamento do dono
  await ok(getDocs(query(collection(barb, "caixa"), where("por", "==", "barb"))));
  await nega(getDocs(collection(barb, "caixa")));
  await nega(updateDoc(doc(barb, "caixa/c1"), { valor: 1 }));
  await ok(deleteDoc(doc(barb, "caixa/c1")));
  await nega(deleteDoc(doc(barb, "caixa/c2")));
  await ok(setDoc(doc(barb, "notificacoes/cliA/itens/n2"), { titulo: "Abriu o horário", texto: "Toque para marcar", link: "agendar", em: 2, lida: false }));
  await ok(setDoc(doc(barb2, "clientes/manual9"), { nome: "Cliente Balcão", cpf: "", nascimento: "", telefone: "31999990009", email: "", manual: true, aceite: false, criadoEm: 1 }));
});

test("dono (os dois e-mails fixos e o gerente da lista): pode tudo", async () => {
  const gerente = conta("ger", "gerente@teste.com");
  for (const d of [dono, dev, gerente]) {
    await ok(getDocs(collection(d, "caixa")));
    await ok(getDocs(collection(d, "comissoes")));
    await ok(getDocs(collection(d, "clientes")));
    await ok(getDocs(collection(d, "acessos")));
    await ok(getDoc(doc(d, "equipe/p2")));
  }
  await ok(setDoc(doc(dono, "acessos/novo@teste.com"), { prof: "p3", perm: { clientes: true } }));
  await nega(setDoc(doc(dono, "acessos/ruim@teste.com"), { prof: "p3", perm: { superpoder: true } }));
  await ok(setDoc(doc(dono, "equipe/p3"), { email: "novo@teste.com", comissao: 35 }));
  await nega(setDoc(doc(dono, "equipe/p4"), { email: "x@teste.com", comissao: 150 }));
  await ok(deleteDoc(doc(dono, "acessos/barb@teste.com")));
  await nega(getDocs(query(collection(barb, "agendamentos"), where("data", "==", "2030-01-10"))));   // demitido: perde o acesso na hora
  await ok(updateDoc(doc(dono, "agendamentos/ag2"), { status: "concluido", pagamento: { forma: "pix", valor: 40 } }));
  await ok(setDoc(doc(dono, "comissoes/ag2"), { profissional: "p2", data: "2030-01-10", base: 40, pct: 30, valor: 12, em: 3 }));
  await ok(setDoc(doc(dono, "config/loja"), { nome: "Barbearia Rodrigues" }));
});

test("e-mail não verificado não vale como dono nem como barbeiro", async () => {
  const falso = amb.authenticatedContext("x", { email: DONO, email_verified: false }).firestore();
  await nega(getDocs(collection(falso, "caixa")));
  await nega(getDoc(doc(falso, "config/admins")));
  const falsoBarb = amb.authenticatedContext("y", { email: "barb@teste.com", email_verified: false }).firestore();
  await nega(getDocs(query(collection(falsoBarb, "agendamentos"), where("data", "==", "2030-01-10"))));
});

test("aviso no aparelho e notificações: só a própria pessoa", async () => {
  await ok(setDoc(doc(cliA, "push/cliA"), { tokens: ["t1", "t2"], atualizadoEm: 2 }));
  await nega(setDoc(doc(cliA, "push/cliA"), { tokens: ["1", "2", "3", "4", "5", "6"], atualizadoEm: 2 }));
  await nega(setDoc(doc(cliB, "push/cliA"), { tokens: ["x"], atualizadoEm: 2 }));
  await nega(getDoc(doc(barb, "push/cliA")));
  await ok(updateDoc(doc(cliA, "notificacoes/cliA/itens/n1"), { lida: true }));
  await nega(updateDoc(doc(cliA, "notificacoes/cliA/itens/n1"), { texto: "mudei" }));
});

test("caminho que não existe nas regras fica fechado até para o dono", async () => {
  await nega(setDoc(doc(dono, "qualquer/coisa"), { a: 1 }));
  await nega(getDoc(doc(dono, "qualquer/coisa")));
});
