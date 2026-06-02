import { PainelSidebar } from "@/components/painel-sidebar"
import { PainelHeader } from "@/components/painel-header"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <PainelSidebar context="company" />
      <div className="flex-1 flex flex-col min-w-0">
        <PainelHeader context="company" tenants={[]} user={{}} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
