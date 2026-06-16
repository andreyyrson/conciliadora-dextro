"use client"

import { useState, useCallback, useEffect } from "react"

export interface ErpLancamento {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
  documento: string | null
  fornecedor: string | null
  categoria: string | null
  centroCusto: string | null
  banco: string | null
  upload?: { nomeArquivo: string; periodo: string }
}

export interface ExtratoLancamento {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
  identificador: string | null
  banco: string | null
  saldoApos: number | null
  importacao?: { nomeArquivo: string; tipo: string }
}

export interface LinhaComparativa {
  data: string
  erp: ErpLancamento | null
  extrato: ExtratoLancamento | null
  status: "match" | "divergente" | "sobra_erp" | "sobra_extrato"
}

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

      // Agrupar por data aproximada (mesmo dia)
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

      // Montar linhas comparativas simples: para cada data, parear sequencialmente
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

      // Aplicar filtro de status
      const filtrado = filtros.status
        ? resultado.filter((l) => l.status === filtros.status)
        : resultado

      setLinhas(filtrado)
      setPagination({
        page: 1,
        limit: 50,
        total: filtrado.length,
        totalPages: Math.ceil(filtrado.length / 50),
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [empresaId, filtros])

  useEffect(() => {
    if (empresaId) fetchDados()
  }, [empresaId, filtros.search, filtros.tipo, filtros.dataInicio, filtros.dataFim, filtros.status, fetchDados])

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

  const onAplicarFiltros = useCallback(() => {
    fetchDados()
  }, [fetchDados])

  const paginatedLinhas = linhas.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  )

  return {
    erpLancamentos,
    extratoLancamentos,
    linhas: paginatedLinhas,
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
  }
}
