"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Building2,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  Check,
  X as XIcon,
  Loader2
} from "lucide-react"
import { MatchesDetalhe } from "./matches-detalhe"
import { formatarData, formatarValor, type DiaAnalise, type StatusDia } from "./types"
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

interface TransacoesTabelaProps {
  titulo: string
  icon: typeof Building2
  transacoes: { id: string; descricao: string; tipo: string; valor: number }[]
}

function TransacoesTabela({ titulo, icon: Icon, transacoes }: TransacoesTabelaProps) {
  if (transacoes.length === 0) return null
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {titulo} ({transacoes.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Descrição</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.map((t) => (
              <tr key={t.id} className="border-b border-border">
                <td className="p-2">{t.descricao}</td>
                <td className="p-2">{t.tipo}</td>
                <td className={`p-2 text-right font-medium ${t.tipo === "DEBITO" ? "text-red-500" : "text-green-500"}`}>
                  R$ {formatarValor(t.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const status = statusConfig[dia.statusDia]
  const StatusIcon = status.icon
  const { empresaId } = useEmpresa()
  const [acaoLoading, setAcaoLoading] = React.useState<null | 'aprovar' | 'reprovar'>(null)
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [justificativa, setJustificativa] = React.useState("")
  const [confirmando, setConfirmando] = React.useState<null | 'aprovar' | 'reprovar'>(null)
  const [aprovStatus, setAprovStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    let ignore = false
    async function load() {
      if (!empresaId) return
      const url = `/api/conciliacoes/aprovacoes?empresaId=${encodeURIComponent(empresaId)}&dataInicio=${dia.data}&dataFim=${dia.data}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (!ignore) setAprovStatus(data.aprovacoes?.[dia.data]?.status || 'AGUARDANDO')
    }
    load()
    return () => { ignore = true }
  }, [empresaId, dia.data])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2200)
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
              <div className="px-4 pb-4 space-y-4">
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

                <TransacoesTabela titulo="Lançamentos ERP" icon={Building2} transacoes={dia.transacoesErp} />
                <TransacoesTabela titulo="Extrato Bancário" icon={Calendar} transacoes={dia.transacoesExtrato} />

                <MatchesDetalhe matches={dia.matches} diaData={dia.data} onAfterAction={onAfterAction} />
                <div className="flex items-center justify-end gap-2">
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
