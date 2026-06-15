"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { UploadErpScreen } from "./upload-erp-screen"
import { ExtratoScreen } from "./extrato-screen"

export default function ImportarPage() {
  const [modo, setModo] = useState<"erp" | "extrato">("extrato")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Dados"
        description="Importe dados do ERP do sistema ou extratos bancários (OFX/CSV)"
      />

      <div className="flex gap-2">
        <button
          onClick={() => setModo("extrato")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            modo === "extrato"
              ? "bg-brand text-white"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          Extrato Bancário
        </button>
        <button
          onClick={() => setModo("erp")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            modo === "erp"
              ? "bg-brand text-white"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          ERP do Sistema
        </button>
      </div>

      {modo === "erp" ? <UploadErpScreen /> : <ExtratoScreen />}
    </div>
  )
}
