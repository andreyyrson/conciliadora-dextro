"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Download } from "lucide-react"

interface FiltrosPeriodoProps {
  dataInicio: string
  dataFim: string
  loading: boolean
  exportando: boolean
  podeExportar: boolean
  onChangeInicio: (v: string) => void
  onChangeFim: (v: string) => void
  onAnalisar: () => void
  onExportar: () => void
}

export function FiltrosPeriodo({
  dataInicio,
  dataFim,
  loading,
  exportando,
  podeExportar,
  onChangeInicio,
  onChangeFim,
  onAnalisar,
  onExportar
}: FiltrosPeriodoProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => onChangeInicio(e.target.value)}
            className="p-2 border rounded bg-background border-border text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => onChangeFim(e.target.value)}
            className="p-2 border rounded bg-background border-border text-foreground"
          />
        </div>
        <Button onClick={onAnalisar} disabled={loading}>
          <Calendar className="w-4 h-4 mr-2" />
          {loading ? "Carregando..." : "Analisar"}
        </Button>
        <Button onClick={onExportar} disabled={exportando || !podeExportar} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          {exportando ? "Exportando..." : "Exportar Excel"}
        </Button>
      </div>
    </Card>
  )
}
