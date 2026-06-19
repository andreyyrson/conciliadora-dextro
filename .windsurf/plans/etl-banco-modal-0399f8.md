# Modal de Atribuição de Banco após Upload (ETL)

Quando o upload de extrato não detectar o banco automaticamente do nome do arquivo, abrir um modal para o consultor selecionar o banco de uma lista pré-cadastrada. O banco é salvo nos lançamentos da importação e não pode ser alterado depois.

## Contexto Atual

- Upload em lote gerenciado por `useUploadLote` (`app/(app)/importar/extrato/use-upload-lote.ts`)
- OFX vai direto para `/api/ofx/upload`
- CSV passa por análise primeiro (`/api/csv/analisar`), depois upload
- Upload já detecta banco do nome do arquivo e retorna `bancoDetectado: string | null`
- Modal `MapeamentoCsvModal` já existe para mapeamento de colunas CSV

## Passos

### 1. Criar tabela `Banco` no Prisma
- **Arquivo**: `prisma/schema.prisma`
- Novo model:
  ```prisma
  model Banco {
    id        String   @id @default(cuid())
    nome      String   @unique
    ativo     Boolean  @default(true)
    createdAt DateTime @default(now())
  }
  ```
- Migration para criar tabela
- Seed inicial com os ~60 bancos do `detectar-banco.ts`

### 2. APIs de Banco
- **GET `/api/bancos/route.ts`**: Listar todos os bancos ativos (ordenados por nome)
- **PATCH `/api/importacoes-extrato/[id]/route.ts`**: Atualizar banco de uma importação
  - Recebe `banco: string`
  - Atualiza `banco` em todos os `ExtratoImportado` onde `importacaoId === id`
  - Retorna `{ updated: number }`

### 3. Atualizar APIs de upload para retornar bancoDetectado
- **CSV upload** (`app/api/csv/upload/route.ts`): Já retorna `bancoDetectado`, verificar que funciona
- **OFX upload** (`app/api/ofx/upload/route.ts`): Já retorna `bancoDetectado`, verificar que funciona
- Ambas devem retornar também o `importacao.id` criado

### 4. Atualizar `useUploadLote` para gerenciar modal de banco
- **Arquivo**: `app/(app)/importar/extrato/use-upload-lote.ts`
- Novo estado: `bancoPendente: { item: FilaItem; importacaoId: string } | null`
- Após upload OFX/CSV com sucesso:
  - Se `data.bancoDetectado` é string → mostrar toast "Banco detectado: X" (ok)
  - Se `data.bancoDetectado` é null → setar `bancoPendente` com o item e importacaoId
- Funções:
  - `confirmarBanco(banco: string)` → chama PATCH `/api/importacoes-extrato/{id}`, depois continua
  - `pularBanco()` → marca o item como erro "Banco não atribuído"
- Ajustar `confirmarMapeamento` e `confirmarTodos` para verificar `bancoPendente` após upload

### 5. Criar componente `SelecionarBancoModal`
- **Arquivo**: `app/(app)/importar/extrato/selecionar-banco-modal.tsx`
- Similar ao `MapeamentoCsvModal` em estilo
- Busca lista de bancos via GET `/api/bancos` (ou carrega lista estática)
- Select dropdown com todos os bancos
- Botão "Confirmar" (disabled sem seleção)
- Botão "Cancelar" (marca como erro)
- Mostra nome do arquivo para contexto

### 6. Integrar modal na `ExtratoScreen`
- **Arquivo**: `app/(app)/importar/extrato-screen.tsx`
- Renderizar `<SelecionarBancoModal>` quando `bancoPendente` existe
- Passar callbacks: `onConfirmar={confirmarBanco}`, `onCancelar={pularBanco}`

### 7. Atualizar tela de lista de importações
- **Arquivo**: `app/(app)/importar/extrato/lista-importacoes-resumida.tsx`
- Exibir o banco atribuído em cada importação (se houver)

## Fluxo de Execução

1. Consultor arrasta 3 arquivos: `extrato_itau.csv`, `movimentacao.ofx`, `dados.csv`
2. Sistema processa:
   - `extrato_itau.csv` → detecta "Itaú" → upload ok → toast "Itaú detectado"
   - `movimentacao.ofx` → não detecta → upload ok com `bancoDetectado: null` → abre modal
   - `dados.csv` → análise → mapeamento confiável → upload ok → detecta null → abre modal
3. Consultor seleciona "Bradesco" no modal do `movimentacao.ofx` → confirma → PATCH API → ok
4. Consultor seleciona "Santander" no modal do `dados.csv` → confirma → PATCH API → ok
5. Todos os arquivos processados, lista de importações atualizada com bancos

## Decisões de Design

- **Por que tabela `Banco` no banco?** Permite administrar a lista sem alterar código. Pode desativar bancos, adicionar novos via painel admin no futuro.
- **Por que PATCH na importação inteira?** O campo `banco` está em `ExtratoImportado`, mas atribuir um por um é lento. Atualizar todos de uma vez pela importaçãoId é eficiente.
- **Por que não detectar automaticamente é suficiente?** O usuário testou e viu que consultores nomeiam arquivos de formas imprevisíveis. Modal garante consistência.
- **Lista de bancos pré-cadastrada**: Populada com os ~60 bancos já identificados. Pode ser expandida via seed/migration.
