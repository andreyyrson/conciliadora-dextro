"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  Check,
  X as XIcon,
  Loader2,
  ArrowUp,
  Eye,
  Download,
  Pencil
} from "lucide-react"
import { formatarData, formatarValor, type DiaAnalise, type StatusDia } from "./types"
import { MatchesDetalhe } from "./matches-detalhe"
import { useEmpresa } from "@/lib/use-empresa"

export const statusConfig: Record<StatusDia, {
  label: string
  icon: typeof CheckCircle
  color: string
  bg: string
  border: string
}> = {
  CONCILIADO: { label: "Conciliado", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", border: "border-l-green-500" },
  A_REVISAR: { label: "A revisar", icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-l-yellow-500" },
  NAO_CONCILIADO: { label: "Não conciliado", icon: MinusCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-l-red-500" },
  SEM_DADOS: { label: "Sem Dados", icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-l-gray-400" }
}

function inferirTipo(valor: number, tipo?: string): string | undefined {
  if (tipo) return tipo
  return valor < 0 ? "DEBITO" : "CREDITO"
}

function formatarValorComSinal(valor: number, tipo?: string): string {
  const negativo = tipo === "DEBITO" || valor < 0
  const abs = Math.abs(valor)
  return `${negativo ? "-" : ""}R$ ${formatarValor(abs)}`
}

interface TabelaComparativaDiaProps {
  dia: DiaAnalise
  completando: null | { id: string; campo: string }
  setCompletando: (v: null | { id: string; campo: string }) => void
  completarCampoERP: (
    erpId: string,
    campo: "descricao" | "valor" | "data",
    valorExtrato: string | number,
    valorErpAtual?: string | number | null
  ) => Promise<void>
  showToast: (type: 'success' | 'error', message: string) => void
  lancamentosAprovados?: Record<string, { status: string; updatedAt: string; userId: string }>
  empresaId?: string
  diaData?: string
  banco?: string
  onAfterAction?: () => void
}

function TabelaComparativaDia({ dia, completando, setCompletando, completarCampoERP, showToast, lancamentosAprovados, empresaId, diaData, banco, onAfterAction }: TabelaComparativaDiaProps) {
  const { detalhes, erpsSobrandoDetalhes } = dia.matches
  const totalLinhas = detalhes.length + erpsSobrandoDetalhes.length
  if (totalLinhas === 0) return null

  const [loadingId, setLoadingId] = React.useState<string | null>(null)
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

  React.useEffect(() => {
    const map: Record<string, string> = {}
    if (lancamentosAprovados) {
      for (const [extratoId, info] of Object.entries(lancamentosAprovados)) {
        map[extratoId] = info.status
      }
    }
    setLocalStatus(map)
  }, [lancamentosAprovados])

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
      showToast('success', tipo === 'aprovar' ? 'Lançamento aprovado' : 'Lançamento reprovado')
      onAfterAction?.()
    } catch (e: any) {
      showToast('error', e.message || 'Falha na ação')
    } finally {
      setLoadingId(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      CONCILIADO: { label: "Conciliado", color: "text-green-500" },
      A_REVISAR: { label: "A revisar", color: "text-yellow-500" },
      NAO_CONCILIADO: { label: "Não conciliado", color: "text-red-500" },
    }
    const s = map[status] || { label: status, color: "text-muted-foreground" }
    return <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Lançamentos — ERP vs Extrato</h4>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left border-r border-border w-[25%]">ERP — Descrição</th>
              <th className="p-2 text-left border-r border-border w-[80px]">Banco</th>
              <th className="p-2 text-right border-r border-border w-[80px]">Valor</th>
              <th className="p-2 text-left border-r border-border w-[25%]">Extrato — Descrição</th>
              <th className="p-2 text-left border-r border-border w-[80px]">Banco</th>
              <th className="p-2 text-right border-r border-border w-[80px]">Valor</th>
              <th className="p-2 text-center w-[80px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {detalhes.map((m) => (
              <tr key={m.extratoId} className="border-b border-border">
                <td className="p-2 border-r border-border">
                  {m.erpPareado ? (
                    <span className="text-foreground">{m.erpPareado.descricao}</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2 border-r border-border text-xs text-muted-foreground">
                  {m.erpPareado?.banco || "—"}
                </td>
                <td className={`p-2 border-r border-border text-right font-medium tabular-nums ${m.erpPareado ? ((inferirTipo(m.erpPareado.valor, m.erpPareado.tipo) === "DEBITO") ? "text-red-500" : "text-foreground") : ""}`}>
                  {m.erpPareado ? formatarValorComSinal(m.erpPareado.valor, inferirTipo(m.erpPareado.valor, m.erpPareado.tipo)) : "—"}
                </td>
                <td className="p-2 border-r border-border">
                  <span className="text-foreground">{m.extratoDescricao}</span>
                </td>
                <td className="p-2 border-r border-border text-xs text-muted-foreground">
                  {m.banco || "—"}
                </td>
                <td className={`p-2 border-r border-border text-right font-medium tabular-nums ${(inferirTipo(m.extratoValor, m.tipo) === "DEBITO") ? "text-red-500" : "text-foreground"}`}>
                  {formatarValorComSinal(m.extratoValor, inferirTipo(m.extratoValor, m.tipo))}
                </td>
                <td className="p-2 text-center">
                  {statusBadge(m.status)}
                  {localStatus[m.extratoId] && (
                    <div className={`text-xs font-medium mb-1 px-2 py-0.5 rounded inline-block ${
                      localStatus[m.extratoId] === 'APROVADO' ? 'bg-green-500/10 text-green-600' :
                      localStatus[m.extratoId] === 'REPROVADO' ? 'bg-red-500/10 text-red-600' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {localStatus[m.extratoId]}
                    </div>
                  )}
                  {!m.erpPareado && (
                    <div className="flex gap-1 mt-1">
                      {editandoId === m.extratoId || !localStatus[m.extratoId] ? (
                        <>
                          <Button
                            size="sm"
                            variant={localStatus[m.extratoId] === 'APROVADO' ? 'default' : 'outline'}
                            className="h-5 text-[9px] px-1"
                            disabled={loadingId === m.extratoId}
                            onClick={() => aprovarReprovarLancamento(m.extratoId, 'aprovar')}
                          >
                            {loadingId === m.extratoId ? <Loader2 className="w-2 h-2 animate-spin" /> : <Check className="w-2 h-2" />}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant={localStatus[m.extratoId] === 'REPROVADO' ? 'destructive' : 'outline'}
                            className="h-5 text-[9px] px-1"
                            disabled={loadingId === m.extratoId}
                            onClick={() => aprovarReprovarLancamento(m.extratoId, 'reprovar')}
                          >
                            {loadingId === m.extratoId ? <Loader2 className="w-2 h-2 animate-spin" /> : <XIcon className="w-2 h-2" />}
                            Reprovar
                          </Button>
                          {editandoId === m.extratoId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 text-[9px] px-1"
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
                          className="h-5 text-[9px] px-1"
                          onClick={() => setEditandoId(m.extratoId)}
                        >
                          <Pencil className="w-2 h-2 mr-1" />
                          Editar
                        </Button>
                      )}
                    </div>
                  )}
                  {m.erpPareado && (() => {
                    const erp = m.erpPareado
                    if (!erp) return null
                    return (
                      <div className="mt-2 grid grid-cols-1 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-1"
                          disabled={completando?.id === erp.id && completando?.campo === "descricao"}
                          onClick={async () => {
                            try {
                              setCompletando({ id: erp.id, campo: "descricao" })
                              await completarCampoERP(erp.id, "descricao", m.extratoDescricao, erp.descricao)
                            } catch (e: any) {
                              showToast('error', e.message || 'Falha ao completar descrição')
                            } finally {
                              setCompletando(null)
                            }
                          }}
                        >
                          {completando?.id === erp.id && completando?.campo === "descricao" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Completar Descrição"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-1"
                          disabled={completando?.id === erp.id && completando?.campo === "valor"}
                          onClick={async () => {
                            try {
                              setCompletando({ id: erp.id, campo: "valor" })
                              await completarCampoERP(erp.id, "valor", m.extratoValor, erp.valor)
                            } catch (e: any) {
                              showToast('error', e.message || 'Falha ao completar valor')
                            } finally {
                              setCompletando(null)
                            }
                          }}
                        >
                          {completando?.id === erp.id && completando?.campo === "valor" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Completar Valor"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-1"
                          disabled={completando?.id === erp.id && completando?.campo === "data"}
                          onClick={async () => {
                            try {
                              setCompletando({ id: erp.id, campo: "data" })
                              await completarCampoERP(erp.id, "data", dia.data, undefined)
                            } catch (e: any) {
                              showToast('error', e.message || 'Falha ao completar data')
                            } finally {
                              setCompletando(null)
                            }
                          }}
                        >
                          {completando?.id === erp.id && completando?.campo === "data" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Completar Data"}
                        </Button>
                      </div>
                    )
                  })()}
                </td>
              </tr>
            ))}
            {erpsSobrandoDetalhes.map((e) => (
              <tr key={e.id} className="border-b border-border bg-red-500/5">
                <td className="p-2 border-r border-border w-[25%]">
                  <span className="text-foreground">{e.descricao}</span>
                </td>
                <td className="p-2 border-r border-border w-[80px] text-xs text-muted-foreground">
                  {e.banco || "—"}
                </td>
                <td className={`p-2 border-r border-border w-[80px] text-right font-medium tabular-nums ${inferirTipo(e.valor, e.tipo) === "DEBITO" ? "text-red-500" : "text-green-500"}`}>
                  {formatarValorComSinal(e.valor, inferirTipo(e.valor, e.tipo))}
                </td>
                <td className="p-2 border-r border-border w-[25%]">
                  <span className="text-xs italic text-muted-foreground">—</span>
                </td>
                <td className="p-2 border-r border-border w-[80px] text-xs text-muted-foreground">—</td>
                <td className="p-2 border-r border-border w-[80px] text-right text-muted-foreground">—</td>
                <td className="p-2 text-center w-[80px]">{statusBadge("NAO_CONCILIADO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
        <span>{detalhes.filter(d => d.erpPareado).length} pareamento(s)</span>
        <span>{detalhes.filter(d => !d.erpPareado).length} extrato(s) sem ERP</span>
        <span>{erpsSobrandoDetalhes.length} ERP(s) sem extrato</span>
      </div>
    </div>
  )
}

interface DiaCardProps {
  dia: DiaAnalise
  expandido: boolean
  onToggle: () => void
  onAfterAction?: () => void
  banco?: string
  arquivo?: string
  tipo?: string
}

export function DiaCard({ dia, expandido, onToggle, onAfterAction, banco = "", arquivo = "", tipo = "TODAS" }: DiaCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)
  const status = statusConfig[dia.statusDia]
  const StatusIcon = status.icon
  const { empresaId } = useEmpresa()
  const [acaoLoading, setAcaoLoading] = React.useState<null | 'aprovar' | 'reprovar' | 'revisar'>(null)
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [justificativa, setJustificativa] = React.useState("")
  const [confirmando, setConfirmando] = React.useState<null | 'aprovar' | 'reprovar' | 'revisar'>(null)
  const [aprovStatus, setAprovStatus] = React.useState<string | null>(null)
  const [lancamentosAprovados, setLancamentosAprovados] = React.useState<Record<string, { status: string; updatedAt: string; userId: string }>>({})
  const [completando, setCompletando] = React.useState<null | { id: string; campo: string }>(null)
  const [exportandoDia, setExportandoDia] = React.useState(false)

  React.useEffect(() => {
    let ignore = false
    async function load() {
      if (!empresaId) return
      setAprovStatus(null) // resetar enquanto busca status do filtro atual
      const bancoParam = banco ? `&banco=${encodeURIComponent(banco)}` : ""
      const url = `/api/conciliacoes/aprovacoes?empresaId=${encodeURIComponent(empresaId)}&dataInicio=${dia.data}&dataFim=${dia.data}${bancoParam}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!ignore) {
        setAprovStatus(data.aprovacoes?.[dia.data]?.status || 'AGUARDANDO')
        setLancamentosAprovados(data.lancamentos?.[dia.data] || {})
      }
    }
    load()
    return () => { ignore = true }
  }, [empresaId, dia.data, banco])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2200)
  }

  async function completarCampoERP(
    erpId: string,
    campo: "descricao" | "valor" | "data",
    valorExtrato: string | number,
    valorErpAtual: string | number | null | undefined
  ) {
    const isVazio = campo === "descricao"
      ? !valorErpAtual || String(valorErpAtual).trim() === ""
      : valorErpAtual === null || valorErpAtual === undefined

    if (!isVazio) {
      const confirma = window.confirm(
        `O campo ${campo} do ERP já possui um valor. Deseja sobrescrever com o valor do extrato?`
      )
      if (!confirma) return
    }

    const payload: Record<string, unknown> = {}
    if (campo === "data") {
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
    showToast('success', `${campo === 'data' ? 'Data' : campo === 'valor' ? 'Valor' : 'Descrição'} completado(a)`)
    onAfterAction?.()
  }

  async function executarAcao(tipo: 'aprovar' | 'reprovar' | 'revisar') {
    try {
      setAcaoLoading(tipo)
      const endpoint = tipo === 'revisar' ? '/api/conciliacoes/revisar' : `/api/conciliacoes/${tipo}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, dataDia: dia.data, banco: banco || undefined, justificativa: justificativa || undefined })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha na ação')
      const msg = tipo === 'aprovar' ? 'Dia aprovado' : tipo === 'reprovar' ? 'Dia reprovado' : 'Dia marcado para revisão'
      const status = tipo === 'aprovar' ? 'APROVADO' : tipo === 'reprovar' ? 'REPROVADO' : 'A_REVISAR'
      showToast('success', msg)
      setAprovStatus(status)
      setConfirmando(null)
      setJustificativa("")
      onAfterAction?.()
    } catch (e: any) {
      showToast('error', e.message || 'Falha na ação')
    } finally {
      setAcaoLoading(null)
    }
  }

  async function downloadExcelDia() {
    if (!empresaId) return
    if (exportandoDia) return
    setExportandoDia(true)
    try {
      const bancoParam = banco ? `&banco=${encodeURIComponent(banco)}` : ""
      const arquivoParam = arquivo ? `&arquivo=${encodeURIComponent(arquivo)}` : ""
      const tipoParam = tipo && tipo !== "TODAS" ? `&tipo=${tipo}` : ""
      const res = await fetch(
        `/api/conciliacoes/analise-dia/exportar?empresaId=${encodeURIComponent(empresaId)}&dataInicio=${dia.data}&dataFim=${dia.data}${bancoParam}${arquivoParam}${tipoParam}`
      )
      if (!res.ok) throw new Error("Erro ao exportar dia")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `analise-dia-${dia.data}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao exportar dia')
    } finally {
      setExportandoDia(false)
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`border-l-4 ${status.border}`}>
        <button
          onClick={onToggle}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-4">
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
            <div>
              <div className="font-semibold text-foreground">{formatarData(dia.data)}</div>
              <div className="text-sm text-muted-foreground">
                {dia.qtdErp} ERP / {dia.qtdExtrato} Extrato
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-sm font-medium ${status.color}`}>{status.label}</div>
              {aprovStatus && (
                <div className="text-xs mt-0.5">
                  <span className={`px-2 py-0.5 rounded ${
                    aprovStatus === 'APROVADO' ? 'bg-green-500/10 text-green-600' :
                    aprovStatus === 'REPROVADO' ? 'bg-red-500/10 text-red-600' :
                    aprovStatus === 'A_REVISAR' ? 'bg-yellow-500/10 text-yellow-600' :
                    'bg-gray-500/10 text-gray-500'
                  }`}>
                    {aprovStatus === 'A_REVISAR' ? 'A REVISAR' : aprovStatus}
                  </span>
                </div>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-500">Ent: R$ {formatarValor(dia.totalCreditoExtrato || dia.totalCreditoErp)}</span>
                <span className="text-red-500">Sai: -R$ {formatarValor(dia.totalDebitoExtrato || dia.totalDebitoErp)}</span>
                <span>Saldo: R$ {formatarValor(dia.saldoFinalExtrato !== undefined ? dia.saldoFinalExtrato : dia.saldoFinalErp)}</span>
              </div>
              {dia.saldoAposBanco !== null && (
                <div className="text-xs text-muted-foreground">
                  Banco: R$ {formatarValor(dia.saldoAposBanco)}
                </div>
              )}
              {toast && (
                <div className={`mt-1 text-xs px-2 py-0.5 rounded inline-block ${toast.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  {toast.message}
                </div>
              )}
            </div>
            {expandido ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded ${status.bg}`}>
                    <div className="text-xs font-medium text-muted-foreground mb-1">ERP</div>
                    <div className="flex justify-between text-sm">
                      <span>Débito:</span>
                      <span className="font-medium text-red-500">-R$ {formatarValor(dia.totalDebitoErp)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Crédito:</span>
                      <span className="font-medium text-green-500">R$ {formatarValor(dia.totalCreditoErp)}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded ${status.bg}`}>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Extrato</div>
                    <div className="flex justify-between text-sm">
                      <span>Débito:</span>
                      <span className="font-medium text-red-500">-R$ {formatarValor(dia.totalDebitoExtrato)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Crédito:</span>
                      <span className="font-medium text-green-500">R$ {formatarValor(dia.totalCreditoExtrato)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumo de diferenças — no topo */}
                <div className={`p-3 rounded border border-border ${status.bg}`}>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Diferenças do Dia</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between text-sm">
                      <span>Despesas (Débito):</span>
                      <span className={`font-medium tabular-nums ${dia.diferencaDebito > 0.01 ? "text-red-500" : "text-green-500"}`}>
                        R$ {formatarValor(dia.diferencaDebito)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Receitas (Crédito):</span>
                      <span className={`font-medium tabular-nums ${dia.diferencaCredito > 0.01 ? "text-red-500" : "text-green-500"}`}>
                        R$ {formatarValor(dia.diferencaCredito)}
                      </span>
                    </div>
                  </div>
                </div>

                <TabelaComparativaDia
                  dia={dia}
                  completando={completando}
                  setCompletando={setCompletando}
                  completarCampoERP={completarCampoERP}
                  showToast={showToast}
                  lancamentosAprovados={lancamentosAprovados}
                  empresaId={empresaId || undefined}
                  diaData={dia.data}
                  banco={banco}
                  onAfterAction={onAfterAction}
                />

                <MatchesDetalhe
                  matches={dia.matches}
                  diaData={dia.data}
                  empresaId={empresaId || undefined}
                  lancamentosAprovados={lancamentosAprovados}
                  banco={banco}
                  onAfterAction={onAfterAction}
                />

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    <ArrowUp className="w-3 h-3 mr-1" />
                    Topo
                  </Button>
                  <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={downloadExcelDia} disabled={exportandoDia || acaoLoading !== null}>
                    {exportandoDia ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                    Exportar Dia
                  </Button>
                  {aprovStatus === 'APROVADO' || aprovStatus === 'REPROVADO' ? (
                    <Button size="sm" variant="secondary" onClick={() => setConfirmando('revisar')} disabled={acaoLoading !== null}>
                      {acaoLoading === 'revisar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Pencil className="w-4 h-4 mr-1" />}
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setConfirmando('aprovar')} disabled={acaoLoading !== null}>
                        {acaoLoading === 'aprovar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        Aprovar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmando('revisar')} disabled={acaoLoading !== null}>
                        {acaoLoading === 'revisar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                        Revisar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmando('reprovar')} disabled={acaoLoading !== null}>
                        {acaoLoading === 'reprovar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XIcon className="w-4 h-4 mr-1" />}
                        Reprovar
                      </Button>
                    </>
                  )}
                </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      {confirmando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-md p-4 w-full max-w-md">
            <h4 className="font-semibold mb-2">{confirmando === 'aprovar' ? 'Aprovar dia' : confirmando === 'revisar' ? 'Marcar dia para revisão' : 'Reprovar dia'}</h4>
            <p className="text-sm text-muted-foreground mb-2">Data: {new Date(dia.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <textarea
              className="w-full border border-border rounded p-2 text-sm bg-background text-foreground"
              placeholder="Justificativa (opcional)"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmando(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => executarAcao(confirmando)} disabled={acaoLoading !== null}>
                {acaoLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
