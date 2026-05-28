# Arquitetura MVP — Plataforma de Conciliação Bancária
> Um desenvolvedor · 7 dias · Pronto para vender

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                  CLIENTE (Browser)                   │
│              Next.js App Router (SSR)                │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────┐
│            MONOLITO NEXT.JS (Vercel)                 │
│                                                      │
│  /app         → páginas React                        │
│  /app/api     → Route Handlers (backend)             │
│  /lib         → lógica de negócio                    │
│  /lib/cumbuca → integração Open Finance              │
│  /lib/parser  → leitura CSV/XLSX                     │
│  /lib/matcher → motor de conciliação                 │
└───────────────────────┬─────────────────────────────┘
                        │ Prisma ORM
┌───────────────────────▼─────────────────────────────┐
│           PostgreSQL (Supabase ou Railway)            │
└─────────────────────────────────────────────────────┘

         ↕ HTTPS (lib/cumbuca/client.ts)

┌─────────────────────────────────────────────────────┐
│           CUMBUCA — Proxy Regulatório                 │
│      Proxy Layer 7 · mTLS · JWS/PS256                │
│   (sua aplicação aponta aqui em vez do banco)        │
└───────────────────────┬─────────────────────────────┘
                        │ mTLS + JWS · BACEN dispatch
┌───────────────────────▼─────────────────────────────┐
│        Open Finance Brasil (Banco Central)           │
│   /accounts · /transactions · /consents · /balances  │
└─────────────────────────────────────────────────────┘
```

**Por que monolito Next.js?**
- Um único repositório, um único deploy
- Route Handlers substituem um backend separado (Express/Fastify)
- Vercel cuida de SSL, CDN, scaling básico e preview deploys
- Zero config de infraestrutura
- Se no futuro precisar separar, os `lib/` já são módulos isolados — basta mover

---

## 2. Estrutura de Pastas

```
conciliacao-mvp/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               ← navbar + proteção de rota
│   │   ├── page.tsx                 ← dashboard principal
│   │   ├── conciliacoes/
│   │   │   ├── page.tsx             ← lista de conciliações
│   │   │   └── [id]/page.tsx        ← detalhe de uma conciliação
│   │   ├── contas/page.tsx          ← gerenciar contas bancárias
│   │   └── upload/page.tsx          ← upload ERP
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── contas/
│       │   ├── route.ts             ← GET /api/contas, POST /api/contas
│       │   └── [id]/sincronizar/route.ts
│       ├── conciliacoes/
│       │   ├── route.ts             ← GET, POST
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── manual/route.ts  ← conciliação manual
│       └── upload/route.ts          ← POST upload CSV/XLSX
├── lib/
│   ├── cumbuca/
│   │   ├── client.ts                ← wrapper da API Cumbuca
│   │   └── types.ts
│   ├── parser/
│   │   ├── csv.ts                   ← papaparse
│   │   └── xlsx.ts                  ← xlsx (SheetJS)
│   ├── matcher/
│   │   ├── engine.ts                ← motor de matching
│   │   └── rules.ts                 ← regras de conciliação
│   ├── db.ts                        ← instância Prisma singleton
│   └── auth.ts                      ← config NextAuth
├── prisma/
│   └── schema.prisma
├── components/
│   ├── ui/                          ← shadcn/ui components
│   ├── ConciliacaoTable.tsx
│   ├── UploadZone.tsx
│   └── StatusBadge.tsx
├── .env.local
└── package.json
```

**Decisão:** Não há pasta `server/` ou `backend/` separada. Tudo dentro do Next.js. Isso elimina configuração de CORS, dois processos rodando, dois deploys. Perda zero para MVP.

---

## 3. Banco de Dados (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Autenticação ────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // bcrypt hash
  createdAt DateTime @default(now())

  empresas         Empresa[]
  conciliacoes     Conciliacao[]
}

// ─── Multi-tenant simples ────────────────────────────

model Empresa {
  id        String   @id @default(cuid())
  nome      String
  cnpj      String?
  createdAt DateTime @default(now())

  userId    String
  user      User     @relation(fields: [userId], references: [id])

  contas           ContaBancaria[]
  uploadErps       UploadErp[]
  conciliacoes     Conciliacao[]
}

// ─── Contas bancárias (Open Finance) ─────────────────

model ContaBancaria {
  id              String   @id @default(cuid())
  empresaId       String
  empresa         Empresa  @relation(fields: [empresaId], references: [id])

  banco           String
  agencia         String?
  conta           String

  // Tokens Cumbuca
  consentimentoId String?
  accessToken     String?
  refreshToken    String?
  tokenExpiraEm   DateTime?

  ultimaSincAt    DateTime?
  ativa           Boolean  @default(true)
  createdAt       DateTime @default(now())

  extratos         ExtratoLancamento[]
}

// ─── Lançamentos do extrato bancário ─────────────────

model ExtratoLancamento {
  id              String   @id @default(cuid())
  contaId         String
  conta           ContaBancaria @relation(fields: [contaId], references: [id])

  data            DateTime
  descricao       String
  valor           Decimal  @db.Decimal(15, 2)
  tipo            String   // CREDITO | DEBITO
  identificador   String?  // ID externo do banco
  saldoApos       Decimal? @db.Decimal(15, 2)

  createdAt       DateTime @default(now())

  itens           ConciliacaoItem[]

  @@index([contaId, data])
}

// ─── Upload do ERP ───────────────────────────────────

model UploadErp {
  id          String   @id @default(cuid())
  empresaId   String
  empresa     Empresa  @relation(fields: [empresaId], references: [id])

  nomeArquivo String
  periodo     String   // ex: "2024-01"
  totalLinhas Int
  createdAt   DateTime @default(now())

  lancamentos  ErpLancamento[]
  conciliacoes Conciliacao[]
}

// ─── Lançamentos do ERP ───────────────────────────────

model ErpLancamento {
  id          String    @id @default(cuid())
  uploadId    String
  upload      UploadErp @relation(fields: [uploadId], references: [id])

  data        DateTime
  descricao   String
  valor       Decimal   @db.Decimal(15, 2)
  tipo        String    // CREDITO | DEBITO
  documento   String?   // NF, boleto, etc
  centroCusto String?
  rawData     Json?     // linha original do CSV para debug

  createdAt   DateTime  @default(now())

  itens       ConciliacaoItem[]

  @@index([uploadId, data])
}

// ─── Conciliação ─────────────────────────────────────

model Conciliacao {
  id          String    @id @default(cuid())
  empresaId   String
  empresa     Empresa   @relation(fields: [empresaId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  uploadId    String
  upload      UploadErp @relation(fields: [uploadId], references: [id])

  periodo     String
  status      String    @default("PROCESSANDO") // PROCESSANDO | CONCLUIDA | ERRO

  // Resumo (denormalizado para dashboard rápido)
  totalExtrato    Decimal @db.Decimal(15, 2) @default(0)
  totalErp        Decimal @db.Decimal(15, 2) @default(0)
  qtdConciliados  Int @default(0)
  qtdDivergentes  Int @default(0)
  qtdFaltandoErp  Int @default(0)
  qtdFaltandoBanco Int @default(0)

  criadoEm    DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  itens       ConciliacaoItem[]
}

// ─── Itens da conciliação (resultado do matching) ─────

model ConciliacaoItem {
  id              String      @id @default(cuid())
  conciliacaoId   String
  conciliacao     Conciliacao @relation(fields: [conciliacaoId], references: [id])

  status          String
  // CONCILIADO        → par exato encontrado
  // DIVERGENTE        → encontrado mas valor diferente
  // FALTANDO_BANCO    → está no ERP, não no extrato
  // FALTANDO_ERP      → está no extrato, não no ERP

  extratoId       String?
  extrato         ExtratoLancamento? @relation(fields: [extratoId], references: [id])
  erpId           String?
  erp             ErpLancamento?     @relation(fields: [erpId], references: [id])

  diferencaValor  Decimal?    @db.Decimal(15, 2)
  scoreMatch      Float?      // 0-1, confiança do matching automático
  observacao      String?     // nota manual do operador

  resolvidoManualmente Boolean @default(false)
  resolvidoPor    String?     // userId
  resolvidoEm    DateTime?

  createdAt       DateTime @default(now())

  @@index([conciliacaoId, status])
}
```

**Por que esse schema?**
- `ConciliacaoItem` é o coração — guarda o resultado do matching com referências para ambos os lados
- Campos de resumo denormalizados na `Conciliacao` = dashboard sem query pesada
- `rawData Json` no ErpLancamento = preserva linha original para debugging sem schema rígido
- Sem soft-delete no MVP — adiciona depois se precisar

---

## 4. Fluxo Completo da Conciliação

```
USUÁRIO
  │
  ├─ 1. CONECTAR CONTA ──────────────────────────────────────
  │       ↓
  │   POST /api/contas (cria ContaBancaria)
  │       ↓
  │   Redirect → Cumbuca OAuth (consentimento Open Finance)
  │       ↓
  │   Callback → salva accessToken + consentimentoId
  │
  ├─ 2. SINCRONIZAR EXTRATO ─────────────────────────────────
  │       ↓
  │   POST /api/contas/:id/sincronizar
  │       ↓
  │   lib/cumbuca/client.ts → GET /accounts/:id/transactions
  │       ↓
  │   Upsert ExtratoLancamento (por identificador externo)
  │
  ├─ 3. UPLOAD ERP ──────────────────────────────────────────
  │       ↓
  │   POST /api/upload (multipart/form-data)
  │       ↓
  │   lib/parser/csv.ts ou xlsx.ts → normaliza colunas
  │       ↓
  │   Cria UploadErp + N registros ErpLancamento
  │
  └─ 4. PROCESSAR CONCILIAÇÃO ───────────────────────────────
          ↓
      POST /api/conciliacoes { uploadId, contaId, periodoInicio, periodoFim }
          ↓
      Cria Conciliacao com status=PROCESSANDO
          ↓
      lib/matcher/engine.ts (ver seção 5)
          ↓
      Cria ConciliacaoItem para cada par/solitário
          ↓
      Atualiza contadores de resumo na Conciliacao
          ↓
      status=CONCLUIDA → notifica frontend (polling simples)
```

---

## 5. Estratégia de Matching

```typescript
// lib/matcher/engine.ts

export async function processar(conciliacaoId: string) {
  const conciliacao = await prisma.conciliacao.findUnique(...)
  
  const extrato = await prisma.extratoLancamento.findMany({
    where: { contaId, data: { gte: inicio, lte: fim } }
  })
  
  const erp = await prisma.erpLancamento.findMany({
    where: { uploadId: conciliacao.uploadId }
  })

  const usadosExtrato = new Set<string>()
  const usadosErp     = new Set<string>()
  const itens: ConciliacaoItem[] = []

  // ── PASSO 1: Match exato (data + valor + tipo) ──────────
  for (const e of erp) {
    const match = extrato.find(b =>
      !usadosExtrato.has(b.id) &&
      isSameDay(b.data, e.data) &&
      b.valor.equals(e.valor) &&
      b.tipo === e.tipo
    )
    if (match) {
      itens.push({ status: 'CONCILIADO', extratoId: match.id, erpId: e.id, score: 1.0 })
      usadosExtrato.add(match.id)
      usadosErp.add(e.id)
    }
  }

  // ── PASSO 2: Match fuzzy (mesma data, valor ± tolerância) ─
  const TOLERANCIA = 0.01 // R$ 0,01 de diferença (centavo)
  for (const e of erp) {
    if (usadosErp.has(e.id)) continue
    const match = extrato.find(b =>
      !usadosExtrato.has(b.id) &&
      isSameDay(b.data, e.data) &&
      Math.abs(b.valor.toNumber() - e.valor.toNumber()) <= TOLERANCIA &&
      b.tipo === e.tipo
    )
    if (match) {
      const diff = match.valor.toNumber() - e.valor.toNumber()
      itens.push({ status: 'DIVERGENTE', extratoId: match.id, erpId: e.id,
                   diferencaValor: diff, score: 0.9 })
      usadosExtrato.add(match.id)
      usadosErp.add(e.id)
    }
  }

  // ── PASSO 3: Match por valor (janela ±3 dias) ─────────────
  for (const e of erp) {
    if (usadosErp.has(e.id)) continue
    const match = extrato.find(b =>
      !usadosExtrato.has(b.id) &&
      Math.abs(daysDiff(b.data, e.data)) <= 3 &&
      b.valor.equals(e.valor) &&
      b.tipo === e.tipo
    )
    if (match) {
      itens.push({ status: 'DIVERGENTE', extratoId: match.id, erpId: e.id, score: 0.7 })
      usadosExtrato.add(match.id)
      usadosErp.add(e.id)
    }
  }

  // ── PASSO 4: Sobras ───────────────────────────────────────
  for (const e of erp.filter(x => !usadosErp.has(x.id))) {
    itens.push({ status: 'FALTANDO_BANCO', erpId: e.id })
  }
  for (const b of extrato.filter(x => !usadosExtrato.has(x.id))) {
    itens.push({ status: 'FALTANDO_ERP', extratoId: b.id })
  }

  // ── Persiste tudo em uma transaction ─────────────────────
  await prisma.$transaction([
    prisma.conciliacaoItem.createMany({ data: itens.map(i => ({...i, conciliacaoId})) }),
    prisma.conciliacao.update({
      where: { id: conciliacaoId },
      data: {
        status: 'CONCLUIDA',
        qtdConciliados:   itens.filter(i => i.status === 'CONCILIADO').length,
        qtdDivergentes:   itens.filter(i => i.status === 'DIVERGENTE').length,
        qtdFaltandoBanco: itens.filter(i => i.status === 'FALTANDO_BANCO').length,
        qtdFaltandoErp:   itens.filter(i => i.status === 'FALTANDO_ERP').length,
      }
    })
  ])
}
```

**Tolerâncias configuráveis** (coloca em `rules.ts` para ajustar por cliente depois):
- Janela de datas: ±3 dias
- Tolerância de valor: R$ 0,01
- Score mínimo para auto-conciliar: 0.7

---

## 6. Endpoints Necessários

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login (NextAuth credentials) |
| GET | `/api/empresas` | Listar empresas do user |
| POST | `/api/empresas` | Criar empresa |
| GET | `/api/contas` | Listar contas bancárias |
| POST | `/api/contas` | Adicionar conta |
| POST | `/api/contas/:id/sincronizar` | Sincronizar extrato Cumbuca |
| GET | `/api/contas/:id/extrato` | Ver lançamentos da conta |
| POST | `/api/upload` | Upload CSV/XLSX do ERP |
| GET | `/api/uploads` | Listar uploads |
| GET | `/api/conciliacoes` | Listar conciliações |
| POST | `/api/conciliacoes` | Iniciar nova conciliação |
| GET | `/api/conciliacoes/:id` | Detalhes + itens paginados |
| PATCH | `/api/conciliacoes/:id/manual` | Conciliação manual de um item |
| GET | `/api/conciliacoes/:id/export` | Exportar resultado CSV |
| GET | `/api/dashboard` | Resumo para o dashboard |

**Total: 16 endpoints.** Menos de 2 por dia — completamente viável.

---

## 7. Serviços Principais

### O que é o Proxy da Cumbuca

A Cumbuca **não é uma API proprietária** — ela é um proxy regulatório camada 7 que fica entre sua aplicação e as APIs oficiais do Open Finance Brasil (Banco Central). Você chama os **mesmos endpoints oficiais** do Open Finance, mas apontando para o host da Cumbuca. Eles re-assinam as requisições com seus certificados regulatórios (mTLS + JWS/PS256) e despacham para o BACEN.

```
Sua app → HTTPS → api.cumbuca.com → mTLS/JWS → banco.openfinance.com.br
                       ↑
              Apenas o host muda.
           Payload, headers e semântica
           são idênticos à spec oficial.
```

**Por que isso importa para o MVP:**
- Sem Cumbuca, você precisaria de licença ITP própria do BACEN (processo de 6–18 meses)
- Com Cumbuca, você está em produção em dias
- Se no futuro quiser sua própria licença, **muda só o certificado** — zero reescrita de código

---

### Fluxo de Consentimento Open Finance (via Cumbuca)

O Open Finance Brasil usa **OAuth2 Authorization Code Flow + FAPI** (Financial-grade API). O fluxo tem 3 etapas obrigatórias:

```
ETAPA 1 — Criar Intenção de Consentimento
──────────────────────────────────────────
POST https://proxy.cumbuca.com/{bank-id}/open-banking/consents/v3/consents
Authorization: Bearer <client_credentials_token>
Content-Type: application/jwt  ← corpo assinado em JWS

Body:
{
  "data": {
    "loggedUser": { "document": { "identification": "CPF_DO_USUARIO", "rel": "CPF" } },
    "permissions": ["ACCOUNTS_READ", "ACCOUNTS_TRANSACTIONS_READ", "ACCOUNTS_BALANCES_READ"],
    "expirationDateTime": "2026-12-31T23:59:59Z"
  }
}

Resposta: { "data": { "consentId": "urn:bancoabc:consent:abc123", "status": "AWAITING_AUTHORISATION" } }

ETAPA 2 — Redirecionar usuário para o banco autorizar
──────────────────────────────────────────────────────
GET https://{bank-authorization-server}/auth?
    response_type=code
    &client_id={seu_client_id_cumbuca}
    &scope=openid accounts consent:{consentId}
    &redirect_uri=https://seusite.com/api/auth/callback/openfinance
    &state={state_aleatorio}
    &code_challenge={pkce_challenge}
    &code_challenge_method=S256

→ Usuário faz login no app do banco e aprova o consentimento
→ Banco redireciona para seu redirect_uri com ?code=AUTH_CODE

ETAPA 3 — Trocar código por access token
──────────────────────────────────────────
POST https://{bank-token-endpoint}
Content-Type: application/x-www-form-urlencoded
(mTLS mutual auth via certificado da Cumbuca)

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://seusite.com/api/auth/callback/openfinance
&code_verifier={pkce_verifier}

Resposta: { "access_token": "...", "refresh_token": "...", "expires_in": 900 }
```

---

### Chamadas de Dados (após consentimento aprovado)

Integração Cumbuca removida do projeto.

---

// lib/parser/csv.ts
import Papa from 'papaparse'

export function parseCSV(buffer: Buffer, mapeamento: ColMap): ErpRow[] {
  const { data } = Papa.parse(buffer.toString(), { header: true, skipEmptyLines: true })
  return data.map(row => normalizar(row, mapeamento))
}

// lib/parser/xlsx.ts
import * as XLSX from 'xlsx'

export function parseXLSX(buffer: Buffer, mapeamento: ColMap): ErpRow[] {
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(ws)
  return data.map(row => normalizar(row as Record<string, unknown>, mapeamento))
}

// Mapeamento de colunas — configurável por cliente
type ColMap = {
  data: string        // ex: "Data Pgto" ou "date"
  descricao: string
  valor: string
  tipo: string | 'inferir'  // se 'inferir', usa sinal do valor
  documento?: string
}
```

**Por que `ColMap` configurável?** Cada ERP exporta CSV diferente. Guardar o mapeamento por empresa = zero retrabalho na segunda conciliação.

---

## 8. Fluxo de Autenticação

```
OPÇÃO ESCOLHIDA: NextAuth.js com Credentials Provider + JWT

Por quê não OAuth (Google/GitHub)?
→ Clientes B2B querem login com e-mail corporativo próprio
→ Menos dependências externas no MVP

Por quê não sessão no banco?
→ JWT em cookie httpOnly é mais simples, zero tabela extra

Fluxo:
1. POST /api/auth/register
   → bcrypt.hash(password, 12)
   → cria User no banco

2. POST /api/auth/login (NextAuth credentials)
   → bcrypt.compare()
   → NextAuth gera JWT + seta cookie

3. Middleware Next.js (middleware.ts)
   → lê JWT do cookie
   → redireciona /login se não autenticado
   → protege todas as rotas /app/(dashboard)/*

4. Em Route Handlers:
   const session = await getServerSession(authOptions)
   if (!session) return NextResponse.json({error:'Unauthorized'}, {status:401})
```

```typescript
// middleware.ts (proteção de rotas em 10 linhas)
import { withAuth } from 'next-auth/middleware'

export default withAuth({ pages: { signIn: '/login' } })

export const config = {
  matcher: ['/dashboard/:path*', '/conciliacoes/:path*', '/api/contas/:path*', ...]
}
```

**Adicionado depois:** convite de usuário, roles (admin/viewer), SSO SAML para enterprise.

---

## 9. Estratégia de Deploy

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│   GitHub    │───▶│   Vercel    │    │    Supabase      │
│   (repo)    │    │ (frontend + │    │  (PostgreSQL)    │
│             │    │   API)      │◀──▶│  + Storage       │
└─────────────┘    └─────────────┘    └─────────────────┘
                         │
                   ┌─────▼─────┐
                   │   Upstash  │
                   │  (Redis,   │
                   │  opcional) │
                   └───────────┘
```

### Custo estimado MVP

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby/Pro | R$ 0–130/mês |
| Supabase | Free tier | R$ 0 (500MB) |
| Domínio | Namecheap | ~R$ 50/ano |
| **Total MVP** | | **~R$ 0–130/mês** |

### Variáveis de ambiente necessárias

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://seudominio.com"

# Cumbuca — fornecidas no onboarding
CUMBUCA_PROXY_BASE_URL="https://proxy.cumbuca.com/{bank-id}/open-banking"
CUMBUCA_CLIENT_ID="..."
CUMBUCA_CLIENT_SECRET="..."
CUMBUCA_REDIRECT_URI="https://seudominio.com/api/auth/callback/openfinance"

# Por banco participante (Cumbuca fornece diretório completo)
BANK_AUTH_URL="https://auth.banco.com.br/as/authorization.oauth2"
BANK_TOKEN_URL="https://auth.banco.com.br/as/token.oauth2"
```

### Comandos de deploy

```bash
# Banco
npx prisma migrate deploy

# App (automático via GitHub → Vercel)
git push origin main  # ← já faz deploy
```

---

## 10. Roadmap de Implementação — 7 Dias

### Dia 1 — Fundação (8h)
- [ ] `npx create-next-app@latest` com TypeScript + Tailwind + App Router
- [ ] Instalar: `prisma`, `@prisma/client`, `next-auth`, `bcryptjs`, `papaparse`, `xlsx`
- [ ] Configurar Prisma + Supabase (DATABASE_URL)
- [ ] Rodar `prisma migrate dev` com schema completo
- [ ] Layout base: sidebar + header com shadcn/ui
- [ ] Páginas de login e registro funcionando (NextAuth)

**Entrega do dia:** App rodando localmente, banco criado, login funcionando.

---

### Dia 2 — Integração Cumbuca + Open Finance (6h)
- [ ] Configurar credenciais Cumbuca (onboarding com a equipe deles)
- [ ] `lib/cumbuca/client.ts` — wrapper completo (consentimento, auth, accounts, transactions)
- [ ] `lib/cumbuca/normalizer.ts` — mapear OFTransaction → ExtratoLancamento
- [ ] Fluxo OAuth2+PKCE: POST consentimento → redirect banco → callback → salvar token
- [ ] `app/api/auth/callback/openfinance/route.ts` — handler do callback
- [ ] `POST /api/contas` e `GET /api/contas`
- [ ] `POST /api/contas/:id/sincronizar` → chama getTransactions, upsert por `identificador`
- [ ] Página `/contas` — lista contas e botão "Conectar conta bancária"
- [ ] Testar com conta sandbox (a Cumbuca disponibiliza ambiente de homologação)

**Entrega do dia:** Conexão bancária funcionando de ponta a ponta, tokens salvos, extrato no banco.

---

### Dia 3 — Upload ERP (5h)
- [ ] `lib/parser/csv.ts` com PapaParse
- [ ] `lib/parser/xlsx.ts` com SheetJS
- [ ] `POST /api/upload` — recebe arquivo, detecta tipo, parseia, salva
- [ ] Componente `<UploadZone>` com drag & drop (react-dropzone)
- [ ] Tela de mapeamento de colunas (dropdown para cada campo)
- [ ] Salvar mapeamento por empresa para reuso

**Entrega do dia:** Upload de qualquer CSV/XLSX com mapeamento customizado.

---

### Dia 4 — Motor de Conciliação (6h)
- [ ] `lib/matcher/engine.ts` com os 4 passos do matching
- [ ] `lib/matcher/rules.ts` com tolerâncias
- [ ] `POST /api/conciliacoes` — inicia processamento
- [ ] `GET /api/conciliacoes/:id` com paginação dos itens
- [ ] Status PROCESSANDO → CONCLUIDA com polling no frontend

**Entrega do dia:** Conciliação automática funcionando end-to-end.

---

### Dia 5 — Dashboard e Visualização (6h)
- [ ] `GET /api/dashboard` — resumo geral
- [ ] Página `/dashboard` — cards de resumo + gráfico simples (recharts)
- [ ] Página `/conciliacoes` — lista com filtros (período, status)
- [ ] Página `/conciliacoes/:id` — tabela de itens com badges coloridos
- [ ] Filtro por status (CONCILIADO / DIVERGENTE / FALTANDO)
- [ ] Paginação da tabela

**Entrega do dia:** Dashboard navegável e bonito o suficiente para demo.

---

### Dia 6 — Conciliação Manual e Polimento (5h)
- [ ] `PATCH /api/conciliacoes/:id/manual` — vincular/desvincular itens
- [ ] Modal de conciliação manual: drag ou seleção de pares
- [ ] `GET /api/conciliacoes/:id/export` — download CSV resultado
- [ ] Tratamento de erros visível (toasts com sonner)
- [ ] Loading states em todas as ações
- [ ] Responsive básico

**Entrega do dia:** Produto usável por um humano sem instruções.

---

### Dia 7 — Deploy e Homologação (4h)
- [ ] Deploy Vercel + Supabase produção
- [ ] `prisma migrate deploy` no banco de produção
- [ ] Variáveis de ambiente configuradas
- [ ] Teste ponta a ponta com conta real
- [ ] Domínio customizado
- [ ] Cadastrar 1–2 clientes beta

**Entrega do dia:** URL funcionando em produção com cliente real usando.

---

## 11. O que Cortar do Escopo (MVP)

| Feature | Motivo para cortar |
|---------|-------------------|
| Multi-usuário por empresa | Complexidade de permissões — 1 dono por empresa no MVP |
| Notificações por e-mail | Polling simples resolve; e-mail = mais dependência |
| Regras de matching customizáveis por cliente | Configuração hardcoded resolve 90% dos casos |
| Relatórios PDF | Export CSV já serve para validar |
| Histórico de auditoria detalhado | `updatedAt` + `resolvidoPor` já capturam o essencial |
| Integração direta com ERPs (API) | Upload manual é o suficiente para validar |
| Onboarding guiado | Você mesmo onboarda os primeiros clientes |
| Suporte a múltiplos arquivos por conciliação | 1 arquivo por vez simplifica o parser |

**Regra:** Se não impede a venda ou o uso básico, corta.

---

## 12. Gargalos Futuros (a resolver depois)

| Gargalo | Quando vai doer | Solução futura |
|---------|----------------|----------------|
| Processamento síncrono de conciliação | >5.000 linhas por arquivo | Mover para background job (Trigger.dev ou BullMQ) |
| Token Cumbuca expira mid-request | Alta frequência de sync | Refresh automático com retry (token dura ~15min, refresh dura mais) |
| Multi-banco por cliente | Cliente tem conta em 2+ bancos | Cada banco tem `BANK_AUTH_URL` diferente — montar diretório de bancos no banco de dados |
| Upload de arquivo grande (>10MB) | Clientes com ERPs grandes | Upload direto para Supabase Storage, processar assíncrono |
| Múltiplos usuários por empresa | Segundo cliente pede isso | Adicionar tabela `Membro` com roles |
| Tempo de resposta do matching | >10k transações | Índices + paginação no matching |
| Custo Vercel em serverless | Muitas requisições | Migrar API para Railway (Node persistente) |
| Migrar de Cumbuca para licença própria | Quando escalar e quiser reduzir custo | Troca só o certificado mTLS — zero reescrita de código |

---

## 13. Como Evitar Complexidade

**Regras de ouro para esse projeto:**

1. **Tudo em um Next.js** — resista à vontade de separar "porque fica mais organizado"
2. **Sem filas no MVP** — processamento síncrono + loading state já funcionam até ~5k linhas
3. **Sem cache no MVP** — `revalidatePath()` do Next.js resolve invalidação sem Redis
4. **Sem eventos/webhooks complexos** — polling a cada 3s é feio mas funciona
5. **Sem abstrações prematuras** — 1 `service.ts` por entidade, não uma hierarquia de classes
6. **Um banco, sem réplicas** — Supabase já tem backup automático
7. **Sem Docker no dev** — `postgresql` local ou Supabase cloud desde o dia 1
8. **shadcn/ui** — componentes copiados direto no projeto, sem biblioteca externa que quebra

**Mantra:** *"Funciona em produção hoje > Arquitetura perfeita semana que vem."*

---

## 14. Como Deixar Pronto para Vender Rápido

### Semana 1 (após MVP)
- [ ] Landing page simples com `app.seusite.com.br` apontando para o produto
- [ ] Planos no Stripe: Starter R$ 197/mês, Pro R$ 497/mês
- [ ] Trial de 14 dias sem cartão (flag `trialExpiraEm` no User)
- [ ] Integrar Stripe Webhooks para ativar/bloquear acesso

### Gatilhos de venda imediata
- **Demo gravada** (Loom) mostrando o fluxo completo em 3 minutos
- **Onboarding você mesmo** nos primeiros 5 clientes — você aprende o que falta
- **WhatsApp** como suporte inicial — mais rápido que ticket, você aprende dores reais

### Métricas para validar antes de escalar
- Tempo médio da conciliação (quanto tempo o cliente passa no produto)
- % de itens conciliados automaticamente (meta: >80%)
- NPS de texto livre nas primeiras semanas

### Alavancas de crescimento simples
- Página `/conciliacoes/:id/share` com link público read-only (sem login) → cliente mostra para contador
- Exportar resultado como PDF assinado → documento com "cara de relatório oficial"
- Webhook de alerta: "nova divergência identificada" → WhatsApp/e-mail

---

## Resumo das Decisões Técnicas

| Decisão | Alternativa descartada | Por quê |
|---------|----------------------|---------|
| Monolito Next.js | Express + React separado | Elimina 2 repos, 2 deploys, CORS config |
| NextAuth credentials | Auth0 / Clerk | Sem custo, sem lock-in externo |
| Prisma ORM | Drizzle / knex | Type-safety automática + migrations simples |
| Supabase Postgres | PlanetScale / Neon | Free tier generoso, dashboard bom, Storage incluído |
| Vercel deploy | AWS / GCP | Zero config, preview por PR, analytics grátis |
| Polling para status | WebSockets / SSE | 10 linhas vs 100 linhas, serve perfeitamente |
| CSV export | PDF / relatório bonito | Entregável funcional sem biblioteca de PDF |
| PapaParse + SheetJS | Processamento no servidor customizado | Bibliotecas maduras, 5 linhas de código |
| **Cumbuca como proxy regulatório** | **Licença ITP própria do BACEN** | **Licença própria = 6–18 meses. Cumbuca = dias. Sem reescrita ao migrar — só troca certificado** |
| **Cumbuca vs OFaaS proprietário** | **Celcoin, Pluggy, Belvo** | **Cumbuca expõe a API oficial do BACEN 1:1. OFaaS abstrai e limita o que você pode fazer** |

---

*Arquitetura desenhada para 1 dev, 7 dias, produção real.*  
*Qualquer dúvida sobre um módulo específico, detalhe qual e posso aprofundar.*