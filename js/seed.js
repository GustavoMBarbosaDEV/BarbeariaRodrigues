// =====================================================================
//  Dados iniciais
//  - catalogo(): serviços (tirados do Booksy da barbearia), equipe, produtos,
//    galeria e configurações. O dono pode carregar isso no Firebase em
//    Ajustes → "Carregar dados iniciais" e depois editar tudo pelo app.
//  - dadosIniciais(): o catálogo + clientes e horários de EXEMPLO,
//    usados só no modo demonstração.
// =====================================================================
import { hoje, somaDias, diaSemana } from "./util.js";

const semana = (abre = "08:00", fecha = "18:00", pausa = ["12:00", "14:00"]) => ({ abre, fecha, pausa });

export function catalogo() {
  const loja = {
    nome: "Barbearia Rodrigues",
    slogan: "A barbearia que valoriza sua história. No seu tempo, no seu caminho.",
    sobre: "Mais de 7 anos de atendimento personalizado em Teixeiras. Corte, barba, química, corte infantil e cursos — tudo com o cuidado de quem conhece você pelo nome.",
    endereco: "Rua Etelvina Gonçalves Rigueira, 172",
    cidade: "Teixeiras - MG, 36580-000",
    whatsapp: "",
    instagram: "rodriguesbarbearia__",
    intervalo: 30,            // de quantos em quantos minutos começam os horários
    antecedenciaMin: 30,      // minutos mínimos entre agora e o horário marcado
    cancelarAteHoras: 2,      // até quantas horas antes o cliente pode cancelar sozinho
    diasAFrente: 30,          // até quantos dias à frente dá para marcar
    horario: {                // 0 = domingo ... 6 = sábado; null = fechado
      0: null,
      1: semana(), 2: semana(), 3: semana(), 4: semana(), 5: semana(),
      6: semana("08:00", "14:00", null)
    },
    cupomAniversario: "Na semana do seu aniversário, ganhe 10% de desconto no corte.",
    criadoEm: Date.now()
  };

  const s = (categoria, nome, preco, duracao, descricao = "", extra = {}) => ({ categoria, nome, preco, duracao, descricao, ativo: true, aPartir: false, ...extra });
  const servicos = [
    s("Cortes", "Corte", 30, 30, "Corte completo: degradê, social na tesoura, navalhado e outros estilos, com máquina e/ou tesoura.", { destaque: true }),
    s("Cortes", "Corte infantil", 30, 60, "Corte com calma e diversão para os pequenos, com certificado de bravura no primeiro corte.", { destaque: true }),
    s("Cortes", "Máquina", 25, 30, "Somente máquina, até 2 graduações (ex.: 1 nas laterais e 2 em cima). Não inclui degradê, tesoura ou navalhado."),
    s("Cortes", "Sobrancelha pinça", 12, 10),
    s("Cortes", "Sobrancelha navalha", 10, 10),
    s("Cortes", "Desenho (freestyle)", 10, 15),
    s("Cortes", "Ajuste", 10, 15, "Retirar volume ou acertar uma parte desigual ou o pezinho. Até 7 dias depois do último corte."),
    s("Cortes", "Pezinho", 10, 10),
    s("Barba", "Barbaterapia", 30, 30, "Tratamento completo que hidrata, alinha e relaxa a barba.", { destaque: true }),
    s("Barba", "Limpeza facial", 25, 30, "Limpeza facial relaxante."),
    s("Barba", "Barba express", 15, 30, "O básico: aparo simples da barba."),
    s("Combos", "Combo Máximo", 85, 60, "Corte + sobrancelha + barbaterapia + limpeza facial."),
    s("Combos", "Combo Avançado", 65, 60, "Corte + sobrancelha + barbaterapia."),
    s("Combos", "Combo Superior", 60, 60, "Corte + barbaterapia: o clássico da barbearia.", { destaque: true }),
    s("Combos", "Combo Médio", 55, 60, "Corte + limpeza facial."),
    s("Combos", "Combo Essence", 50, 30, "Barbaterapia + limpeza facial."),
    s("Combos", "Combo Flash", 50, 60, "Corte + barba + sobrancelha."),
    s("Combos", "Corte + barba", 45, 60),
    s("Combos", "Corte + sobrancelha", 35, 30),
    s("Combos", "Barba + pezinho", 20, 45),
    s("Combos", "Máquina + barba + sobrancelha", 45, 60),
    s("Combos", "Máquina + barba", 40, 60),
    s("Combos", "Máquina + sobrancelha", 35, 35),
    s("Química", "Selagem", 100, 30, "Valor a partir de R$ 100, conforme o comprimento.", { aPartir: true }),
    s("Química", "Pigmentação", 20, 30),
    s("Química", "Clareamento / Luzes", 35, 60),
    s("Química", "Platinado", 80, 120)
  ].map((x, i) => ({ ...x, ordem: i }));

  const profissionais = [
    { nome: "Arlley", funcao: "Barbeiro", foto: "", servicos: [], horario: null, ativo: true, ordem: 0 },
    { nome: "Miguel", funcao: "Barbeiro", foto: "", servicos: [], horario: null, ativo: true, ordem: 1 }
  ];

  // Preços de EXEMPLO: o dono confere e ajusta em Estoque.
  const p = (categoria, nome, preco, custo, quantidade, minimo, descricao = "") => ({ categoria, nome, preco, custo, quantidade, minimo, descricao });
  const produtos = [
    p("Cabelo", "Pomada modeladora Caramelo", 35, 18, 12, 4, "Fixação média com efeito natural. Fácil de remodelar ao longo do dia."),
    p("Cabelo", "Gel Boy fixação forte", 25, 12, 15, 5, "Para cabelos rebeldes: fixação forte sem deixar o fio duro."),
    p("Cabelo", "Gel infantil", 20, 9, 10, 4, "Arrumar o cabelo dos pequenos para a escola fica fácil."),
    p("Cabelo", "Shampoo 3 em 1", 30, 14, 8, 3, "Cabelo, barba e corpo num só produto."),
    p("Cabelo", "Máscara de hidratação", 40, 20, 6, 2, "Cuidar do cabelo é autocuidado. Uso semanal."),
    p("Barba", "Minoxidil 5%", 90, 55, 5, 2, "Ajuda no crescimento de barba e cabelo. Uso conforme orientação."),
    p("Barba", "Óleo para barba", 35, 16, 9, 3, "Hidrata, dá brilho e deixa a barba macia."),
    p("Barba", "Balm para barba", 30, 14, 2, 3, "Alinha os fios e hidrata a pele por baixo da barba."),
    p("Barba", "Pós-barba", 28, 12, 7, 3, "Acalma a pele depois do barbear."),
    p("Fragrâncias", "Perfume masculino", 120, 70, 4, 2, "Fragrâncias clássicas e modernas. Pergunte as opções na barbearia."),
    p("Acessórios", "Pente de bolso", 15, 5, 20, 5, "Para manter o penteado o dia todo.")
  ].map((x, i) => ({ ...x, ordem: i }));

  const galeria = [
    ["cortes/degrade-social.jpg", "Degradê social"],
    ["cortes/low-fade.jpg", "Low fade"],
    ["cortes/platinado.jpg", "Platinado"],
    ["cortes/social-tesoura.jpg", "Social na tesoura"],
    ["cortes/cacheado.jpg", "Cacheado com volume"],
    ["cortes/barba-degrade.jpg", "Barba e degradê"],
    ["cortes/mid-fade.jpg", "Mid fade"],
    ["cortes/luzes.jpg", "Luzes"],
    ["cortes/social-classico.jpg", "Social clássico"],
    ["cortes/acabamento.jpg", "Acabamento na navalha"],
    ["casa/infantil.jpg", "Corte infantil"],
    ["casa/atendimento.jpg", "Atendimento"]
  ].map(([foto, titulo], ordem) => ({ foto: "img/" + foto, titulo, ordem }));

  const avisos = [
    { titulo: "Agende pelo app", texto: "Agora você marca, remarca e cancela seu horário direto por aqui, sem precisar mandar mensagem.", em: Date.now() }
  ];

  return { loja, servicos, profissionais, produtos, galeria, avisos };
}

/** Banco completo do modo demonstração (inclui exemplos de clientes e horários). */
export function dadosIniciais() {
  const cat = catalogo();
  const c = {};
  const put = (col, id, d) => ((c[col] ||= {})[id] = d);
  put("config", "loja", cat.loja);
  put("config", "admins", { emails: ["dono@demo"] });
  cat.servicos.forEach((s, i) => put("servicos", "s" + i, s));
  cat.profissionais.forEach((p, i) => put("profissionais", "p" + i, p));
  cat.galeria.forEach((g, i) => put("galeria", "g" + i, g));
  cat.avisos.forEach((a, i) => put("avisos", "a" + i, a));
  cat.produtos.forEach((p, i) => {
    const { custo, quantidade, minimo, ...pub } = p;
    put("produtos", "pr" + i, { ...pub, foto: "", ativo: true, disponivel: quantidade > 0 });
    put("estoque", "pr" + i, { custo, quantidade, minimo, atualizadoEm: Date.now() });
  });

  // ---- clientes de EXEMPLO (nomes fictícios) ----
  const clientes = [
    ["ex1", "João Exemplo da Silva", "52998224725", "1995-" + hoje().slice(5, 7) + "-20", "31999990001"],
    ["ex2", "Pedro Teste Oliveira", "11144477735", "2001-03-14", "31999990002"],
    ["ex3", "Lucas Modelo Souza", "93541134780", "1988-11-02", "31999990003"]
  ];
  clientes.forEach(([id, nome, cpf, nascimento, telefone]) => {
    put("clientes", id, { nome, cpf, nascimento, telefone, email: "", manual: true, aceite: true, criadoEm: Date.now() - 86400000 * 40 });
    put("cpfs", cpf, { uid: id });
  });

  // ---- horários de EXEMPLO ----
  let d = hoje();
  while (!cat.loja.horario[diaSemana(d)]) d = somaDias(d, 1);
  const ag = (id, uidC, nome, sv, prof, data, inicio, status, extra = {}) => {
    const s = cat.servicos[sv];
    put("agendamentos", id, {
      uid: uidC, clienteNome: nome, servicos: [{ id: "s" + sv, nome: s.nome, preco: s.preco, duracao: s.duracao }],
      total: s.preco, duracao: s.duracao, profissional: "p" + prof, profissionalNome: cat.profissionais[prof].nome,
      data, inicio, status, obs: "", criadoEm: Date.now() - 3600000, ...extra
    });
    const [h, m] = inicio.split(":").map(Number);
    for (let t = h * 60 + m; t < h * 60 + m + s.duracao; t += 15) {
      if (status === "cancelado") break;
      const hh = String(Math.floor(t / 60)).padStart(2, "0") + String(t % 60).padStart(2, "0");
      put("bloqueios", `p${prof}_${data}_${hh}`, { profissional: "p" + prof, data, hora: hh, uid: uidC, ag: id });
    }
  };
  ag("ag1", "ex1", "João Exemplo da Silva", 0, 0, d, "09:00", "confirmado");
  ag("ag2", "ex2", "Pedro Teste Oliveira", 13, 1, d, "10:00", "marcado");
  ag("ag3", "ex3", "Lucas Modelo Souza", 8, 0, d, "15:00", "marcado");
  ag("ag4", "ex1", "João Exemplo da Silva", 0, 1, somaDias(hoje(), -20), "16:00", "concluido");
  ag("ag5", "ex2", "Pedro Teste Oliveira", 17, 0, somaDias(hoje(), -6), "11:00", "concluido");
  ag("ag6", "demo-cliente", "", 0, 0, somaDias(hoje(), -12), "14:00", "concluido");
  put("pedidos", "pd1", { uid: "ex3", clienteNome: "Lucas Modelo Souza", itens: [{ id: "pr0", nome: "Pomada modeladora Caramelo", preco: 35, qtd: 1 }], total: 35, status: "novo", criadoEm: Date.now() - 7200000 });
  return c;
}
