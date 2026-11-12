# Barbearia Rodrigues — guia de desenvolvimento

Anotações técnicas de como o app foi montado, como ligar o Firebase, o domínio e o serviço de avisos, e como publicar.
Para a apresentação do app, veja o [README](README.md).

---

## Como o app foi feito

O app usa **HTML, CSS e JavaScript puros**, sem framework. No dia a dia não há build: o que está na pasta é o que o navegador roda.
O build existe só para publicar (escolher os arquivos e minificar). O código é **dividido em módulos**, um arquivo por tela.

```
BarbeariaRodrigues/
├── index.html              → página única: tela de abertura + carrega os scripts (com a política de segurança)
├── firebase-config.js      → chaves públicas do Firebase (vazio = modo demonstração)
├── firestore.rules         → regras de segurança do banco (quem pode ler e gravar o quê)
├── firebase.json           → hospedagem: cabeçalhos de segurança, cache e a pasta publicada (dist/)
├── manifest.webmanifest    → nome, ícones e cores do app instalado
├── sw.js                   → service worker: abre sem internet, aviso de nova versão e notificações
├── css/                    → estilos (tokens, base, layout, componentes, cliente, dono, equipe, fontes…)
├── fonts/, vendor/         → fontes e SDK do Firebase servidos do próprio site (gerados por ferramentas/)
├── img/, icons/            → fotos e ícones
├── js/
│   ├── app.js              → ponto de partida: rotas, topo, abas, aviso de nova versão
│   ├── abertura.js         → tela de abertura e registro do service worker
│   ├── dados.js            → camada de dados: Firebase OU demonstração; descobre se a conta é dono, barbeiro ou cliente
│   ├── estado.js           → dados que várias telas usam (loja, serviços, equipe, produtos…)
│   ├── agenda.js           → horários livres, reservar, cancelar, lista de espera, arquivo de calendário
│   ├── caixa.js            → contas do caixa, comissão, fidelidade e datas dos fechamentos (sem tela nem banco)
│   ├── notificacoes.js     → sininho + notificações do aparelho
│   ├── seed.js, ui.js, util.js
│   ├── cliente/            → telas do cliente
│   └── dono/               → telas da equipe (agenda, caixa, pagamento, clientes, equipe, estoque, pedidos…)
├── avisos-worker/          → serviço que envia lembrete e aviso de vaga com o app fechado (Cloudflare Workers)
├── ferramentas/            → build (dist/), troca de versão, geração de vendor/ e fonts/ (Node, só para publicar)
├── testes/                 → testes das contas e das regras de aviso (node --test)
├── testes-regras/          → testes das regras do Firestore no emulador
└── .github/                → verificações automáticas e publicação
```

### Ligações com outros serviços

| Serviço | Para quê |
|---|---|
| **Firebase Authentication** | login com Google |
| **Firestore** | banco de dados (região São Paulo) |
| **Firebase Hosting** | hospeda o app no domínio próprio, com cabeçalhos de segurança |
| **Firebase Cloud Messaging** | entrega o aviso no celular (grátis) |
| **Cloudflare Workers** | dispara os avisos a cada 5 minutos (plano grátis, sem cartão) |
| **GitHub Actions** | testa a cada envio e publica quando a `main` recebe |
| **wa.me** | botões de WhatsApp (lembrete, vaga, parabéns, pedido pronto) |
| **Google Maps** | botão "Ver no mapa" |

Nada é carregado de outros sites para o app abrir: o SDK do Firebase fica em `vendor/` e as fontes em `fonts/`.
O Firebase fica no plano **Spark (grátis)**. Não se usa Cloud Functions, que exigiria cartão.

### Modo demonstração

Enquanto o `firebase-config.js` estiver com `COLE_AQUI`, o app abre em **modo demonstração**:
botões "Entrar como cliente", "Entrar como dono" e "Entrar como barbeiro", com dados de exemplo guardados só no navegador.
Serve para testar e mostrar ao dono. Em **Ajustes → Recomeçar demonstração** tudo volta ao início.
Com o Firebase configurado esses botões somem sozinhos, e a publicação automática se recusa a subir o app em modo demonstração.

---

## Quem é quem (contas)

| Conta | Como vira | O que pode |
|---|---|---|
| **Dono** | e-mail fixo em `firestore.rules` (dois: o dono da barbearia e quem cuida do app) ou adicionado em Ajustes → Quem acessa o painel | tudo |
| **Barbeiro** | o dono cadastra em **Mais → Equipe** com o e-mail Google dele | vê a agenda do dia, mexe nos próprios horários, e o que o dono marcar |
| **Cliente** | qualquer outra conta Google | só o que é dele |

Permissões que o dono liga ou desliga por barbeiro: mexer na agenda dos colegas, cadastro de clientes, lançar no caixa, ver o caixa da barbearia, estoque, pedidos do shop, relatórios. Serviços, equipe, avisos, galeria e ajustes são sempre só do dono.

O app esconde as telas de quem não pode, mas quem protege de verdade são as regras do banco.

## Passo a passo para colocar no ar (do zero)

Faça na ordem. Cada passo em painel está detalhado, clique por clique, em `SEGURANCA-PAINEIS.md` (arquivo local, fora do repositório).

1. **Conta Google da barbearia** — ela é a dona do Firebase e dos dados dos clientes. Ligue a verificação em duas etapas.
2. **Projeto Firebase** nessa conta (plano Spark): app web, Authentication com Google, Firestore em `southamerica-east1` no modo produção.
3. **`firebase-config.js`** — cole os valores do app web.
4. **`firestore.rules`** — troque os dois e-mails da linha marcada com `>>>` e publique: `firebase deploy --only firestore:rules`.
5. **Domínio** — registre (ex.: Registro.br) e conecte em Hosting → Adicionar domínio personalizado. Acrescente o domínio em Authentication → Domínios autorizados.
6. **Chave de API** — no Google Cloud, restrinja por referenciador HTTP (o domínio e `localhost`).
7. **App Check** — reCAPTCHA Enterprise; cole a chave de site em `APPCHECK_SITE_KEY`. Ligue o *Enforce* só depois de ver nas métricas que o app verdadeiro passa.
8. **Publicação automática** — crie a conta de serviço do Hosting e guarde no secret `FIREBASE_SERVICE_ACCOUNT_BARBEARIA_RODRIGUES` do GitHub. Confira o `projectId` em `.github/workflows/hosting.yml`.
9. **Primeiro acesso do dono** — entre com a conta fixa nas regras → **Mais → Ajustes → Carregar dados iniciais**. Depois confira endereço, WhatsApp, horário, preços (os que vêm são de exemplo), fidelidade, e cadastre a equipe.
10. **Avisos com o app fechado** — siga `avisos-worker/LEIAME.md` e cole a chave em `PUSH_VAPID_KEY`.
11. **GitHub Pages** — quando o domínio estiver no ar, desligue o Pages (Settings → Pages → None): ele publica o repositório inteiro, sem cabeçalhos de segurança.

## Banco de dados (Firestore)

| Coleção | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `config/loja` | nome, endereço, horário, regras da agenda, fidelidade | todos | dono |
| `config/admins` | e-mails com acesso de dono | dono | dono |
| `servicos`, `profissionais`, `galeria`, `avisos`, `produtos` | catálogo | todos | dono (produtos: quem tem "estoque") |
| `equipe/{prof}` | e-mail de acesso e % de comissão | dono + o próprio barbeiro | dono |
| `acessos/{email}` | qual profissional é e o que pode | dono + o próprio barbeiro | dono |
| `estoque`, `movimentos` | quantidade, custo, entradas e saídas | quem tem "estoque" ou "pedidos" | idem |
| `clientes/{uid}` | **nome completo, CPF, nascimento**, celular, e-mail | o próprio + quem tem "clientes" | o próprio; equipe |
| `cpfs/{cpf}` | de quem é cada CPF (garante CPF único) | o próprio + dono | o próprio; equipe |
| `fichas/{cliente}` | anotações internas | quem tem "clientes" | idem |
| `agendamentos` | serviços, barbeiro, dia, hora, status, total, **pagamento** | o próprio + equipe | cliente cria/cancela o seu; barbeiro mexe nos próprios; dono tudo |
| `comissoes/{agendamento}` | % e valor da comissão daquele atendimento | dono + o próprio barbeiro | o próprio barbeiro (na % definida pelo dono); dono |
| `bloqueios` | blocos de 15 min ocupados (sem dados pessoais) | logados | só cria/apaga |
| `espera/{uid_data_hora}` | interesse num horário ocupado | o próprio + equipe | o próprio; equipe marca "avisado" |
| `caixa` | entradas e saídas lançadas à mão | quem lançou + quem tem "caixa da barbearia" | quem tem "caixa" (não edita: apaga e lança de novo) |
| `pedidos` | reservas do Shop, com pagamento | o próprio + quem tem "pedidos" | cliente cria/cancela; equipe autorizada |
| `avaliacoes/{agendamento}` | nota, comentário, primeiro nome | todos | cliente que foi atendido |
| `notificacoes/{uid}/itens` | mensagens para o cliente | o próprio + dono | equipe cria; cliente marca lida |
| `push/{uid}` | endereço do aparelho para aviso com o app fechado | o próprio | o próprio |

**Como não marca dois no mesmo horário:** cada 15 min ocupados viram um documento `bloqueios/<barbeiro>_<data>_<HHMM>`.
Reservar grava o agendamento e esses blocos juntos. As regras só deixam **criar** bloco, nunca sobrescrever, então se outra pessoa
pegou o horário um segundo antes a gravação inteira falha e o app pede outro horário.

**Status do agendamento:** `marcado` (aguardando confirmação) → `confirmado` → `concluido`, ou `cancelado` / `faltou`.
Só `concluido` entra no caixa. Concluir grava `pagamento = { forma, valor, recebido, troco, gorjeta }`.

**Por que a comissão fica fora do agendamento:** o cliente lê o próprio agendamento; se a comissão estivesse lá, ele veria quanto o barbeiro ganha.

## Regras de negócio

- **Lembrete:** 2 h antes (`lembreteMin`). **Cancelamento pelo cliente:** até 1h30 antes (`cancelarAteMin`). Os dois se ajustam em Ajustes.
- **Lista de espera:** só quem marcou interesse naquele horário é avisado. Com o app aberto o aviso é do próprio app; com o app fechado, do serviço de avisos; quem não ativou notificação aparece para o barbeiro com botão de WhatsApp.
- **Dinheiro:** `recebido − valor` é o troco. Se o barbeiro marca "não teve troco", a diferença vira gorjeta de quem atendeu e **não** entra no faturamento.
- **Comissão:** % do barbeiro sobre o valor recebido, guardada no momento de concluir (mudar a % depois não mexe no passado).
- **Fidelidade:** cada atendimento concluído vale um selo; ao completar, o barbeiro dá baixa no prêmio na hora de receber.
- **Fechamentos:** do dia, quando o último horário marcado é finalizado; semanal, domingo ao meio-dia (segunda a domingo); mensal, no último dia do mês depois do último atendimento, ou no domingo ao meio-dia se o mês acaba no fim de semana.

## Versões

1. Faça as mudanças no branch **`testes`** e teste (`node --test "testes/*.test.mjs"` e no navegador, em modo demonstração).
2. `cd ferramentas && node bump.mjs X.Y.Z` (troca `VERSAO` em `js/app.js` e `V` em `sw.js`) e escreva o que mudou no `CHANGELOG.md`.
3. Campo novo em algum documento? Atualize o `firestore.rules` (as listas `hasOnly`) e os testes em `testes-regras/`, e **publique as regras antes** do app.
4. Arquivo novo de tela ou estilo? Acrescente em `ARQUIVOS` do `sw.js` (o build avisa se esquecer).
5. Envie o `testes`, espere as verificações ficarem verdes, depois `git push origin testes:main` e a tag.

Quem já está com o app aberto vê o cartão **"Nova versão pronta · Atualizar"**; o app não troca de versão sozinho no meio do uso.

## Bibliotecas dentro do app (vendor/)

- **Firebase:** `cd ferramentas && npm ci && node vendor-firebase.mjs` gera `vendor/firebase-<versão>/` só com as funções usadas.
  Para trocar de versão: mude `firebase` no `ferramentas/package.json`, `FB_V` em `js/dados.js` e `FB` em `sw.js`, gere de novo, apague a pasta antiga e suba a versão do app.
- **Fontes:** `node fontes.mjs` copia Inter e Playfair Display para `fonts/` e gera `css/fontes.css`.

## Publicar à mão (sem o GitHub)

```
cd ferramentas && npm ci && node build.mjs && cd ..
firebase deploy --only hosting
```

Só a pasta `dist/` vai para o ar. Ela é montada por lista fixa, então nenhum `.md`, regra, teste ou ferramenta é publicado.

## Aplicativo Android (APK) — grátis

**pwabuilder.com** → cole o endereço do domínio → **Package for stores → Android**. Guarde a *signing key* em dois lugares fora do computador
e use sempre a mesma. O `assetlinks.json` gerado vai em `.well-known/` na raiz do projeto.

## Cuidados (LGPD)

- CPF e data de nascimento são dados pessoais: só o cliente e a equipe autorizada leem (regras do Firestore).
- Nas listas o CPF aparece mascarado (`***.456.789-**`); completo só na ficha.
- O backup em JSON (Ajustes) tem dados pessoais: guarde em lugar seguro.
- O cliente apaga o cadastro e a conta pelo app. Ao sair, nada dele fica guardado no aparelho.

## Limitações conhecidas

- O prazo de cancelamento (1h30) é conferido pelo app, não pelas regras do banco.
- O cliente envia o total do agendamento; as regras conferem o formato, não o preço. Vale o valor lançado ao concluir.
- O aviso com o app fechado vai para clientes. A equipe é avisada de cancelamento pelo sininho, com o app aberto ou em segundo plano.
- No iPhone, as notificações só chegam se o app foi adicionado à Tela de Início.
- Fotos adicionadas pelo app ficam dentro do Firestore (reduzidas), porque o Firebase Storage exige plano pago em projetos novos.
- Preços dos serviços e produtos são de exemplo. Endereço e WhatsApp ficam em branco até o dono preencher em Ajustes.

## De onde vieram as fotos

Todas as imagens de `img/` foram tiradas do Instagram [@rodriguesbarbearia__](https://instagram.com/rodriguesbarbearia__); confirme a autorização do dono antes de publicar:
`img/logo*.png` e `icons/` (foto de perfil, em baixa resolução: peça o arquivo original da logo), `img/cortes/` (10 cortes) e `img/casa/` (equipe, atendimento, corte infantil, combo e produtos). Os produtos do Shop ainda não têm foto: o dono adiciona em Estoque.
