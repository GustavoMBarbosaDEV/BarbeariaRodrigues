# Serviço de avisos (Cloudflare Workers)

Envia para o celular do cliente, **mesmo com o app fechado**:

- o lembrete do horário, 2 horas antes, com o prazo para cancelar;
- "abriu o horário que você queria", para quem está na lista de espera.

Roda sozinho a cada 5 minutos no plano grátis da Cloudflare (sem cartão). O Firebase continua no plano grátis.
Sem este serviço o app funciona normalmente; os avisos só chegam com o app aberto ou em segundo plano.

**Situação:** as regras de quem recebe aviso estão testadas (`testes/avisos.test.mjs`). A parte que conversa com o Google e
com a Cloudflare ainda **não foi executada de verdade**, porque depende das contas abaixo. O primeiro teste é o passo 6.

## O que precisa existir antes

- O projeto Firebase da barbearia, com o app já publicado no domínio.
- Uma conta gratuita na Cloudflare (da barbearia).

## Passo a passo

1. **Chave de avisos do app.** Firebase → ⚙ Configurações do projeto → Cloud Messaging → *Certificados push da Web* → **Gerar par de chaves**.
   Copie a chave e cole em `PUSH_VAPID_KEY` no `firebase-config.js`. Publique o app.
2. **Conta de serviço só para os avisos.** Google Cloud → IAM → Contas de serviço → **Criar**: nome `avisos-barbearia`.
   Papéis: **Usuário do Cloud Datastore** e **Administrador de API do Firebase Cloud Messaging**. Nada mais.
   Em *Chaves* → **Adicionar chave → JSON**. O arquivo baixado é um segredo: não coloque no repositório, não mande por mensagem.
3. **Ligar a API.** Google Cloud → APIs e serviços → ative **Firebase Cloud Messaging API**.
4. **Entrar na Cloudflare pelo terminal** (dentro desta pasta):
   ```
   cd avisos-worker
   npx wrangler login
   ```
5. **Guardar o segredo e publicar.** Confira `PROJETO` no `wrangler.toml` (é o `projectId` do Firebase). Depois:
   ```
   npx wrangler secret put CONTA_SERVICO
   ```
   Cole o conteúdo inteiro do arquivo JSON e aperte Enter. Em seguida:
   ```
   npx wrangler deploy
   ```
   Depois de publicar, apague o arquivo JSON do computador.
6. **Testar.** No celular, entre no app, ative as notificações em Perfil e marque um horário para daqui a 1h50.
   Feche o app. Em até 10 minutos o lembrete deve chegar. Para ver o que o serviço fez: `npx wrangler tail`.

## Se não funcionar

- `npx wrangler tail` mostra o erro. "Google recusou a conta de serviço": o segredo foi colado errado ou a chave foi apagada.
- **Exceeded CPU limit:** o plano grátis dá 10 ms de processamento por execução. O serviço assina a credencial uma vez por hora
  para caber nisso. Se o erro aparecer com frequência, o caminho é o plano pago da Cloudflare (US$ 5/mês) ou diminuir `MAX_AVISOS`.
- **Nada chega no iPhone:** o cliente precisa ter adicionado o app à Tela de Início e ativado as notificações por lá.
- **Chegou duas vezes:** não deveria. Cada aviso enviado é marcado no banco (`lembreteEm` no agendamento, `pushEm` na lista de espera).

## Limites que o código respeita

| Limite do plano grátis | Como o serviço cabe nele |
|---|---|
| 100.000 execuções por dia | usa 288 |
| 50 chamadas externas por execução | no máximo 8 avisos por rodada; o resto sai 5 minutos depois |
| 10 ms de processamento por execução | credencial assinada 1 vez por hora; o resto é espera de rede, que não conta |
