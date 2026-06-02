# Design System Dextro - Frontend

Documentação do design system e padrões de UI para reutilização em outras aplicações.

## Stack Tecnológica

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Ícones:** Lucide React
- **Fontes:** Inter (sans), JetBrains Mono (mono)
- **Autenticação:** NextAuth (Credentials)
- **Gráficos:** Recharts

## Design System

### Tema: Dark-First

O sistema usa tema escuro como padrão, com suporte a tema claro.

#### Cores (Tema Escuro - Default)

```css
--background: #000000
--foreground: #f5f5f7
--card: #1c1c1e
--primary: #f5f5f7
--secondary: #1c1c1e
--muted: #1c1c1e
--accent: #2c2c2e
--destructive: #ff453a
--border: rgba(255, 255, 255, 0.12)
--input: rgba(255, 255, 255, 0.2)
--ring: #0a84ff
```

#### Cores Semânticas

```css
--brand: #0a84ff
--success: #30d158
--warning: #ffd60a
--danger: #ff453a
```

#### Paleta de Gráficos

```css
--chart-1: #0a84ff
--chart-2: #30d158
--chart-3: #5e5ce6
--chart-4: #ff9f0a
--chart-5: #40c8e0
```

### Tipografia

#### Escala Tipográfica

- **xs:** 12px - chips/labels/captions
- **sm:** 13px - meta/descrições
- **base:** 14px - corpo de UI
- **lg:** 20px - título de card
- **xl:** 24px - título de página
- **2xl:** 32px - display
- **3xl:** 48px - título de seção
- **4xl:** 76px - hero

#### Fontes

- **Sans:** Inter (UI)
- **Mono:** JetBrains Mono (números/código)

### Espaçamento

Grade de 4px: 4/8/12/16/24/32/48/64/96/128px

### Bordas (Radius)

- **sm:** 8px - controles
- **md:** 10px - cards
- **lg:** 12px - cards
- **xl:** 14px - superfícies
- **2xl:** 20px - superfícies grandes
- **3xl:** 28px - hero

## Componentes Principais

### PainelShell

Layout base para painéis administrativos.

**Props:**
- `context: "portfolio" | "company"` - contexto de navegação
- `tenantId?: string` - ID do tenant ativo
- `role: string` - role do usuário
- `tenants: Array<{ id, name }>` - lista de tenants
- `user: { name?, email? }` - dados do usuário
- `children: React.ReactNode` - conteúdo

**Estrutura:**
```tsx
<PainelShell context="company" tenantId="..." role="MASTER" tenants={...} user={...}>
  {/* conteúdo */}
</PainelShell>
```

### PainelSidebar

Sidebar fixa com navegação por contextos.

**Props:**
- `context: "portfolio" | "company"`
- `tenantId?: string`
- `tenantName?: string`
- `role?: string`
- `collapsed?: boolean`
- `onToggle?: () => void`

**Comportamento:**
- **Portfolio:** mostra "Gestão" (Empresas, Equipe)
- **Company:** mostra "Visão geral" (Início) + "Financeiro" (DRE, Lançamentos)
- **CLIENT:** não vê Lançamentos
- **CONSULTANT:** não vê Lançamentos
- **MASTER/ADMIN:** veem tudo

**Estados:**
- **Expandido:** 240px (w-60)
- **Colapsado:** 68px (w-[68px])

### PainelHeader

Header fixo com seletor de tenant e perfil.

**Props:**
- `context: "portfolio" | "company"`
- `tenantId?: string`
- `tenants: Array<{ id, name }>`
- `user: { name?, email? }`
- `role?: string`

**Funcionalidades:**
- Seletor de tenant (escondido para CLIENT)
- Botões de edição/exclusão (condicionado a role)
- Dropdown de perfil (editar, logout)
- Diálogos para editar tenant e perfil

## Padrões de UI

### Navegação por Role

```typescript
const canManage = role === "MASTER" || role === "ADMIN";
const canDelete = role === "MASTER";
```

**CLIENT:**
- Single-tenant
- View-only
- Redirecionamento automático para seu tenant

**CONSULTANT:**
- Multi-tenant
- View-only
- Seletor de empresas

**ADMIN:**
- Multi-tenant
- Gestão de empresas
- Edição de dados

**MASTER:**
- Multi-tenant
- Gestão completa
- Exclusão de empresas

### Layout de Página

**Estrutura padrão:**
```tsx
export default async function Page() {
  // Server component - busca dados
  return (
    <div className="space-y-6">
      <PageHeader title="Título" description="Descrição" />
      {/* conteúdo */}
    </div>
  );
}
```

### Cards e Containers

**Card padrão:**
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  {/* conteúdo */}
</div>
```

**KPI Card:**
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  <div className="text-sm font-medium text-muted-foreground">Label</div>
  <div className="text-2xl font-semibold text-foreground">Valor</div>
</div>
```

### Botões

**Primário:**
```tsx
<Button onClick={...}>Ação</Button>
```

**Secundário:**
```tsx
<Button variant="outline" onClick={...}>Ação</Button>
```

**Destrutivo:**
```tsx
<Button variant="destructive" onClick={...}>Excluir</Button>
```

**Icon:**
```tsx
<Button variant="ghost" size="icon" onClick={...}>
  <Icon size={18} />
</Button>
```

### Inputs

```tsx
<Input value={value} onChange={(e) => setValue(e.target.value)} />
```

### Diálogos

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>Descrição</DialogDescription>
    </DialogHeader>
    {/* conteúdo */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={...}>Salvar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dropdown Menus

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost">Trigger</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Item 1</DropdownMenuItem>
    <DropdownMenuItem>Item 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Padrões de Código

### Server Components

Usar server components para busca inicial de dados:

```tsx
export default async function Page({ params }: { params: { tenantId: string } }) {
  const data = await fetchData(params.tenantId);
  return <ClientComponent data={data} />;
}
```

### Client Components

Usar client components para estado e interações:

```tsx
"use client";

export function ClientComponent({ data }: { data: Data }) {
  const [state, setState] = useState(data);
  // ...
}
```

### Fetch de Dados

```tsx
const res = await fetch(`${apiUrl}/endpoint`, {
  headers: { Authorization: `Bearer ${accessToken}` },
  cache: "no-store",
});
const data = await res.json();
```

### Permissões

```typescript
const canWrite = role === "MASTER" || role === "ADMIN";
const canManage = role === "MASTER" || role === "ADMIN";
const canDelete = role === "MASTER";
```

## Estilos CSS

### Classes Utilitárias Principais

**Espaçamento:**
- `p-6` - padding padrão
- `space-y-6` - espaçamento vertical entre elementos
- `gap-4` - espaçamento em flex/grid

**Texto:**
- `text-sm` - texto pequeno
- `text-base` - texto base
- `text-lg` - texto grande
- `text-xl` - título
- `font-semibold` - peso semibold
- `text-muted-foreground` - texto secundário

**Cores:**
- `bg-background` - fundo
- `bg-card` - fundo de card
- `bg-primary` - cor primária
- `text-foreground` - texto principal
- `text-muted-foreground` - texto secundário
- `border-border` - borda

**Bordas:**
- `rounded-lg` - borda arredondada
- `border` - borda padrão
- `border-border` - cor de borda

**Transições:**
- `transition-colors` - transição de cores
- `duration-150` - duração rápida
- `ease-in-out` - easing suave

## Acessibilidade

- Foco visível: `outline: 2px solid var(--ring)`
- Preferência de movimento reduzido: `@media (prefers-reduced-motion: reduce)`
- ARIA labels em botões icon
- Navegação por teclado

## Responsividade

- Sidebar colapsável em mobile
- Layout flexível com breakpoints
- Texto responsivo com classes Tailwind

## Animações

- `tw-animate-css` para animações CSS
- Transições suaves em hover/focus
- Reduzido para usuários com preferência

## Ícones

Lucide React - ícones consistentes e customizáveis.

```tsx
import { IconName } from "lucide-react";
<IconName size={18} />
```

## Gráficos

Recharts para visualização de dados.

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
```

## Convenções de Nomenclatura

- **Componentes:** PascalCase (`PainelSidebar`)
- **Arquivos:** kebab-case (`painel-sidebar.tsx`)
- **Variáveis:** camelCase (`tenantId`)
- **Constantes:** UPPER_SNAKE_CASE (`API_URL`)

## Estrutura de Pastas

```
app/
  painel/
    _components/     # componentes compartilhados do painel
    [tenantId]/      # rotas dinâmicas por tenant
      inicio/        # página inicial
      dre/           # DRE
      lancamentos/   # lançamentos
  components/       # componentes globais
  lib/              # utilitários e funções puras
```

## Boas Práticas

1. **Server-first:** Usar server components sempre que possível
2. **Pure functions:** Extrair lógica para funções puras testáveis
3. **Type safety:** Usar TypeScript estrito
4. **Consistência:** Seguir padrões estabelecidos
5. **Performance:** Usar `cache: "no-store"` em fetch de dados dinâmicos
6. **Acessibilidade:** Adicionar ARIA labels e suporte a teclado
7. **Responsividade:** Testar em diferentes tamanhos de tela
8. **Dark mode:** Testar em ambos os temas

## Migração para Outra Aplicação

Para aplicar este design system em outra aplicação:

1. **Copiar globals.css** - tema e tokens CSS
2. **Instalar dependências:**
   - shadcn/ui
   - lucide-react
   - recharts
   - next/font (Inter, JetBrains Mono)
3. **Configurar Tailwind** - usar configuração do projeto
4. **Copiar componentes base:**
   - PainelShell
   - PainelSidebar
   - PainelHeader
5. **Adaptar lógica de negócio** - manter estrutura, mudar dados
6. **Ajustar navegação** - conforme necessidades da aplicação
7. **Manter padrões de UI** - consistência visual

## Exemplo de Implementação

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <PainelShell context="company" tenantId="..." role="ADMIN" tenants={...} user={...}>
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Visão geral" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard label="Receita" value="R$ 100.000" />
          <KpiCard label="Despesas" value="R$ 50.000" />
          <KpiCard label="Lucro" value="R$ 50.000" />
        </div>
      </div>
    </PainelShell>
  );
}
```
