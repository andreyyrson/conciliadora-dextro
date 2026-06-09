"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, ChevronDown, ChevronUp, Building2, AlertCircle, CheckCircle, MinusCircle, Download } from "lucide-react"

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

interface MatchDetalhe {
  extratoId: string
  extratoDescricao: string
  extratoValor: number
  status: "AUTO_CONFIRMADO" | "SUGERIDO" | "AMBIGUO" | "SEM_MATCH"
  confianca: "HIGH" | "MEDIUM" | "LOW"
  score: number
  erpPareado: { id: string; descricao: string; valor: number } | null
  diferencaValor?: number
  explicacoes: string[]
}

interface MatchDia {
  autoConfirmados: number
  sugeridos: number
  ambiguos: number
  semMatch: number
  erpsSobrando: number
  detalhes: MatchDetalhe[]
}

interface DiaAnalise {
  data: string
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  saldoFinalErp: number
  saldoFinalExtrato: number
  saldoAposBanco: number | null
  transacoesErp: TransacaoErp[]
  transacoesExtrato: TransacaoExtrato[]
  statusDia: "CONCILIADO" | "DIVERGENTE" | "PARCIAL" | "SEM_DADOS" | "SUGERIDO"
  qtdErp: number
  qtdExtrato: number
  matches: MatchDia
}

const statusConfig = {
  CONCILIADO: { label: "Conciliado", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  DIVERGENTE: { label: "Divergente", icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  PARCIAL: { label: "Parcial", icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  SEM_DADOS: { label: "Sem Dados", icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-500/10" },
  SUGERIDO: { label: "Sugerido", icon: AlertCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
}

export function AnaliseDiaScreen() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const [dias, setDias] = useState<DiaAnalise[]>([])
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return primeiroDia.toISOString().split("T")[0]
  })
  const [dataFim, setDataFim] = useState(() => {
    const hoje = new Date()
    return hoje.toISOString().split("T")[0]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set())
  const [exportando, setExportando] = useState(false)

  const buscarAnalise = useCallback(async () => {
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
  }, [empresaId, dataInicio, dataFim])

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

  const downloadExcel = async () => {
    if (!empresaId || !dataInicio || !dataFim) return
    setExportando(true)
    try {
      const res = await fetch(
        `/api/conciliacoes/analise-dia/exportar?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}`
      )
      if (!res.ok) {
        let msg = "Erro ao exportar"
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {
          // resposta não-JSON, mantém mensagem padrão
        }
        throw new Error(msg)
      }
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
      buscarAnalise()
    }
  }, [empresaId, dataInicio, dataFim, buscarAnalise])

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
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
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
          <Button onClick={downloadExcel} disabled={exportando || dias.length === 0} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {exportando ? "Exportando..." : "Exportar Excel"}
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
                      : dia.statusDia === "SUGERIDO"
                      ? "border-l-blue-500"
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

                          {/* Matches do Dia */}
                          {dia.matches && dia.matches.detalhes.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Matching ({dia.matches.autoConfirmados} auto, {dia.matches.sugeridos} sugeridos, {dia.matches.ambiguos} ambíguos, {dia.matches.semMatch} sem match)
                              </h4>
                              <div className="space-y-2">
                                {dia.matches.detalhes.map((m) => {
                                  const confColor = m.confianca === "HIGH" ? "text-green-500" : m.confianca === "MEDIUM" ? "text-yellow-500" : "text-red-500"
                                  const statusLabel = m.status === "AUTO_CONFIRMADO" ? "Auto-confirmado" : m.status === "SUGERIDO" ? "Sugerido" : m.status === "AMBIGUO" ? "Ambíguo" : "Sem match"
                                  const statusBg = m.status === "AUTO_CONFIRMADO" ? "bg-green-500/10" : m.status === "SUGERIDO" ? "bg-blue-500/10" : m.status === "AMBIGUO" ? "bg-yellow-500/10" : "bg-gray-500/10"

                                  return (
                                    <div key={m.extratoId} className={`p-3 rounded text-sm ${statusBg}`}>
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium">
                                            Extrato: {m.extratoDescricao} — R$ {formatarValor(m.extratoValor)}
                                          </div>
                                          {m.erpPareado && (
                                            <div className="text-muted-foreground mt-1">
                                              ERP: {m.erpPareado.descricao} — R$ {formatarValor(m.erpPareado.valor)}
                                            </div>
                                          )}
                                          {m.diferencaValor !== undefined && m.diferencaValor > 0.01 && (
                                            <div className="text-xs text-red-500 mt-1">
                                              Diferença: R$ {formatarValor(m.diferencaValor)}
                                            </div>
                                          )}
                                          {m.explicacoes.length > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {m.explicacoes.join(" • ")}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-right ml-4">
                                          <div className={`font-semibold ${confColor}`}>{statusLabel}</div>
                                          {m.score > 0 && (
                                            <div className="text-xs text-muted-foreground">Score: {m.score}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {dia.matches.erpsSobrando > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                          {dia.matches.erpsSobrando} lançamento(s) ERP sem correspondência no extrato
                                        </div>
                              )}
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
