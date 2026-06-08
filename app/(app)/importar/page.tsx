"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { UploadErpScreen } from "./upload-erp-screen"
import { ExtratoScreen } from "./extrato-screen"

export default function ImportarPage() {
  const [tab, setTab] = useState("erp")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Dados"
        description="Faça upload de arquivos do ERP e gerencie importações de extrato"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="erp">ERP</TabsTrigger>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
        </TabsList>

        <TabsContent value="erp" className="mt-6">
          <UploadErpScreen />
        </TabsContent>

        <TabsContent value="extrato" className="mt-6">
          <ExtratoScreen />
        </TabsContent>
      </Tabs>
    </div>
  )
}
