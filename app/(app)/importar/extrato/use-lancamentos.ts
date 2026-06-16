"use client"

import { useState, useCallback, useEffect } from "react"
import type { FiltrosLancamentos } from "./filtros-lancamentos"
import type { LancamentoImportado } from "./tabela-lancamentos"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UseLancamentosOptions {
  empresaId: string | null | undefined
  importacaoId?: string
}

export function useLancamentos({ empresaId, importacaoId }: UseLancamentosOptions) {
  const [lancamentos, setLancamentos] = useState<LancamentoImportado[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [filtros, setFiltros] = useState<FiltrosLancamentos>({
    search: "",
    tipo: "",
    dataInicio: "",
    dataFim: "",
  })
  const [loading, setLoading] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [error, setError] = useState("")

  const fetchLancamentos = useCallback(
    async (page = 1) => {
      if (!empresaId) return
      setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams()
        params.set("empresaId", empresaId)
        params.set("page", String(page))
        params.set("limit", String(pagination.limit))
        if (importacaoId) params.set("importacaoId", importacaoId)
        if (filtros.search) params.set("search", filtros.search)
        if (filtros.tipo) params.set("tipo", filtros.tipo)
        if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio)
        if (filtros.dataFim) params.set("dataFim", filtros.dataFim)

        const res = await fetch(`/api/importacoes/lancamentos?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao buscar lançamentos")

        setLancamentos(data.lancamentos)
        setPagination(data.pagination)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [empresaId, importacaoId, filtros, pagination.limit]
  )

  useEffect(() => {
    if (empresaId) fetchLancamentos(1)
  }, [empresaId, importacaoId, filtros, fetchLancamentos])

  const onPageChange = useCallback(
    (page: number) => {
      fetchLancamentos(page)
    },
    [fetchLancamentos]
  )

  const onSalvar = useCallback(
    async (id: string, dados: Partial<LancamentoImportado>) => {
      const res = await fetch(`/api/importacoes/lancamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar")

      setLancamentos((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...data.lancamento } : l))
      )
    },
    []
  )

  const onDeletar = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/importacoes/lancamentos/${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao deletar")

      setLancamentos((prev) => prev.filter((l) => l.id !== id))
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }))
    },
    []
  )

  const onAplicarFiltros = useCallback(() => {
    fetchLancamentos(1)
  }, [fetchLancamentos])

  return {
    lancamentos,
    pagination,
    filtros,
    setFiltros,
    loading,
    modoEdicao,
    setModoEdicao,
    error,
    onPageChange,
    onSalvar,
    onDeletar,
    onAplicarFiltros,
    fetchLancamentos,
  }
}
