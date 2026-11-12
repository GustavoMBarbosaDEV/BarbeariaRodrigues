# Segurança

## Como avisar de uma falha

Achou uma falha de segurança no app da Barbearia Rodrigues? Avise em particular, sem abrir issue pública:
use **Security → Report a vulnerability** neste repositório (aviso privado do GitHub).

Diga o que você fez, o que aconteceu e o que esperava que acontecesse. Não acesse nem altere dados de outras pessoas para provar a falha.

## Como o app protege os dados

- **Regras do banco** (`firestore.rules`): tudo fechado por padrão. Cliente só lê e altera o que é dele; barbeiro só o que o dono liberou; dono tudo. As regras são testadas a cada mudança (`testes-regras/`).
- **Nada de segredo no navegador**: as chaves do `firebase-config.js` são públicas por natureza. Conta de serviço e tokens ficam só em *Secrets* (GitHub e Cloudflare).
- **Política de conteúdo (CSP)** e cabeçalhos de segurança no `firebase.json`; nenhum script escrito dentro do HTML; bibliotecas e fontes servidas do próprio site.
- **Só `dist/` é publicado**, montado por uma lista fixa de arquivos (`ferramentas/build.mjs`).
- **Dados pessoais (LGPD)**: CPF e nascimento só para o cliente e a equipe autorizada; o cliente apaga o cadastro e a conta pelo app; nada de dado pessoal no cache do aparelho depois de sair.

## Se acontecer um incidente

1. **Conter**: travar as regras (`allow read, write: if false`), tirar o acesso de contas suspeitas (Mais → Equipe e Ajustes → Quem acessa o painel), trocar chaves vazadas.
2. **Investigar**: o que entrou, quando e por onde (regra frouxa, segredo no Git, conta de barbeiro comprometida).
3. **Corrigir** no branch `testes`, testar e publicar.
4. **Comunicar** as pessoas afetadas com clareza. Pela LGPD, incidente com risco relevante deve ser comunicado à ANPD e aos titulares (confirme as exigências no site da ANPD).
5. **Registrar** o que aconteceu e o que mudou.
