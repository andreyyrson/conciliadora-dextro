# Análise Minuciosa — Conciliadora Dextro

## 1. Visão Geral da Arquitetura

| Camada | Tecnologia | O que faz |
|---|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion | UI responsiva, animações, upload de arquivos, visualização de dados |
| Backend | Next.js API Routes (serverless), Prisma ORM, PostgreSQL | Auth, CRUD, parsing de arquivos, matching engine |
| Auth | NextAuth.js (Credentials Provider, JWT) | Login por email/senha com bcrypt |
| Testing | Vitest | Unit/Integration tests com mocks |

### Estrutura de Diretórios
```
app/
  (app)/            → páginas protegidas por middleware
  api/              → rotas de API (REST)
  login/            → página pública
components/         → shadcn + custom components
lib/                → lógica de negócio (engine, auth, db, parsers)
prisma/             → schema + migrations
```

---

## 2. Análise dos Testes

### 2.1. Suite de Testes Existentes

| Arquivo de Teste | Cobertura | Força | Fragilidade |
|---|---|---|---|
| `lib/matching/engine.test.ts` | 12 testes — gerarSugestões | ✅ Boa — cobre os 4 status, totais, hash, limite top 3 | ⚠️ Não testa match cross-day (±3 dias), nem cenários de volume |
| `lib/matching/engine-business.test.ts` | 48 testes — funções individuais | ✅ Excelente — cada score function tem limiares testados | ✅ Muito robusto |
| `lib/normalizacao/detector-colunas.test.ts` | ~15 testes | ✅ Boa — cobre heurísticas de nome e conteúdo | ⚠️ Testa apenas casos ideais |
| `lib/normalizacao/pipeline.test.ts` | ~15 testes | ✅ Boa — formatos de data/valor, pipeline completo | ✅ OK |
| `lib/ofx/parser.test.ts` | 8 testes | ⚠️ Regular — valida parsing básico, mas não cobre QFX, OFX XML (moderno), nem edge cases de encoding | ❌ Parser é frágil (ver abaixo) |
| `app/api/conciliacoes/analise-dia/exportar/route.test.ts` | 1 teste | ❌ Fraca — teste unitário simulado, não chama a API real | ❌ Não testa o route.ts real, apenas replica a lógica manualmente |
| `lib/db.test.ts` | ? | ⚠️ Apenas validação de types | — |
| `lib/utils.test.ts` | ? | — | — |
| `lib/schemas.test.ts` | ? | — | — |
| `lib/rate-limit.test.ts` | ? | — | — |

### 2.2. Problemas Críticos nos Testes

1. **Export test é falso positivo**: O teste `route.test.ts` não chama a API real. Ele reimplementa a lógica da API em paralelo, então pode passar mesmo que o route.ts esteja quebrado (já aconteceu com timezone).
2. **Falta testes de integração end-to-end**: Nenhum teste chama as rotas de API realmente (com `new Request()` ou similar).
3. **Falta testes de carga no matching**: `gerarSugestoes` é O(n×m) por dia. Não há testes com 1000+ lançamentos.
4. **OFX parser sem testes de regressão**: Não há testes para OFX com múltiplas contas, encoding UTF-8, ou tags malformadas.

---

## 3. Análise do Frontend

### 3.1. Pontos Fortes

- **UX consistente**: uso de shadcn/ui (Card, Button, Table, Input) com Tailwind
- **Animações fluidas**: Framer Motion em transições de expandir/colapsar dias
- **Preview de upload**: CSV tem preview com mapeamento de colunas interativo; OFX agora também tem preview (implementado recentemente)
- **Análise por dia**: cards expansíveis com matching integrado, status coloridos

### 3.2. Problemas Encontrados

1. **Mistura de status visual**: `analise-dia-screen.tsx` mostra totais no header do card (`dia.totalCreditoExtrato || dia.totalCreditoErp`) que pode ser confuso quando há diferença real entre ERP e extrato. O operador `||` esconde a diferença.

2. **Falta de loading states granulares**: quando o usuário clica em "Analisar", não há skeleton loading para os cards de dia.

3. **Não há paginação na Análise por Dia**: se o período for grande (ex: 1 ano), a API retorna todos os dias de uma vez, o que pode gerar payload enorme.

4. **Matching UI não permite ação**: o usuário vê os matches sugeridos/ambíguos, mas não pode confirmar ou rejeitar diretamente na tela. Isso é apenas visualização.

5. **OFX preview falta testes de UI**: o componente de preview de OFX foi adicionado sem testes de componente (React Testing Library).Vou escrever o arquivo completo.



---

## 4. Análise do Backend

### 4.1. Pontos Fortes

- **Separação de responsabilidades**: parsers em `lib/ofx/`, normalização em `lib/normalizacao/`, matching em `lib/matching/`
- **Type-safe**: Prisma + TypeScript garantem tipagem do banco
- **Auth consistente**: `getServerSession(authOptions)` em todas as rotas protegidas
- **Rate limiting**: existe `lib/rate-limit.ts`
- **Índices de banco bem pensados**: `@@index([uploadId, data])`, `@@index([valor, data, tipo])`

### 4.2. Problemas Encontrados

#### A. Segurança

1. **Não há rate limiting nas rotas de API**: embora exista `lib/rate-limit.ts`, as rotas de API não o importam/usam.

2. **SQL Injection potencial via Prisma**: Prisma é parametrizado, mas filtros `in: uploadIds` e ranges de data dependem de validação de input. O `empresaId` vem de query params sem sanitização explícita (Prisma lida bem, mas vale documentar).

3. **Erro 500 genérico**: todas as rotas capturam erros e retornam `"Erro ao ..."` sem logar detalhes no cliente (boa prática), mas algumas não logam o `error.message` no servidor.

#### B. Performance

1. **Análise por dia é O(n×m) por dia**: para cada dia, chama `gerarSugestoes`. Se um dia tiver 100 ERP + 100 extrato, faz 10.000 comparações. Se todos os dias tiverem isso, explode.

2. **Export Excel carrega TUDO em memória**: a rota de export carrega todos os lançamentos do período em arrays JS, depois gera o workbook. Para 1 ano de dados, isso estoura memória.

3. **Não há cache**: cada request busca do banco do zero. Matching é recalculado toda vez.

#### C. Robustez

1. **OFX Parser frágil**: `parseOFX` usa regex simples (`/^<([^>\/+]+)>([^<]*)<\/[^>]+>$/`) que pode falhar com:
   - Tags self-closing (`<TAG/>`)
   - Valores com `<` ou `>` no conteúdo
   - OFX em formato XML moderno (OFX 2.x)
   - Tags aninhadas
   - Arquivos QFX (Quicken) com extensões proprietárias

2. **CSV Parser usa PapaParse diretamente**: não há validação de encoding (UTF-8 BOM pode quebrar headers).

3. **Timezone bugs**: a rota de export usa `new Date(l.data).toLocaleDateString("pt-BR")` que depende do timezone do servidor. O teste já quebrou por isso (fixado com UTC).

---

## 5. Análise da Lógica de Matching (Coração da Aplicação)

### 5.1. Arquitetura do Engine

```
EntradaConciliacao (ERP + Extrato)
  → pré-filtro (tipo, valor ≤5%, data ≤7d)
  → score híbrido (valor + data + descrição + fornecedor + banco)
  → classificação (AUTO_CONFIRMADO / SUGERIDO / AMBIGUO / SEM_MATCH)
  → consumo único de ERP
```

### 5.2. Fórmula de Score

| Campo | Peso Máximo | Regra de limiar |
|---|---|---|
| Valor | 50 | idêntico=50, ≤0.5%=45, ≤1%=40, ≤2%=30, ≤5%=15 |
| Data | 10 | ≤3d=10, ≤7d=5 |
| Descrição | 25 | similaridade híbrida × 25 |
| Fornecedor | 15 | contido na descrição=15, similaridade × 15 |
| Banco | 20 | idêntico normalizado=20, similaridade × 20 |
| **Total** | **120** | — |

### 5.3. Similaridade Híbrida

```
similaridadeHibrida = 0.4 × tokenSimilarity + 0.4 × trigramSimilarity + 0.2 × levenshteinSimilarity
```

**Avaliação**: A fórmula é boa e robusta. Combina:
- Token (semântica, palavras-chave)
- Trigram (estrutura de caracteres)
- Levenshtein (edição de caracteres)

### 5.4. Auto-confirmação

Requisitos para `AUTO_CONFIRMADO`:
- Score total ≥ 50
- Valor score ≥ 40 (≤ 1% de diferença)
- Descrição score ≥ 15 (≥ 75% similar)
- Data score ≥ 5 (≤ 7 dias)
- Fornecedor: se existir no ERP, score ≥ 10
- Banco: se existir no ERP, score ≥ 15

**Avaliação**: Os limiares são conservadores e bem calibrados. Um match perfeito chega a 115/120.

### 5.5. Problemas no Matching Engine

1. **Ambiguidade é rara**: a regra `top1.score >= 70 && top2.score >= 70 && diff <= 5` é muito restritiva. Na prática, AMBIGUO quase nunca acontece.

2. **Consumo único de ERP pode ser problemático**: se dois extratos são pagamentos parciais do mesmo ERP, o segundo nunca será sugerido. Isso é uma limitação consciente, mas pode precisar de "match parcial" no futuro.

3. **Matching cross-day limitado**: busca apenas ±3 dias. Para contas com compensação de 2-3 dias úteis, isso pode não ser suficiente (ex: sexta → terça = 4 dias). O pré-filtro aceita 7 dias, mas o matching cross-day só vai até 3.

4. **Score de fornecedor é one-way**: `scoreFornecedor` procura o fornecedor do ERP na descrição do extrato, mas não procura a descrição do ERP no fornecedor. Isso é lógico, mas frágil quando o extrato tem o fornecidor truncado.

5. **Não há aprendizado**: o engine não aprende com confirmações manuais. Cada execução recalcula do zero.

6. **Hash determinístico é frágil**: `hashConciliacao` usa string concatenação de IDs + bitwise shift. Pode colidir em cenários de IDs diferentes com mesmo comprimento.

7. **`entradaOrigemId` / `entradaDestinoId` estão trocados no MatchSugestao**: comentário diz `entradaOrigemId` = ERP, `entradaDestinoId` = extrato. No `gerarSugestoes` a atribuição é correta, mas vale revisar se o frontend usa isso corretamente.

---

## 6. Análise da Análise por Dia

### 6.1. Fluxo da API (`app/api/conciliacoes/analise-dia/route.ts`)

1. Valida auth + empresa
2. Busca uploads ERP, contas bancárias, importações
3. Busca lançamentos ERP + extrato (Open Finance) + extratos importados
4. Agrupa por dia
5. Para cada dia: calcula totais, executa matching, classifica status
6. Retorna array de dias

### 6.2. Classificação de Status do Dia

```
SEM_DADOS      → sem ERP e sem extrato
CONCILIADO     → há auto-confirmados OU (débito e crédito iguais)
SUGERIDO       → há sugestões ou ambiguidades
PARCIAL        → há dados dos dois lados mas não batem
DIVERGENTE     → fallback
```

**Problema**: a lógica de `CONCILIADO` verifica `matching.itens.some(i => i.status === "AUTO_CONFIRMADO")` primeiro. Se houver apenas 1 auto-confirmado em um dia com 50 transações divergentes, o dia inteiro aparece como "Conciliado". Isso é enganoso.

### 6.3. Export Excel (`app/api/conciliacoes/analise-dia/exportar/route.ts`)

**Problemas**:
1. Carrega TUDO em memória (mesmas queries da API)
2. Usa `toLocaleDateString("pt-BR")` — dependente de timezone do servidor
3. A aba "Diferença por Banco" usa `contaMap.get(l.contaId)` para bancos de extrato, mas `extratoLancamento` pode não ter `banco` preenchido. A lógica é defensiva, mas pode gerar "Não Informado" excessivo.
4. Não há streaming — workbook inteiro em buffer.

### 6.4. Frontend (`app/(app)/conciliacoes/analise-dia-screen.tsx`)

**Pontos de atenção**:
- `formatarValor(dia.totalCreditoExtrato || dia.totalCreditoErp)` — mostra o primeiro não-zero, ocultando diferenças reais
- As transações listadas não têm paginação — se um dia tiver 200 transações, a tela fica enorme
- Matching detalhes mostram score e explicações, mas sem ação do usuário

---

## 7. Achados Críticos e Recomendações

### 🔴 CRÍTICO

| # | Problema | Onde | Impacto |
|---|---|---|---|
| 1 | Teste de export não testa a API real | `route.test.ts` | Falso positivo, já quebrou em produção |
| 2 | Matching cross-day limitado a ±3 dias | `engine.ts:382` | Perde matches de compensação bancária (4+ dias úteis) |
| 3 | Status "CONCILIADO" enganoso | `analise-dia/route.ts:204` | 1 auto-confirmado esconde 49 divergências |
| 4 | OFX parser frágil (regex simples) | `lib/ofx/parser.ts` | Pode falhar com OFX reais de bancos brasileiros |
| 5 | Export carrega tudo em memória | `exportar/route.ts` | Estoura memória com períodos grandes |

### 🟡 ALTO

| # | Problema | Onde | Recomendação |
|---|---|---|---|
| 6 | Sem rate limiting nas rotas | Todas as APIs | Adicionar `lib/rate-limit.ts` nas rotas de upload/análise |
| 7 | Sem cache de matching | `analise-dia/route.ts` | Cachear resultado de matching por (empresaId, data) com TTL |
| 8 | Análise por dia não paginada | `analise-dia/route.ts` | Adicionar paginação ou lazy loading |
| 9 | Matching não permite ação do usuário | `analise-dia-screen.tsx` | Adicionar botões "Confirmar" / "Rejeitar" / "Trocar match" |
| 10 | Hash de conciliação pode colidir | `engine.ts:550` | Usar SHA-256 em vez de bitwise shift |

### 🟢 MÉDIO

| # | Problema | Onde | Recomendação |
|---|---|---|---|
| 11 | Valor mostrado no header usa `\|\|` | `analise-dia-screen.tsx:280` | Mostrar ambos os valores (ERP e Extrato) com diff |
| 12 | Sem testes de UI para OFX preview | `contas/page.tsx` | Adicionar testes com React Testing Library |
| 13 | Parser de CSV não lida com BOM UTF-8 | `csv/analisar/route.ts` | Strip BOM antes de parse |
| 14 | `saldoAposBanco` pega último do dia | `analise-dia/route.ts:166` | Documentar que isso é o último saldo reportado |
| 15 | Score de descrição não normaliza CNPJ/CPF | `engine.ts:151` | Normalizar números de documento antes de comparar |

---

## 8. Resumo Executivo

A aplicação tem uma **base técnica sólida**:
- Arquitetura limpa com separação de responsabilidades
- Matching engine bem projetado com scoring híbrido
- Bons testes unitários para funções puras
- TypeScript + Prisma garantem segurança de tipos

Porém, existem **gaps significativos**:
- Testes de integração são insuficientes (export test é falso positivo)
- Performance do matching não escala bem para volumes grandes
- OFX parser é o componente mais frágil do sistema
- A experiência do usuário na Análise por Dia é "read-only" — precisa permitir ação
- Ausência de rate limiting e cache representam riscos operacionais

**Prioridade de ação**:
1. Fixar o teste de export para chamar a API real
2. Fortalecer o OFX parser ou migrar para biblioteca confiável
3. Adicionar rate limiting nas rotas críticas
4. Implementar cache de matching
5. Melhorar a classificação de status do dia (não marcar como CONCILIADO se houver divergências)
