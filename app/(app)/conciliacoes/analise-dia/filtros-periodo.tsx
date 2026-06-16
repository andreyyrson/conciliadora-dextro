"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Download, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

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
  const [openInicio, setOpenInicio] = useState(false)
  const [openFim, setOpenFim] = useState(false)

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Início</label>
          <Popover open={openInicio} onOpenChange={setOpenInicio}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start w-[200px]" role="combobox">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {dataInicio || "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-2">
              <Calendar
                mode="single"
                selected={dataInicio ? new Date(dataInicio) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const v = date.toISOString().split("T")[0]
                    onChangeInicio(v)
                    setOpenInicio(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Fim</label>
          <Popover open={openFim} onOpenChange={setOpenFim}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start w-[200px]" role="combobox">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {dataFim || "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-2">
              <Calendar
                mode="single"
                selected={dataFim ? new Date(dataFim) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const v = date.toISOString().split("T")[0]
                    onChangeFim(v)
                    setOpenFim(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={onAnalisar} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarIcon className="w-4 h-4 mr-2" />}
          {loading ? "Carregando..." : "Analisar"}
        </Button>
        <Button onClick={onExportar} disabled={exportando || !podeExportar} variant="outline">
          {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {exportando ? "Exportando..." : "Exportar Excel"}
        </Button>
      </div>
    </Card>
  )
}
