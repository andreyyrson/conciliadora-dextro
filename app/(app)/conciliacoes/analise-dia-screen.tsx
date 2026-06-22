"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { FiltrosPeriodo, type FiltroStatusExportacao } from "./analise-dia/filtros-periodo"
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
  const [tipo, setTipo] = useState<"TODAS" | "RECEITAS" | "DESPESAS">("TODAS")
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusExportacao>("TODOS")
  const [banco, setBanco] = useState("")
  const [bancosDisponiveis, setBancosDisponiveis] = useState<string[]>([])
  const [arquivo, setArquivo] = useState("")
  const [arquivosDisponiveis, setArquivosDisponiveis] = useState<string[]>([])

  const buscarBancosDisponiveis = useCallback(async () => {
    if (!empresaId || !dataInicio || !dataFim) return
    try {
      const res = await fetch(
        `/api/conciliacoes/analise-dia?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}`
      )
      const data = await res.json()
      if (res.ok && data.dias) {
        const set = new Set<string>()
        const setArq = new Set<string>()
        for (const dia of data.dias) {
          for (const tx of dia.transacoesErp) {
            if (tx.banco) set.add(tx.banco)
          }
          for (const tx of dia.transacoesExtrato) {
            if (tx.banco) set.add(tx.banco)
            const arq = (tx as any).arquivoUpload as string | undefined
            if (arq) setArq.add(arq)
          }
        }
        setBancosDisponiveis(Array.from(set).sort())
        setArquivosDisponiveis(Array.from(setArq).sort())
      }
    } catch {
      // Silencioso: se falhar, mantém lista vazia
    }
  }, [empresaId, dataInicio, dataFim])

  const controllerRef = React.useRef<AbortController | null>(null)
  const inFlightRef = React.useRef<Map<string, Promise<any>>>(new Map())

  const buscarAnalise = useCallback(async () => {
    if (!empresaId || !dataInicio || !dataFim) {
      setError("Selecione empresa e período")
      return
    }
    setLoading(true)
    setError("")
    try {
      const tipoParam = tipo !== "TODAS" ? `&tipo=${tipo}` : ""
      const bancoParam = banco ? `&banco=${encodeURIComponent(banco)}` : ""
      const arquivoParam = arquivo ? `&arquivo=${encodeURIComponent(arquivo)}` : ""
      const url = `/api/conciliacoes/analise-dia?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}${tipoParam}${bancoParam}${arquivoParam}`
      const key = `${empresaId}|${dataInicio}|${dataFim}|${tipo}|${banco}|${arquivo}`

      // Dedupe: se já existe uma request idêntica em voo, aguardar a mesma
      const existing = inFlightRef.current.get(key)
      if (existing) {
        const data = await existing
        setDias(data.dias || [])
        return
      }

      // Cancelar requisição anterior (diferente) se existir
      if (controllerRef.current) {
        try { controllerRef.current.abort() } catch {}
      }
      const controller = new AbortController()
      controllerRef.current = controller

      const promise = fetch(url, { signal: controller.signal }).then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Erro ao buscar análise")
        }
        return data
      })
      inFlightRef.current.set(key, promise)
      const data = await promise
      setDias(data.dias || [])
      inFlightRef.current.delete(key)
    } catch {
      setError("Erro ao buscar análise por dia")
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataInicio, dataFim, tipo, banco, arquivo])

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
    if (exportando) return
    setExportando(true)
    try {
      const statusParam = filtroStatus !== "TODOS" ? `&status=${filtroStatus}` : ""
      const res = await fetch(
        `/api/conciliacoes/analise-dia/exportar?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}${statusParam}`
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
      const t = setTimeout(() => {
        buscarAnalise()
        buscarBancosDisponiveis()
      }, 400)
      return () => clearTimeout(t)
    }
  }, [empresaId, dataInicio, dataFim, tipo, banco, arquivo])

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
      {loading && (
        <div className="h-1 w-full bg-accent rounded overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-pulse" />
        </div>
      )}
      <FiltrosPeriodo
        dataInicio={dataInicio}
        dataFim={dataFim}
        tipo={tipo}
        filtroStatus={filtroStatus}
        banco={banco}
        bancosDisponiveis={bancosDisponiveis}
        arquivo={arquivo}
        arquivosDisponiveis={arquivosDisponiveis}
        loading={loading}
        exportando={exportando}
        podeExportar={dias.length > 0}
        onChangeInicio={setDataInicio}
        onChangeFim={setDataFim}
        onChangeTipo={setTipo}
        onChangeFiltroStatus={setFiltroStatus}
        onChangeBanco={setBanco}
        onChangeArquivo={setArquivo}
        onAnalisar={buscarAnalise}
        onExportar={downloadExcel}
      />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {error}
        </div>
      )}

      {loading && dias.length === 0 && (
        <div className="space-y-3">
          {[0,1,2].map(i => (
            <div key={i} className="h-24 rounded border border-border bg-accent animate-pulse" />
          ))}
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
