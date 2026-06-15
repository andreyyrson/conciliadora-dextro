"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, X } from "lucide-react"

export interface FiltrosLancamentos {
  search: string
  tipo: string
  dataInicio: string
  dataFim: string
}

interface FiltrosLancamentosProps {
  filtros: FiltrosLancamentos
  onChange: (filtros: FiltrosLancamentos) => void
  onAplicar: () => void
  loading?: boolean
}

export function FiltrosLancamentos({
  filtros,
  onChange,
  onAplicar,
  loading,
}: FiltrosLancamentosProps) {
  const [expandido, setExpandido] = useState(false)

  const handleChange = useCallback(
    (campo: keyof FiltrosLancamentos, valor: string) => {
      onChange({ ...filtros, [campo]: valor })
    },
    [filtros, onChange]
  )

  const limpar = () => {
    onChange({ search: "", tipo: "", dataInicio: "", dataFim: "" })
  }

  const temFiltros = filtros.search || filtros.tipo || filtros.dataInicio || filtros.dataFim

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em descrição, identificador ou banco..."
            value={filtros.search}
            onChange={(e) => handleChange("search", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAplicar()}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpandido(!expandido)}
          className={temFiltros ? "border-brand text-brand" : ""}
        >
          <Filter className="w-4 h-4 mr-1" />
          Filtros
          {temFiltros && <span className="ml-1 w-2 h-2 rounded-full bg-brand" />}
        </Button>
        <Button size="sm" onClick={onAplicar} disabled={loading}>
          Buscar
        </Button>
      </div>

      {expandido && (
        <div className="p-3 border border-border rounded-lg bg-accent/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={filtros.tipo} onValueChange={(v) => handleChange("tipo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="DEBITO">Débito</SelectItem>
                  <SelectItem value="CREDITO">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data início</label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleChange("dataInicio", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data fim</label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleChange("dataFim", e.target.value)}
              />
            </div>
          </div>
          {temFiltros && (
            <Button variant="ghost" size="sm" onClick={limpar} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
