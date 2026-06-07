"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, ChevronDown, ChevronUp, Building2, AlertCircle, CheckCircle, MinusCircle } from "lucide-react"

interface TransacaoErp {
  id: string
  descricao: string
  valor: number
  tipo: string
  documento?: string | null
  fornecedor?: string | null
}

interface TransacaoExtrato {
  id: string
  descricao: string
  valor: number
  tipo: string
  identificador?: string | null
  banco?: string | null
}

interface DiaAnalise {
  data: string
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  saldoFinalExtrato: number | null
  transacoesErp: TransacaoErp[]
  transacoesExtrato: TransacaoExtrato[]
  statusDia: "CONCILIADO" | "DIVERGENTE" | "PARCIAL" | "SEM_DADOS"
  qtdErp: number
  qtdExtrato: number
}

const statusConfig = {
  CONCILIADO: { label: "Conciliado", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  DIVERGENTE: { label: "Divergente", icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  PARCIAL: { label: "Parcial", icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  SEM_DADOS: { label: "Sem Dados", icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-500/10" },
}

export default function AnaliseDiaPage() {
  const { data: session } = useSession()
  const { empresaId, setEmpresa } = useEmpresa()
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [dias, setDias] = useState<DiaAnalise[]>([])
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set())

  const fetchEmpresas = async () => {
    try {
      const res = await fetch("/api/empresas")
      const data = await res.json()
      setEmpresas(data.empresas || [])
    } catch {
      console.error("Erro ao buscar empresas")
    }
  }

  const buscarAnalise = async () => {
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
  }

  const toggleDia = (data: string) => {
    setDiasExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(data)) {
        novo.delete(data)
      } else {
        novo.add(data)
      }
      return novo
    })
  }

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split("-")
    return `${dia}/${mes}/${ano}`
  }

  const formatarValor = (valor: number) => {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  useEffect(() => {
    if (session) fetchEmpresas()
  }, [session])

  useEffect(() => {
    if (empresaId && dataInicio && dataFim) {
      buscarAnalise()
    }
  }, [empresaId, dataInicio, dataFim])

  useEffect(() => {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    setDataInicio(primeiroDia.toISOString().split("T")[0])
    setDataFim(hoje.toISOString().split("T")[0])
  }, [])

  if (!session) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Análise por Dia"
        description="Auditoria diária comparando ERP vs Extrato Bancário"
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Empresa
            </label>
            <select
              value={empresaId || ""}
              onChange={(e) => setEmpresa(e.target.value)}
              className="w-full p-2 border rounded bg-background border-border text-foreground"
            >
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="p-2 border rounded bg-background border-border text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="p-2 border rounded bg-background border-border text-foreground"
            />
          </div>
          <Button onClick={buscarAnalise} disabled={loading}>
            <Calendar className="w-4 h-4 mr-2" />
            {loading ? "Carregando..." : "Analisar"}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {error}
        </div>
      )}

      {dias.length > 0 && (
        <div className="space-y-3">
          {dias.map((dia) => {
            const status = statusConfig[dia.statusDia]
            const StatusIcon = status.icon
            const expandido = diasExpandidos.has(dia.data)

            return (
              <motion.div
                key={dia.data}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`border-l-4 ${
                    dia.statusDia === "CONCILIADO"
                      ? "border-l-green-500"
                      : dia.statusDia === "DIVERGENTE"
                      ? "border-l-red-500"
                      : dia.statusDia === "PARCIAL"
                      ? "border-l-yellow-500"
                      : "border-l-gray-400"
                  }`}
                >
                  <button
                    onClick={() => toggleDia(dia.data)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`w-5 h-5 ${status.color}`} />
                      <div>
                        <div className="font-semibold text-foreground">
                          {formatarData(dia.data)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {dia.qtdErp} ERP / {dia.qtdExtrato} Extrato
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-sm font-medium ${status.color}`}>
                          {status.label}
                        </div>
                        {dia.saldoFinalExtrato !== null && (
                          <div className="text-xs text-muted-foreground">
                            Saldo Extrato: R$ {formatarValor(dia.saldoFinalExtrato)}
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
                          {/* Totais */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className={`p-3 rounded ${status.bg}`}>
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                ERP
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Débito:</span>
                                <span className="font-medium text-red-500">
                                  R$ {formatarValor(dia.totalDebitoErp)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Crédito:</span>
                                <span className="font-medium text-green-500">
                                  R$ {formatarValor(dia.totalCreditoErp)}
                                </span>
                              </div>
                            </div>
                            <div className={`p-3 rounded ${status.bg}`}>
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Extrato
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Débito:</span>
                                <span className="font-medium text-red-500">
                                  R$ {formatarValor(dia.totalDebitoExtrato)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Crédito:</span>
                                <span className="font-medium text-green-500">
                                  R$ {formatarValor(dia.totalCreditoExtrato)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Transações ERP */}
                          {dia.transacoesErp.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Lançamentos ERP ({dia.transacoesErp.length})
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
                                    {dia.transacoesErp.map((t) => (
                                      <tr key={t.id} className="border-b border-border">
                                        <td className="p-2">{t.descricao}</td>
                                        <td className="p-2">{t.tipo}</td>
                                        <td className={`p-2 text-right font-medium ${
                                          t.tipo === "DEBITO" ? "text-red-500" : "text-green-500"
                                        }`}>
                                          R$ {formatarValor(t.valor)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Transações Extrato */}
                          {dia.transacoesExtrato.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Extrato Bancário ({dia.transacoesExtrato.length})
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
                                    {dia.transacoesExtrato.map((t) => (
                                      <tr key={t.id} className="border-b border-border">
                                        <td className="p-2">{t.descricao}</td>
                                        <td className="p-2">{t.tipo}</td>
                                        <td className={`p-2 text-right font-medium ${
                                          t.tipo === "DEBITO" ? "text-red-500" : "text-green-500"
                                        }`}>
                                          R$ {formatarValor(t.valor)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
