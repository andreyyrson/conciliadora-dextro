"use client"

import React from "react"
import { CheckCircle, Check, X as XIcon, Loader2, Square, CheckSquare, Pencil } from "lucide-react"
import { formatarValor, type MatchDia } from "./types"
import { Button } from "@/components/ui/button"

interface LancamentoStatus {
  status: string
  updatedAt: string
  userId: string
}

interface MatchesDetalheProps {
  matches: MatchDia
  diaData?: string // yyyy-mm-dd
  empresaId?: string
  lancamentosAprovados?: Record<string, LancamentoStatus>
  banco?: string
  onAfterAction?: () => void
}

export function MatchesDetalhe({ matches, diaData, empresaId, lancamentosAprovados, banco, onAfterAction }: MatchesDetalheProps) {
  if (!matches || matches.detalhes.length === 0) return null
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [loadingBatch, setLoadingBatch] = React.useState<'aprovar' | 'reprovar' | null>(null)
  const [editandoId, setEditandoId] = React.useState<string | null>(null)
  const [localStatus, setLocalStatus] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    if (lancamentosAprovados) {
      for (const [extratoId, info] of Object.entries(lancamentosAprovados)) {
        map[extratoId] = info.status
      }
    }
    return map
  })
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  React.useEffect(() => {
    const map: Record<string, string> = {}
    if (lancamentosAprovados) {
      for (const [extratoId, info] of Object.entries(lancamentosAprovados)) {
        map[extratoId] = info.status
      }
    }
    setLocalStatus(map)
  }, [lancamentosAprovados])

  async function completarCampoERP(
    erpId: string,
    campo: "descricao" | "valor" | "data",
    valorExtrato: string | number,
    valorErpAtual: string | number | null | undefined
  ) {
    // Regra: completar apenas se vazio; se houver valor, pedir confirmação para sobrescrever
    const isVazio = campo === "descricao"
      ? !valorErpAtual || String(valorErpAtual).trim() === ""
      : valorErpAtual === null || valorErpAtual === undefined

    if (!isVazio) {
      const confirma = window.confirm(
        `O campo ${campo} do ERP já possui um valor. Deseja sobrescrever com o valor do extrato?`
      )
      if (!confirma) return
    }

    const payload: any = {}
    if (campo === "data") {
      // valorExtrato deve ser yyyy-mm-dd
      payload.data = valorExtrato
    } else {
      payload[campo] = valorExtrato
    }

    const res = await fetch(`/api/erp/lancamentos/${erpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Falha ao completar ${campo}`)
    }
    setToast({ type: 'success', message: `${campo === 'data' ? 'Data' : campo === 'valor' ? 'Valor' : 'Descrição'} completado(a)` })
    onAfterAction?.()
  }

  async function aprovarReprovarLancamento(extratoId: string, tipo: 'aprovar' | 'reprovar') {
    if (!empresaId || !diaData) return
    setLoadingId(extratoId)
    try {
      const res = await fetch(`/api/conciliacoes/${tipo}-lancamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, dataDia: diaData, extratoId, banco })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha na ação')
      setLocalStatus(prev => ({ ...prev, [extratoId]: tipo === 'aprovar' ? 'APROVADO' : 'REPROVADO' }))
      setEditandoId(null)
      setToast({ type: 'success', message: tipo === 'aprovar' ? 'Lançamento aprovado' : 'Lançamento reprovado' })
      onAfterAction?.()
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Falha na ação' })
    } finally {
      setLoadingId(null)
    }
  }

  function toggleSelecionado(extratoId: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(extratoId)) next.delete(extratoId)
      else next.add(extratoId)
      return next
    })
  }

  function selecionarTodos() {
    const ids = matches.detalhes.map(m => m.extratoId)
    setSelecionados(new Set(ids))
  }

  function limparSelecao() {
    setSelecionados(new Set())
  }

  async function executarBatch(tipo: 'aprovar' | 'reprovar') {
    if (!empresaId || !diaData || selecionados.size === 0) return
    setLoadingBatch(tipo)
    let sucessos = 0
    let erros = 0
    const ids = Array.from(selecionados)
    await Promise.all(ids.map(async (extratoId) => {
      try {
        const res = await fetch(`/api/conciliacoes/${tipo}-lancamento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresaId, dataDia: diaData, extratoId, banco })
        })
        if (res.ok) {
          sucessos++
          setLocalStatus(prev => ({ ...prev, [extratoId]: tipo === 'aprovar' ? 'APROVADO' : 'REPROVADO' }))
        } else {
          erros++
        }
      } catch {
        erros++
      }
    }))
    setLoadingBatch(null)
    setSelecionados(new Set())
    const msg = tipo === 'aprovar'
      ? `${sucessos} aprovado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}`
      : `${sucessos} reprovado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}`
    setToast({ type: erros === 0 ? 'success' : 'error', message: msg })
    onAfterAction?.()
  }

  async function aprovarTodos() {
    if (!empresaId || !diaData) return
    const pendentes = matches.detalhes.filter(m => m.status === 'A_REVISAR' && localStatus[m.extratoId] !== 'APROVADO')
    if (pendentes.length === 0) {
      setToast({ type: 'success', message: 'Nenhum lançamento à revisar para aprovar' })
      return
    }
    setLoadingId('__all__')
    let sucessos = 0
    let erros = 0
    await Promise.all(pendentes.map(async (m) => {
      try {
        const res = await fetch(`/api/conciliacoes/aprovar-lancamento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresaId, dataDia: diaData, extratoId: m.extratoId, banco })
        })
        if (res.ok) {
          sucessos++
          setLocalStatus(prev => ({ ...prev, [m.extratoId]: 'APROVADO' }))
        } else {
          erros++
        }
      } catch {
        erros++
      }
    }))
    setLoadingId(null)
    if (erros === 0) {
      setToast({ type: 'success', message: `${sucessos} lançamento(s) aprovado(s)` })
    } else {
      setToast({ type: 'error', message: `${sucessos} aprovado(s), ${erros} erro(s)` })
    }
    onAfterAction?.()
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Matching ({matches.conciliados} conciliados, {matches.aRevisar} a revisar, {matches.naoConciliados} não conciliados)
        </h4>
      </div>
      {toast && (
        <div className={`mb-2 text-xs px-2 py-1 rounded inline-block ${toast.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
          {toast.message}
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <button
          className="text-xs text-muted-foreground hover:text-foreground underline"
          onClick={selecionarTodos}
        >
          Selecionar todos
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground underline"
          onClick={limparSelecao}
        >
          Limpar seleção
        </button>
      </div>
      <div className="space-y-2">
        {matches.detalhes.map((m) => {
          const statusBg = m.status === "CONCILIADO" ? "bg-green-500/10" : m.status === "A_REVISAR" ? "bg-yellow-500/10" : "bg-gray-500/10"

          return (
            <div key={m.extratoId} className={`p-3 rounded text-sm ${statusBg}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSelecionado(m.extratoId)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={selecionados.has(m.extratoId) ? 'Desselecionar' : 'Selecionar'}
                    >
                      {selecionados.has(m.extratoId) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                    <div className="font-medium">
                      Extrato: {m.extratoDescricao} — R$ {formatarValor(m.extratoValor)}
                    </div>
                    {m.banco && (
                      <span className="text-xs text-muted-foreground">({m.banco})</span>
                    )}
                  </div>
                  {m.erpPareado && (
                    <div className="text-muted-foreground mt-1">
                      ERP: {m.erpPareado.descricao} — R$ {formatarValor(m.erpPareado.valor)}
                      {m.erpPareado.banco && (
                        <span className="text-xs text-muted-foreground ml-1">({m.erpPareado.banco})</span>
                      )}
                    </div>
                  )}
                  {m.diferencaValor !== undefined && m.diferencaValor > 0.01 && (
                    <div className="text-xs text-red-500 mt-1">
                      Diferença: R$ {formatarValor(m.diferencaValor)}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4 min-w-[220px]">
                  {localStatus[m.extratoId] && (
                    <div className={`text-xs font-medium mb-1 px-2 py-0.5 rounded inline-block ${
                      localStatus[m.extratoId] === 'APROVADO' ? 'bg-green-500/10 text-green-600' :
                      localStatus[m.extratoId] === 'REPROVADO' ? 'bg-red-500/10 text-red-600' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {localStatus[m.extratoId]}
                    </div>
                  )}
                  <div className="flex gap-1 mb-1">
                    {editandoId === m.extratoId || !localStatus[m.extratoId] ? (
                      <>
                        <Button
                          size="sm"
                          variant={localStatus[m.extratoId] === 'APROVADO' ? 'default' : 'outline'}
                          className="h-6 text-[10px] px-2"
                          disabled={loadingId === m.extratoId}
                          onClick={() => aprovarReprovarLancamento(m.extratoId, 'aprovar')}
                        >
                          {loadingId === m.extratoId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant={localStatus[m.extratoId] === 'REPROVADO' ? 'destructive' : 'outline'}
                          className="h-6 text-[10px] px-2"
                          disabled={loadingId === m.extratoId}
                          onClick={() => aprovarReprovarLancamento(m.extratoId, 'reprovar')}
                        >
                          {loadingId === m.extratoId ? <Loader2 className="w-3 h-3 animate-spin" /> : <XIcon className="w-3 h-3" />}
                          Reprovar
                        </Button>
                        {editandoId === m.extratoId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setEditandoId(null)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setEditandoId(m.extratoId)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                  {m.erpPareado && (
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "descricao",
                              m.extratoDescricao,
                              m.erpPareado!.descricao
                            )
                            setToast({ type: 'success', message: 'Descrição completada' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar descrição' })
                          }
                        }}
                      >
                        Completar Descrição
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "valor",
                              m.extratoValor,
                              m.erpPareado!.valor
                            )
                            setToast({ type: 'success', message: 'Valor completado' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar valor' })
                          }
                        }}
                      >
                        Completar Valor
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const dataParaAplicar = diaData || new Date().toISOString().split("T")[0]
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "data",
                              dataParaAplicar,
                              undefined
                            )
                            setToast({ type: 'success', message: 'Data completada' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar data' })
                          }
                        }}
                      >
                        Completar Data
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {matches.erpsSobrando > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {matches.erpsSobrando} lançamento(s) ERP sem correspondência no extrato
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          {selecionados.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selecionados.size} selecionado(s)</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={loadingBatch !== null}
                onClick={() => executarBatch('aprovar')}
              >
                {loadingBatch === 'aprovar' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={loadingBatch !== null}
                onClick={() => executarBatch('reprovar')}
              >
                {loadingBatch === 'reprovar' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <XIcon className="w-3 h-3 mr-1" />}
                Reprovar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={limparSelecao}>
                Limpar
              </Button>
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={loadingId === '__all__'}
          onClick={aprovarTodos}
        >
          {loadingId === '__all__' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
          Aprovar Todos
        </Button>
      </div>
    </div>
  )
}
