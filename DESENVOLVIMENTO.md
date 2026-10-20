# Barbearia Rodrigues — guia de desenvolvimento

Anotações técnicas de como o app foi montado, como ligar o Firebase e como publicar.
Para a apresentação do app, veja o [README](README.md).

---

## Como o app foi feito

Mesma base do Monetra: **HTML, CSS e JavaScript puros**, sem framework, sem npm e sem build.
O que está no GitHub é exatamente o que o navegador roda. A diferença é que aqui o código foi
**dividido em módulos** (um arquivo por tela), em vez de um `app.js` gigante.

```
BarbeariaRodrigues/
├── index.html              → página única: tela de abertura + carrega os scripts
├── firebase-config.js      → chaves do Firebase (vazio = modo demonstração)
├── firestore.rules         → regras de segurança (colar no Firebase)
├── manifest.webmanifest    → nome, ícones e cores do app instalado
├── sw.js                   → service worker: abre sem internet e mostra notificações
├── .nojekyll               → GitHub Pages serve os arquivos como estão
├── css/style.css           → visual (tema escuro e claro, celular e computador)
├── img/                    → logo, fotos dos cortes (cortes/) e da barbearia (casa/)
├── icons/                  → ícones do app (192, 512, maskable, apple, favicon)
└── js/
    ├── app.js              → ponto de partida: rotas (#/inicio, #/dono/agenda…), topo e abas
    ├── dados.js            → camada de dados: Firebase OU demonstração (as telas não sabem qual)
    ├── estado.js           → dados que várias telas usam (loja, serviços, equipe, produtos…)
    ├── agenda.js           → horários livres, reservar, cancelar, arquivo de calendário
    ├── notificacoes.js     → sininho + notificações do aparelho
    ├── seed.js             → dados iniciais (serviços do Booksy, equipe, produtos, galeria)
    ├── ui.js               → pedaços de tela reaproveitados
    ├── util.js             → datas, dinheiro, CPF, telefone, modal, toast, ícones
    ├── cliente/            → telas do cliente (início, agendar, horários, shop, perfil…)
    └── dono/               → telas do dono (agenda, clientes, estoque, pedidos, relatórios…)
```

### Ligações com outros sites

| Serviço | Para quê |
|---|---|
| **GitHub Pages** | hospeda o app (branch `main`) |
| **Firebase Authentication** | login com Google |
| **Firestore** | banco de dados (região São Paulo) |
| **gstatic.com** | carrega o SDK do Firebase 10.12.2 direto no navegador |
| **Google Fonts** | fontes Inter e Playfair Display |
| **wa.me** | botões de WhatsApp (lembrete, parabéns, pedido pronto) |
| **Google Maps** | botão "Ver no mapa" |
| **PWABuilder** | gera o APK para Android (opcional) |

### Modo demonstração

Enquanto o `firebase-config.js` estiver com `COLE_AQUI`, o app abre em **modo demonstração**:
botões "Entrar como cliente" e "Entrar como dono", dados de exemplo (clientes fictícios
"Exemplo", "Teste", "Modelo") guardados só no navegador. Serve para testar e mostrar ao dono
antes de configurar o Firebase. Em **Ajustes → Recomeçar demonstração** tudo volta ao início.

---

## Passo 1 — Colocar no GitHub (quando o Monetra não estiver aberto no GitHub Desktop)

1. Abra o **GitHub Desktop** → menu **File → Add local repository…**
2. Escolha a pasta `BarbeariaRodrigues`. Ele vai avisar que não é um repositório: clique em **create a repository**.
   Nome: `BarbeariaRodrigues`. Clique em **Create repository**.
3. Clique em **Publish repository**. **Desmarque** "Keep this code private" (o GitHub Pages grátis precisa de repositório público) e publique.
4. No site do GitHub, abra o repositório → **Settings → Pages** → Branch **main** e **/ (root)** → **Save**.
5. Em 1–2 minutos o app estará em `https://gustavombarbosadev.github.io/BarbeariaRodrigues/` (em modo demonstração).

> O GitHub Desktop troca de projeto no seletor **Current repository** (canto de cima à esquerda). O Monetra continua lá, separado.

## Passo 2 — Criar o Firebase (grátis, plano Spark)

Use um projeto **novo**, separado do Monetra.

1. **console.firebase.google.com** → **Criar um projeto** → nome `barbearia-rodrigues` → pode desativar o Analytics.
2. **Registrar o app web:** ícone **`</>`** → apelido `barbearia-rodrigues` → **não** marque Hosting → **Registrar app**. Copie os valores do `firebaseConfig`.
3. **Login com Google:** Criação → **Authentication** → Vamos começar → **Google → Ativar** → e-mail de suporte → Salvar.
4. **Domínio autorizado:** Authentication → Configurações → **Domínios autorizados → Adicionar** `gustavombarbosadev.github.io` (já deve estar se você usar o mesmo domínio do Monetra, mas é outro projeto, então adicione).
5. **Banco:** Criação → **Firestore Database** → Criar → local **southamerica-east1 (São Paulo)** → modo **produção**.
6. **Regras:** abra o `firestore.rules`, troque `EMAIL_DO_DONO@gmail.com` pelo **e-mail Google do dono da barbearia**, cole tudo na aba **Regras** do Firestore e clique em **Publicar**.

## Passo 3 — Ligar o app ao Firebase

1. No `firebase-config.js`, troque os valores pelos que você copiou no passo 2.2.
2. Commit e push (no branch `testes` primeiro, se preferir — veja "Versões").
3. O dono entra com a conta Google cadastrada nas regras → **Mais → Ajustes → Carregar dados iniciais**.
   Isso cria os serviços e preços do Booksy, a equipe (Arlley e Miguel), produtos de exemplo e a galeria.
4. Em **Ajustes**, confira endereço, **WhatsApp da barbearia**, horário e regras da agenda.
5. Em **Estoque**, corrija preços, custos e quantidades dos produtos (os que vieram são exemplos) e adicione fotos.
6. Em **Equipe**, coloque a foto de cada barbeiro e, se precisar, o horário de cada um.

## Banco de dados (Firestore)

| Coleção | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `config/loja` | nome, endereço, horário, regras da agenda | todos | dono |
| `config/admins` | e-mails da equipe com acesso ao painel | dono | dono |
| `servicos`, `profissionais`, `galeria`, `avisos` | catálogo | todos | dono |
| `produtos` | nome, preço, foto, se está disponível (Shop) | todos | dono |
| `estoque/{produto}` | quantidade, custo, mínimo | dono | dono |
| `movimentos` | entradas e saídas do estoque | dono | dono |
| `clientes/{uid}` | **nome completo, CPF, nascimento**, celular, e-mail, aceite LGPD | o próprio + dono | o próprio + dono |
| `cpfs/{cpf}` | de quem é cada CPF (garante CPF único) | o próprio + dono | o próprio + dono |
| `fichas/{cliente}` | anotações internas | dono | dono |
| `agendamentos` | serviços, barbeiro, dia, hora, status, total | o próprio + dono | cliente cria/cancela o seu; dono tudo |
| `bloqueios` | blocos de 15 min ocupados (sem dados pessoais) | logados | só cria/apaga |
| `pedidos` | reservas do Shop | o próprio + dono | cliente cria/cancela; dono tudo |
| `avaliacoes/{agendamento}` | nota, comentário, primeiro nome | todos | cliente que foi atendido |
| `notificacoes/{uid}/itens` | mensagens para o cliente | o próprio + dono | dono cria; cliente marca lida |

**Como não marca dois no mesmo horário:** cada 15 min ocupados viram um documento
`bloqueios/<barbeiro>_<data>_<HHMM>`. Reservar grava o agendamento e esses blocos juntos.
As regras só deixam **criar** bloco, nunca sobrescrever, então se outra pessoa pegou o horário
um segundo antes a gravação inteira falha e o app pede outro horário.

**Status do agendamento:** `marcado` (aguardando confirmação) → `confirmado` → `concluido`, ou `cancelado` / `faltou`.
Só `concluido` entra no faturamento dos relatórios.

## Notificações

O que funciona **grátis** (plano Spark):

- **Sininho no app:** confirmação, cancelamento, pedido pronto, avisos, lembrete de hoje/amanhã e aniversário.
- **Notificação no aparelho** (Perfil → Notificações): aparece quando chega algo novo com o app aberto ou em segundo plano.
- **Agenda do celular:** depois de agendar, "Adicionar à agenda do celular" baixa um `.ics` com lembretes **1 dia e 1 hora antes** — funciona mesmo com o app fechado.
- **WhatsApp:** o dono manda lembrete, parabéns e "pedido pronto" com um toque (abre o WhatsApp com a mensagem pronta).

**Para o futuro (push com o app fechado):** precisa de Firebase Cloud Messaging + Cloud Functions,
que exigem o plano **Blaze** (pede cartão, mas tem faixa gratuita). A ideia: uma função que,
quando um agendamento muda de status ou falta 1 hora, envia o push. O `sw.js` já trata o clique na notificação.

## Versões

1. Faça as mudanças no branch **`testes`** e teste.
2. Atualize `VERSAO` em `js/app.js` e `CACHE` em `sw.js` (o mesmo número) e escreva o que mudou no `CHANGELOG.md`.
3. Se criar um campo novo em algum documento, atualize o `firestore.rules` (as listas `hasOnly`) e **publique as regras antes**.
4. Se criar arquivos novos (telas, imagens), acrescente na lista `ARQUIVOS` do `sw.js`.
5. Junte na **main**, faça push e crie a tag (History → botão direito no commit → Create Tag → `v1.1.0` → Push origin).

## Aplicativo Android (APK) — grátis

Igual ao Monetra: **pwabuilder.com** → cole o endereço → **Package for stores → Android**.
Use um *Package ID* próprio, por exemplo `io.github.gustavombarbosadev.barbeariarodrigues`, e **guarde a signing key**.
O `assetlinks.json` vai no mesmo repositório `GustavoMBarbosaDEV.github.io/.well-known/` (é uma lista: acrescente
a entrada do novo app sem apagar a do Monetra).

## Cuidados (LGPD)

- CPF e data de nascimento são dados pessoais: só o cliente e a equipe leem (regras do Firestore).
- Nas listas o CPF aparece mascarado (`***.456.789-**`); completo só na ficha.
- O backup em JSON (Ajustes) tem dados pessoais: guarde em lugar seguro.
- O cliente pode apagar o próprio cadastro pelo app.

## Limitações conhecidas

- O cliente envia o total do agendamento; as regras conferem o formato, não o preço. O valor cobrado é o do balcão.
- Fotos de produtos, equipe e galeria adicionadas pelo app ficam dentro do Firestore (reduzidas para ~600–900 px),
  porque o Firebase Storage exige o plano Blaze em projetos novos.
- A logo veio do Instagram em 150 px. Peça ao dono o arquivo original para os ícones ficarem mais nítidos
  e substitua `img/logo.png`, `img/logo-320.png` e os arquivos de `icons/`.
