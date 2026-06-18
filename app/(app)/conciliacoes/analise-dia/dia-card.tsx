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
  ArrowUp
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
}

function TabelaComparativaDia({ dia, completando, setCompletando, completarCampoERP, showToast }: TabelaComparativaDiaProps) {
  const { detalhes, erpsSobrandoDetalhes } = dia.matches
  const totalLinhas = detalhes.length + erpsSobrandoDetalhes.length
  if (totalLinhas === 0) return null

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
              <th className="p-2 text-left border-r border-border w-[30%]">ERP — Descrição</th>
              <th className="p-2 text-right border-r border-border w-[90px]">Valor</th>
              <th className="p-2 text-left border-r border-border w-[30%]">Extrato — Descrição</th>
              <th className="p-2 text-right border-r border-border w-[90px]">Valor</th>
              <th className="p-2 text-center w-[100px]">Status</th>
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
                <td className={`p-2 border-r border-border text-right font-medium tabular-nums ${m.erpPareado ? (m.erpPareado.valor < 0 ? "text-red-500" : "text-foreground") : ""}`}>
                  {m.erpPareado ? `R$ ${formatarValor(m.erpPareado.valor)}` : "—"}
                </td>
                <td className="p-2 border-r border-border">
                  <span className="text-foreground">{m.extratoDescricao}</span>
                </td>
                <td className={`p-2 border-r border-border text-right font-medium tabular-nums ${m.extratoValor < 0 ? "text-red-500" : "text-foreground"}`}>
                  R$ {formatarValor(m.extratoValor)}
                </td>
                <td className="p-2 text-center">
                  {statusBadge(m.status)}
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
                <td className="p-2 border-r border-border">
                  <span className="text-foreground">{e.descricao}</span>
                </td>
                <td className={`p-2 border-r border-border text-right font-medium tabular-nums ${e.tipo === "DEBITO" ? "text-red-500" : "text-green-500"}`}>
                  R$ {formatarValor(e.valor)}
                </td>
                <td className="p-2 border-r border-border">
                  <span className="text-xs italic text-muted-foreground">—</span>
                </td>
                <td className="p-2 border-r border-border text-right text-muted-foreground">—</td>
                <td className="p-2 text-center">{statusBadge("NAO_CONCILIADO")}</td>
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
}

export function DiaCard({ dia, expandido, onToggle, onAfterAction }: DiaCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)
  const status = statusConfig[dia.statusDia]
  const StatusIcon = status.icon
  const { empresaId } = useEmpresa()
  const [acaoLoading, setAcaoLoading] = React.useState<null | 'aprovar' | 'reprovar'>(null)
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [justificativa, setJustificativa] = React.useState("")
  const [confirmando, setConfirmando] = React.useState<null | 'aprovar' | 'reprovar'>(null)
  const [aprovStatus, setAprovStatus] = React.useState<string | null>(null)
  const [lancamentosAprovados, setLancamentosAprovados] = React.useState<Record<string, { status: string; updatedAt: string; userId: string }>>({})
  const [completando, setCompletando] = React.useState<null | { id: string; campo: string }>(null)

  React.useEffect(() => {
    let ignore = false
    async function load() {
      if (!empresaId) return
      const url = `/api/conciliacoes/aprovacoes?empresaId=${encodeURIComponent(empresaId)}&dataInicio=${dia.data}&dataFim=${dia.data}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!ignore) {
        setAprovStatus(data.aprovacoes?.[dia.data]?.status || 'AGUARDANDO')
        setLancamentosAprovados(data.lancamentos?.[dia.data] || {})
      }
    }
    load()
    return () => { ignore = true }
  }, [empresaId, dia.data])

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

  async function aprovarReprovar(tipo: 'aprovar' | 'reprovar') {
    try {
      setAcaoLoading(tipo)
      const res = await fetch(`/api/conciliacoes/${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, dataDia: dia.data, justificativa: justificativa || undefined })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha na ação')
      showToast('success', tipo === 'aprovar' ? 'Dia aprovado' : 'Dia reprovado')
      setAprovStatus(tipo === 'aprovar' ? 'APROVADO' : 'REPROVADO')
      setConfirmando(null)
      setJustificativa("")
      onAfterAction?.()
    } catch (e: any) {
      showToast('error', e.message || 'Falha na ação')
    } finally {
      setAcaoLoading(null)
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
                  <span className={`px-2 py-0.5 rounded ${aprovStatus === 'APROVADO' ? 'bg-green-500/10 text-green-600' : aprovStatus === 'REPROVADO' ? 'bg-red-500/10 text-red-600' : 'bg-gray-500/10 text-gray-500'}`}>
                    {aprovStatus}
                  </span>
                </div>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-500">Ent: R$ {formatarValor(dia.totalCreditoExtrato || dia.totalCreditoErp)}</span>
                <span className="text-red-500">Sai: R$ {formatarValor(dia.totalDebitoExtrato || dia.totalDebitoErp)}</span>
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
              <div className="px-4 pb-16 space-y-4 relative">
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded ${status.bg}`}>
                    <div className="text-xs font-medium text-muted-foreground mb-1">ERP</div>
                    <div className="flex justify-between text-sm">
                      <span>Débito:</span>
                      <span className="font-medium text-red-500">R$ {formatarValor(dia.totalDebitoErp)}</span>
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
                      <span className="font-medium text-red-500">R$ {formatarValor(dia.totalDebitoExtrato)}</span>
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
                />

                <MatchesDetalhe
                  matches={dia.matches}
                  diaData={dia.data}
                  empresaId={empresaId || undefined}
                  lancamentosAprovados={lancamentosAprovados}
                  onAfterAction={onAfterAction}
                />

                {/* Botão flutuante voltar ao topo */}
                <button
                  className="absolute bottom-4 right-4 z-10 bg-primary text-primary-foreground rounded-full p-2.5 shadow-md hover:bg-primary/90 transition-colors"
                  onClick={() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  title="Voltar ao topo"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmando('aprovar')} disabled={acaoLoading !== null}>
                      {acaoLoading === 'aprovar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Aprovar Dia
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirmando('reprovar')} disabled={acaoLoading !== null}>
                      {acaoLoading === 'reprovar' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XIcon className="w-4 h-4 mr-1" />}
                      Reprovar Dia
                    </Button>
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
            <h4 className="font-semibold mb-2">{confirmando === 'aprovar' ? 'Aprovar dia' : 'Reprovar dia'}</h4>
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
              <Button size="sm" onClick={() => aprovarReprovar(confirmando)} disabled={acaoLoading !== null}>
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
