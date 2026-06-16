"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { FiltrosPeriodo } from "./analise-dia/filtros-periodo"
import { DiaCard } from "./analise-dia/dia-card"
import type { DiaAnalise } from "./analise-dia/types"

export function AnaliseDiaScreen() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const [dias, setDias] = useState<DiaAnalise[]>([])
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return primeiroDia.toISOString().split("T")[0]
  })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set())
  const [exportando, setExportando] = useState(false)

  const buscarAnalise = useCallback(async () => {
    if (!empresaId || !dataInicio || !dataFim) {
      setError("Selecione empresa e período")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(
        `/api/conciliacoes/analise-dia?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao buscar análise")
        return
      }
      setDias(data.dias || [])
    } catch {
      setError("Erro ao buscar análise por dia")
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataInicio, dataFim])

  const toggleDia = (data: string) => {
    setDiasExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(data)) novo.delete(data)
      else novo.add(data)
      return novo
    })
  }

  const downloadExcel = async () => {
    if (!empresaId || !dataInicio || !dataFim) return
    setExportando(true)
    try {
      const res = await fetch(
        `/api/conciliacoes/analise-dia/exportar?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}`
      )
      if (!res.ok) throw new Error("Erro ao exportar")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analise-dia-${dataInicio}-${dataFim}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao exportar")
    } finally {
      setExportando(false)
    }
  }

  useEffect(() => {
    if (empresaId && dataInicio && dataFim) {
      buscarAnalise()
    }
  }, [empresaId, dataInicio, dataFim, buscarAnalise])

  if (!session) return null

  if (!empresaId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          Selecione uma empresa no topo da página para visualizar a análise por dia.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <FiltrosPeriodo
        dataInicio={dataInicio}
        dataFim={dataFim}
        loading={loading}
        exportando={exportando}
        podeExportar={dias.length > 0}
        onChangeInicio={setDataInicio}
        onChangeFim={setDataFim}
        onAnalisar={buscarAnalise}
        onExportar={downloadExcel}
      />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {error}
        </div>
      )}

      {dias.length > 0 && (
        <div className="space-y-3">
          {dias.map((dia) => (
            <DiaCard
              key={dia.data}
              dia={dia}
              expandido={diasExpandidos.has(dia.data)}
              onToggle={() => toggleDia(dia.data)}
              onAfterAction={() => buscarAnalise()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
