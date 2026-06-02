import React from "react"
import { PainelSidebar } from "./painel-sidebar"
import { PainelHeader } from "./painel-header"

interface PainelShellProps {
  context: "portfolio" | "company"
  tenantId?: string
  role: string
  tenants: Array<{ id: string; name: string }>
  user: { name?: string; email?: string }
  children: React.ReactNode
}

export function PainelShell({
  context,
  tenantId,
  role,
  tenants,
  user,
  children,
}: PainelShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  return (
    <div className="flex h-screen bg-background">
      <PainelSidebar
        context={context}
        tenantId={tenantId}
        tenantName={tenants.find((t) => t.id === tenantId)?.name}
        role={role}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <PainelHeader
          context={context}
          tenantId={tenantId}
          tenants={tenants}
          user={user}
          role={role}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
