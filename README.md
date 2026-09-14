## ServeBox

Base inicial em Next.js 16 para vender tubos de tenis para condominios.
O projeto usa TypeORM no servidor com banco SQLite local para desenvolvimento.

## Stack

- Next.js 16 com App Router
- React 19
- TypeORM
- better-sqlite3

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Suba o projeto:

```bash
npm run dev
```

3. Abra `http://localhost:3000`.

Na primeira execucao, o banco e criado automaticamente em `data/servebox.sqlite` e recebe seed com:

- 1 administrador inicial

Se quiser trocar o nome do arquivo local, use `DB_FILENAME` no `.env.local`.

## Estrutura inicial do dominio

- `Administrator`: administrador que cria planos e gerencia condominios
- `Plan`: plano comercial pertencente a um condominio
- `Condominium`: dados do condominio cliente
- `CondominiumPayment`: pagamento de um plano para um condominio
- `BallInventoryMovement`: livro-caixa de credito e consumo de tubos

## Endpoints iniciais

- `GET /api/administradores`
- `POST /api/administradores`
- `GET /api/plans`
- `POST /api/plans`
- `GET /api/condominios`
- `POST /api/condominios`
- `GET /api/pagamentos`
- `POST /api/pagamentos`
- `GET /api/pagamentos/:paymentId`
- `POST /api/pagamentos/:paymentId`

## Dashboard

- `GET /dashboard`: tela administrativa com saldo de tubos e cobrancas em aberto

## Checkout

- `GET /pagamentos/:paymentId`: tela da cobranca com QR Code/link de checkout e atualizacao automatica de status

Fluxo atual:

1. Cria um pagamento pendente para um plano de um condominio
2. Abre a cobranca pelo gateway ativo
3. O backend so libera o credito quando o gateway confirma o pagamento
4. O sistema gera um credito em `BallInventoryMovement`
5. O saldo de tubos fica visivel na dashboard

## Sessao administrativa

Se o site em producao usar mais de um host, como `www.seudominio.com` e `seudominio.com`,
configure a mesma base de dominio para o cookie da sessao:

```bash
SESSION_COOKIE_DOMAIN=seudominio.com
```

Se precisar forcar ou desativar `secure` em ambientes especificos, use:

```bash
SESSION_COOKIE_SECURE=true
```

Por padrao, o cookie continua `httpOnly`, com `sameSite=lax` e validade de 7 dias.

Exemplo de criacao de condominio:

```bash
curl -X POST http://localhost:3000/api/condominios \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Condominio Parque Central\",\"city\":\"Sao Paulo\",\"state\":\"SP\",\"courts\":2,\"activeResidents\":180,\"adminEmail\":\"admin@servebox.local\"}"
```

Exemplo de criacao de plano dentro de um condominio:

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d "{\"condominiumId\":\"SEU_CONDOMINIUM_ID\",\"name\":\"Plano Quadra 1\",\"description\":\"Plano mensal da quadra principal\",\"monthlyBallAllowance\":48,\"monthlyPriceInCents\":14900,\"overagePriceInCents\":1390}"
```

Exemplo de criacao de pagamento:

```bash
curl -X POST http://localhost:3000/api/pagamentos \
  -H "Content-Type: application/json" \
  -d "{\"planId\":\"SEU_PLAN_ID\",\"method\":\"pix\"}"
```

## Configuracao do gateway de pagamento

Novas cobrancas sao criadas pelo provider definido em `PAYMENT_PROVIDER`.
Use `infinitepay` para a integracao principal. `santander` e `abacatepay`
continuam disponiveis para pagamentos pendentes antigos ou rollback.

### InfinitePay

A integracao usa o Checkout integrado da InfinitePay, criando um link em
`https://api.checkout.infinitepay.io/links` com `order_nsu` igual a referencia
local do pagamento. A confirmacao automatica chega no webhook:

```text
https://seu-dominio.com/api/webhooks/infinitepay
```

Variaveis principais:

```bash
PAYMENT_PROVIDER=infinitepay
PAYMENT_APP_BASE_URL=https://seu-dominio.com
INFINITEPAY_TAG=sua_infinite_tag_sem_cifrao
INFINITEPAY_WEBHOOK_SECRET=um_segredo_opcional
```

`PAYMENT_APP_BASE_URL` e usado para montar `webhook_url` e `redirect_url`.
Se `INFINITEPAY_WEBHOOK_SECRET` for configurado, o projeto envia esse segredo
na URL do webhook e exige o mesmo valor para aceitar a notificacao.

### Notificacoes de sugestoes por e-mail

As sugestoes sao enviadas para `serveboxsuporte@gmail.com` usando a API do
Resend. Configure as variaveis no ambiente da aplicacao:

```bash
RESEND_API_KEY=re_sua_chave
RESEND_FROM_EMAIL=onboarding@resend.dev
SUGGESTIONS_NOTIFICATION_EMAIL=serveboxsuporte@gmail.com
```

Em producao, prefira um remetente de um dominio verificado no Resend no lugar
de `onboarding@resend.dev`. O e-mail informado pela pessoa fica configurado
como `Reply-To` para facilitar o retorno.

### Santander

No Portal do Desenvolvedor Santander:

1. Crie uma aplicacao para o ServeBox.
2. Habilite a API `Pix - QRCode Generation`.
3. Cadastre a chave Pix recebedora.
4. Configure o certificado A1 em PEM para mTLS.
5. Copie `client_id` e `client_secret`.
6. Configure o webhook com base `https://seu-dominio.com/api/webhooks/santander`.
   O callback esperado pelo projeto fica em `/api/webhooks/santander/pix`.

Variaveis principais:

```bash
PAYMENT_PROVIDER=santander
PAYMENT_DEFAULT_CUSTOMER_TAX_ID=12345678909

SANTANDER_ENV=sandbox
SANTANDER_CLIENT_ID=seu_client_id
SANTANDER_CLIENT_SECRET=seu_client_secret
SANTANDER_PIX_KEY=sua_chave_pix
SANTANDER_CERT_PATH=./certs/santander-cert.pem
SANTANDER_KEY_PATH=./certs/santander-key.pem
SANTANDER_PIX_EXPIRATION_SECONDS=3600
SANTANDER_API_BASE_URL=https://pix.santander.com.br/api/v1/sandbox
SANTANDER_AUTH_URL=https://pix.santander.com.br/auth/oauth/v2/token
```

Em deploy, prefira `SANTANDER_CERT_PEM_BASE64` e
`SANTANDER_KEY_PEM_BASE64` para nao depender de arquivos locais. Nunca versione
certificado, chave privada ou `.env.local`.

Se o ambiente Santander usar hosts diferentes dos defaults, ajuste:

```bash
SANTANDER_API_BASE_URL=https://trust-pix.santander.com.br/api/v1
SANTANDER_AUTH_URL=https://trust-pix.santander.com.br/oauth/token?grant_type=client_credentials
```

### AbacatePay legado

O provider antigo continua disponivel para pagamentos pendentes antigos ou
rollback:

```bash
PAYMENT_PROVIDER=abacatepay
ABACATEPAY_API_KEY=sua_chave
ABACATEPAY_WEBHOOK_SECRET=seu_segredo
ABACATEPAY_PUBLIC_WEBHOOK_KEY=sua_chave_publica_do_webhook
ABACATEPAY_DEFAULT_CUSTOMER_CELLPHONE=5511999999999
ABACATEPAY_DEFAULT_CUSTOMER_TAX_ID=12345678909
```

