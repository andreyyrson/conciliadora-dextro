# Conciliadora Dextro

Sistema de conciliação bancária que compara lançamentos do ERP do cliente com extratos bancários (Open Finance e importados via CSV/OFX), identifica matches automáticos, divergências e itens não conciliados.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** PostgreSQL + Prisma ORM
- **Auth:** Next-Auth
- **UI:** React 19 + Tailwind CSS + shadcn/ui
- **Testes:** Vitest
- **Planilhas:** xlsx

## Variáveis de Ambiente

Crie um `.env.local` com:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dextro"
NEXTAUTH_SECRET="sua-chave-secreta"
NEXTAUTH_URL="http://localhost:3000"
```

## Como rodar

```bash
# Instalar dependências
npm install

# Gerar cliente Prisma
npx prisma generate

# Dev server
npm run dev
```

Acesse `http://localhost:3000`.

## Testes

O projeto usa **Vitest** para testes unitários.

```bash
# Rodar todos os testes
npm run test

# Modo watch
npm run test:watch

# Com cobertura
npm run test:cov

# Rodar um arquivo específico
npx vitest run lib/conciliacao/build-day.test.ts
```

### Testes principais

| Arquivo | O que testa |
|---------|-------------|
| `lib/conciliacao/build-day.test.ts` | Construção do objeto `DiaConciliacao` |
| `lib/conciliacao/calculate-status.test.ts` | Cálculo do status do dia |
| `lib/conciliacao/daily-matching.extra.test.ts` | Motor de matching diário |
| `lib/conciliacao/index.test.ts` | Pipeline `analisarPorDia` |
| `lib/matching/engine.test.ts` | Engine de score de similaridade |
| `app/api/conciliacoes/analise-dia/exportar/route.test.ts` | Exportação Excel |
| `app/api/ofx/analisar/route.test.ts` | Parsing de OFX |
| `app/api/csv/analisar/route.test.ts` | Parsing de CSV |

---

## API

Todas as rotas requerem autenticação via cookie de sessão do Next-Auth. Erros padrão: `401` (não autenticado), `403` (acesso negado), `400` (dados inválidos), `500` (erro interno).

### Autenticação

- **POST** `/api/auth/register` — Cadastro de novo usuário
  - Body: `{ email, password, name }`
- **GET/POST** `/api/auth/[...nextauth]` — Login/logout (Next-Auth)

### Empresas

- **GET** `/api/empresas?page=1&limit=50`
  - Lista empresas do usuário logado com paginação.
  - Response: `{ empresas, pagination: { page, limit, total, totalPages } }`
- **POST** `/api/empresas`
  - Cria empresa. Body: `{ nome, cnpj? }`
- **DELETE** `/api/empresas?empresaId={id}`
  - Deleta empresa e todos os dados relacionados em cascata.

### Uploads

- **POST** `/api/upload` — Upload de relatório ERP (CSV/Excel)
  - Body: multipart com `file`, `empresaId`, `tipo`
- **POST** `/api/csv/upload` — Upload genérico de CSV
- **POST** `/api/ofx/upload` — Upload de extrato OFX
- **POST** `/api/importacoes` — Cria importação de extrato

### Análise

- **GET** `/api/conciliacoes/analise-dia?empresaId={id}&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&tipo={RECEITAS|DESPESAS}`
  - Retorna análise diária com totais de débito/crédito, diferenças, matches e itens não conciliados.
  - Response: `{ dias: DiaConciliacao[] }`
- **POST** `/api/conciliacoes/rodar`
  - Roda o motor de conciliação para o período.
  - Body: `{ empresaId, dataInicio, dataFim }`
  - Response: `{ dias: DiaConciliacao[], resumo }`
- **GET** `/api/conciliacoes/comparativo?empresaId={id}&dataInicio=&dataFim=&tipo=&status=&search=`
  - Retorna tabela comparativa ERP vs Extrato com filtros.
  - Response: `{ linhas: LinhaComparativa[], totais, periodo }`
- **GET** `/api/conciliacoes/analise-dia/exportar?empresaId={id}&dataInicio=&dataFim=`
  - Exporta Excel com abas: Extrato Bancário, ERP (Relatório), Resumo Diário, Não Conciliados.

### Conciliações

- **POST** `/api/conciliacoes` — Cria conciliação
- **POST** `/api/conciliacoes/aprovar` — Aprova dia
- **POST** `/api/conciliacoes/reprovar` — Reprova dia
- **POST** `/api/conciliacoes/confirmar` — Confirma conciliação
- **POST** `/api/conciliacoes/sugerir` — Gera sugestões de matching
- **GET** `/api/conciliacoes` — Lista conciliações do usuário
- **GET** `/api/conciliacoes/aprovacoes` — Lista aprovações pendentes

### ERP

- **PATCH** `/api/erp/lancamentos/{id}` — Atualiza campo do lançamento ERP
  - Body: `{ descricao?, valor?, data? }`

---

## Estrutura de pastas principais

```
app/
  (app)/               # Rotas protegidas (layout com sidebar)
    conciliacoes/      # Telas de conciliação
    empresas/          # Cadastro de empresas
  api/                 # API routes (Next.js)
    conciliacoes/      # Endpoints de conciliação
    upload/            # Upload de arquivos
    csv/               # Parsing CSV
    ofx/               # Parsing OFX
    erp/               # Endpoints ERP
lib/
  conciliacao/         # Lógica de conciliação (matching, build-day, etc.)
  matching/            # Engine de score de similaridade
  normalizacao/        # Pipeline de normalização de texto
components/            # Componentes UI (shadcn/ui)
```
