# Histórico de versões — Barbearia Rodrigues

O número segue o padrão **MAIOR.MENOR.CORREÇÃO** (igual ao Monetra).
Ao publicar, atualize `VERSAO` em `js/app.js`, `CACHE` em `sw.js`, escreva aqui o que mudou e marque o commit com uma tag (ex.: `v1.0.0`).

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
