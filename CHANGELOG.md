# Histórico de versões — Barbearia Rodrigues

O número segue o padrão **MAIOR.MENOR.CORREÇÃO** (igual ao Monetra).
Ao publicar, atualize `VERSAO` em `js/app.js`, `CACHE` em `sw.js`, escreva aqui o que mudou e marque o commit com uma tag (ex.: `v1.0.0`).

---

## 2.0.0 — 12/11/2026 **Mesmas funções e regras do app padrão de barbearia, com a cara da Rodrigues**

O código passou a ser o do app padrão (o mesmo da Barbearia Carmo). O que é só da Rodrigues continua: nome, logo, fotos, serviços e preços do Booksy, equipe (Arlley e Miguel), endereço, horário e as cores preto, couro e dourado.

**O que entrou**
- Três tipos de conta: dono, barbeiro (com permissões que o dono liga em Equipe) e cliente.
- Concluir = receber: forma de pagamento, troco e gorjeta em dinheiro.
- Caixa com fechamento de dia, semana e mês; entradas e saídas avulsas; resumo para WhatsApp ou impressão.
- Comissão por barbeiro, guardada na hora de concluir.
- Lista de espera com aviso de vaga, cartão fidelidade (vem desligado), lembrete 2 h antes e cancelamento até 1h30 antes (ajustáveis em Ajustes).
- Avisos com o app fechado (pasta `avisos-worker/`, ainda não publicado).
- Segurança: regras do Firestore novas com testes, CSP, fontes e Firebase servidos do próprio site (sem Google Fonts nem gstatic), build por lista fixa e verificações automáticas no GitHub.
- Abertura e início redesenhados com as fotos e a logo da Rodrigues; temas escuro e claro.

**Padrões colocados (o dono ainda não definiu):** lembrete 2 h, cancelar até 1h30, dinheiro/Pix/débito/crédito, fidelidade desligada (10 atendimentos = 1 corte grátis), comissão 0% até ser definida em Equipe.

**Testado** (modo demonstração, celular 390×844): 17 testes automáticos; todas as telas de cliente, barbeiro e dono, sem erro no console e sem pedido a outro endereço; rota proibida volta para o início (cliente) ou para a agenda (barbeiro); concluir em dinheiro com falta, troco e gorjeta, e o valor aparecendo no Caixa; o build de publicação (`node build.mjs`) monta a pasta `dist/` sem erro.

**Não testado:** Firebase de verdade (login, regras em produção, App Check); regras no emulador; avisos com o app fechado; roteiro completo da lista de espera; tela de computador.

**Pendente:** e-mails dos donos em `firestore.rules`; logo em alta resolução; fotos dos produtos e da equipe.

---

## 1.0.0 — 19/10/2026 **Primeira versão**

**Cliente**
- Início com foto da equipe, logo, situação (aberto/fechado), serviços populares, galeria, equipe, shop, avaliações, horário de funcionamento e endereço com mapa.
- Agendamento em 4 passos (serviços → barbeiro → dia/horário → confirmar), somando duração e preço de vários serviços; pula sozinho para o primeiro dia com horário livre.
- Meus horários: remarcar, cancelar até X horas antes, arquivo de calendário (.ics) com lembrete 1 dia e 1 hora antes, avaliar com estrelas e agendar de novo.
- Serviços e preços do Booksy da barbearia (Cortes, Barba, 12 Combos e Química).
- Galeria de cortes com fotos do Instagram e visualização em tela cheia.
- Shop com busca, categorias, sacola e reserva para retirar; "Meus pedidos" com status.
- Cadastro com nome completo, CPF (validação dos dígitos e CPF único por conta), nascimento e celular; aceite LGPD; apagar cadastro.
- Notificações no sininho e no aparelho: confirmação/cancelamento, lembrete de hoje/amanhã, pedido pronto, avisos e aniversário.
- Tema escuro (padrão), claro e automático.

**Dono**
- Agenda por barbeiro com resumo do dia, lista do que aguarda confirmação, confirmar/concluir/faltou/cancelar, lembrete no WhatsApp, encaixe (com cliente sem cadastro) e bloqueio de horário.
- Clientes: busca por nome/CPF/celular, aniversariantes, sumidos há 45+ dias, ficha com histórico, total gasto, serviço preferido, anotações internas, mensagem no app e planilha CSV.
- Estoque: custo, venda, mínimo, entradas/saídas com motivo, histórico e alerta de estoque baixo; fotos dos produtos.
- Pedidos do Shop com baixa automática no estoque ao entregar.
- Relatórios por período (hoje, 7 dias, mês, mês passado, ano).
- Serviços, equipe (foto, serviços que faz, horário próprio), avisos, galeria e ajustes (dados, horário, regras da agenda, quem acessa o painel, carregar dados iniciais, backup).
- Modo demonstração quando o Firebase ainda não está configurado.
