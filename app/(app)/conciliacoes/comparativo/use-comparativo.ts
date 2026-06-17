"use client"

import { useState, useCallback, useEffect } from "react"
import type { ErpLancamento, ExtratoLancamento, LinhaComparativa } from "@/lib/conciliacao/comparativo-types"
export type { ErpLancamento, ExtratoLancamento, LinhaComparativa } from "@/lib/conciliacao/comparativo-types"

interface FiltrosComparativo {
  search: string
  tipo: string
  dataInicio: string
  dataFim: string
  status: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UseComparativoOptions {
  empresaId: string | null | undefined
}

export function useComparativo({ empresaId }: UseComparativoOptions) {
  const [erpLancamentos, setErpLancamentos] = useState<ErpLancamento[]>([])
  const [extratoLancamentos, setExtratoLancamentos] = useState<ExtratoLancamento[]>([])
  const [linhas, setLinhas] = useState<LinhaComparativa[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [filtros, setFiltros] = useState<FiltrosComparativo>({
    search: "",
    tipo: "",
    dataInicio: "",
    dataFim: "",
    status: "",
  })
  const [loading, setLoading] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [error, setError] = useState("")

  const buildParams = (base: string) => {
    const params = new URLSearchParams()
    params.set("empresaId", empresaId!)
    if (filtros.search) params.set("search", filtros.search)
    if (filtros.tipo) params.set("tipo", filtros.tipo)
    if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio)
    if (filtros.dataFim) params.set("dataFim", filtros.dataFim)
    return `${base}?${params.toString()}`
  }

  const fetchDados = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError("")
    try {
      // Se período definido, usar endpoint do motor; caso contrário, caminho legado
      if (filtros.dataInicio && filtros.dataFim) {
        const params = new URLSearchParams()
        params.set("empresaId", empresaId!)
        params.set("dataInicio", filtros.dataInicio)
        params.set("dataFim", filtros.dataFim)
        if (filtros.tipo) params.set("tipo", filtros.tipo)
        if (filtros.status) params.set("status", filtros.status)
        if (filtros.search) params.set("search", filtros.search)
        params.set("page", String(pagination.page))
        params.set("limit", String(pagination.limit))

        const res = await fetch(`/api/conciliacoes/comparativo?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao buscar comparativo")
        const linhasApi: LinhaComparativa[] = data.linhas || []
        setLinhas(linhasApi)
        if (data.pagination) {
          setPagination(data.pagination)
        } else {
          setPagination({ page: 1, limit: 50, total: linhasApi.length, totalPages: Math.ceil(linhasApi.length / 50) })
        }
      } else {
        const [erpRes, extRes] = await Promise.all([
          fetch(buildParams("/api/erp/lancamentos")),
          fetch(buildParams("/api/importacoes/lancamentos")),
        ])

        const erpData = await erpRes.json()
        const extData = await extRes.json()

        if (!erpRes.ok) throw new Error(erpData.error || "Erro ao buscar ERP")
        if (!extRes.ok) throw new Error(extData.error || "Erro ao buscar extrato")

        const erps: ErpLancamento[] = erpData.lancamentos || []
        const exts: ExtratoLancamento[] = extData.lancamentos || []

        setErpLancamentos(erps)
        setExtratoLancamentos(exts)

        const mapaData = new Map<string, { erps: ErpLancamento[]; exts: ExtratoLancamento[] }>()
        for (const e of erps) {
          const dataKey = e.data.split("T")[0]
          if (!mapaData.has(dataKey)) mapaData.set(dataKey, { erps: [], exts: [] })
          mapaData.get(dataKey)!.erps.push(e)
        }
        for (const e of exts) {
          const dataKey = e.data.split("T")[0]
          if (!mapaData.has(dataKey)) mapaData.set(dataKey, { erps: [], exts: [] })
          mapaData.get(dataKey)!.exts.push(e)
        }
        const resultado: LinhaComparativa[] = []
        const datasOrdenadas = Array.from(mapaData.keys()).sort()
        for (const data of datasOrdenadas) {
          const { erps, exts } = mapaData.get(data)!
          const maxLen = Math.max(erps.length, exts.length)
          for (let i = 0; i < maxLen; i++) {
            const erpItem = erps[i] || null
            const extItem = exts[i] || null
            let status: LinhaComparativa["status"] = "match"
            if (!erpItem) status = "sobra_extrato"
            else if (!extItem) status = "sobra_erp"
            else if (Math.abs(erpItem.valor - extItem.valor) > 0.01 || erpItem.tipo !== extItem.tipo) status = "divergente"
            resultado.push({ data, erp: erpItem, extrato: extItem, status })
          }
        }
        const filtrado = filtros.status ? resultado.filter((l) => l.status === filtros.status) : resultado
        setLinhas(filtrado)
        setPagination({ page: 1, limit: 50, total: filtrado.length, totalPages: Math.ceil(filtrado.length / 50) })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [empresaId, filtros, pagination.page, pagination.limit])

  useEffect(() => {
    if (empresaId) fetchDados()
  }, [empresaId, filtros.search, filtros.tipo, filtros.dataInicio, filtros.dataFim, filtros.status, pagination.page, pagination.limit, fetchDados])

  const onPageChange = useCallback(
    (page: number) => {
      setPagination((prev) => ({ ...prev, page }))
    },
    []
  )

  const onSalvarErp = useCallback(
    async (id: string, dados: Partial<ErpLancamento>) => {
      const res = await fetch(`/api/erp/lancamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar ERP")
      setErpLancamentos((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...data.lancamento } : l))
      )
    },
    []
  )

  const onSalvarExtrato = useCallback(
    async (id: string, dados: Partial<ExtratoLancamento>) => {
      const res = await fetch(`/api/importacoes/lancamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar extrato")
      setExtratoLancamentos((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...data.lancamento } : l))
      )
    },
    []
  )

  const onDeletarErp = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/erp/lancamentos/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao deletar ERP")
      setErpLancamentos((prev) => prev.filter((l) => l.id !== id))
    },
    []
  )

  const onDeletarExtrato = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/importacoes/lancamentos/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao deletar extrato")
      setExtratoLancamentos((prev) => prev.filter((l) => l.id !== id))
    },
    []
  )

  const onAceitarDivergentes = useCallback(async (ids: string[]) => {
    if (!empresaId) return
    const idSet = new Set(ids)
    const selecionados = linhas.filter(l => l.status === "divergente" && idSet.has(l.erp?.id || l.extrato?.id || ""))
    if (selecionados.length === 0) return

    try {
      const itens = selecionados.map(l => ({
        erpId: l.erp?.id,
        extratoId: l.extrato?.id,
        extratoImportadoId: (l.extrato as any)?.importacao ? l.extrato?.id : undefined,
      }))

      const res = await fetch("/api/conciliacoes/aceitar-divergentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, itens }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao aceitar divergências")

      setLinhas(prev => prev.map(l => {
        if (l.status !== "divergente") return l
        const lineId = l.erp?.id || l.extrato?.id || ""
        if (idSet.has(lineId)) return { ...l, status: "match" as const }
        return l
      }))
    } catch (err: any) {
      setError(err.message || "Erro ao aceitar divergências")
      throw err
    }
  }, [empresaId, linhas])

  const onAplicarFiltros = useCallback(() => {
    fetchDados()
  }, [fetchDados])

  return {
    erpLancamentos,
    extratoLancamentos,
    linhas,
    allLinhas: linhas,
    pagination,
    filtros,
    setFiltros,
    loading,
    modoEdicao,
    setModoEdicao,
    error,
    onPageChange,
    onSalvarErp,
    onSalvarExtrato,
    onDeletarErp,
    onDeletarExtrato,
    onAplicarFiltros,
    fetchDados,
    onAceitarDivergentes,
  }
}
