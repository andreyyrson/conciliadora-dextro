"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConciliacoesListaScreen } from "./conciliacoes-lista-screen"
import { AnaliseDiaScreen } from "./analise-dia-screen"

export default function ConciliacoesPage() {
  const [tab, setTab] = useState("lista")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conciliações"
        description="Gerencie e analise conciliações bancárias"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="analise">Análise por Dia</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-6">
          <ConciliacoesListaScreen />
        </TabsContent>

        <TabsContent value="analise" className="mt-6">
          <AnaliseDiaScreen />
        </TabsContent>
      </Tabs>
    </div>
  )
}
