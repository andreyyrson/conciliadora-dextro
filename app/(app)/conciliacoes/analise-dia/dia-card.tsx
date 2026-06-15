"use client"

import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Building2,
  AlertCircle,
  CheckCircle,
  MinusCircle
} from "lucide-react"
import { MatchesDetalhe } from "./matches-detalhe"
import { formatarData, formatarValor, type DiaAnalise, type StatusDia } from "./types"

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
}

export function DiaCard({ dia, expandido, onToggle }: DiaCardProps) {
  const status = statusConfig[dia.statusDia]
  const StatusIcon = status.icon

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

                <MatchesDetalhe matches={dia.matches} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}
