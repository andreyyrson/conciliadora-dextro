"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { ChevronLeft, Check, X, AlertTriangle, ChevronDown, Download } from "lucide-react"

interface Sugestao {
  entradaOrigemId: string
  entradaDestinoId: string
  score: number
  scoreDetalhado: {
    valor: number
    tipo: number
    data: number
    descricao: number
    documento: number
  }
  explicacoes: string[]
  confianca: "HIGH" | "MEDIUM" | "LOW"
  autoConfirmado: boolean
}

interface ItemRevisao {
  extrato: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
    identificador?: string
  }
  status: "AUTO_CONFIRMADO" | "SUGERIDO" | "AMBIGUO" | "SEM_MATCH"
  confianca: "HIGH" | "MEDIUM" | "LOW"
  sugestoes: Sugestao[]
  erpPareado?: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
    documento?: string
    fornecedor?: string
    categoria?: string
  }
  diferencaValor?: number
}

interface ErpSobrando {
  erp: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
    documento?: string
    fornecedor?: string
    categoria?: string
  }
  status: "FALTANDO_BANCO"
}

interface Conciliacao {
  id: string
  uploadId: string
  contaId?: string
  importacaoId?: string
  periodo: string
  status: string
}

export default function RevisarConciliacaoPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [conciliacao, setConciliacao] = useState<Conciliacao | null>(null)
  const [itens, setItens] = useState<ItemRevisao[]>([])
  const [erpsSobrando, setErpsSobrando] = useState<ErpSobrando[]>([])
  const [hashConciliacao, setHashConciliacao] = useState("")
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState("")

  // Estado de decisões do usuário (muta os itens)
  const [decisoes, setDecisoes] = useState<Record<string, {
    status: string
    erpId?: string
    score?: number
    confianca?: string
    explicacoes?: string[]
    scoreDetalhado?: any
    candidatos?: any[]
  }>>({})

  const fetchSugestoes = async () => {
    try {
      setLoading(true)
      setErro("")

      // 1. Buscar dados da conciliação
      const respConc = await fetch(`/api/conciliacoes/${params.id}`)
      if (!respConc.ok) throw new Error("Conciliação não encontrada")
      const dataConc = await respConc.json()
      const conc = dataConc.conciliacao as Conciliacao
      setConciliacao(conc)

      // 2. Buscar sugestões
      const respSug = await fetch("/api/conciliacoes/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: conc.uploadId,
          contaId: conc.contaId,
          importacaoId: conc.importacaoId
        })
      })
      if (!respSug.ok) throw new Error("Erro ao gerar sugestões")
      const dataSug = await respSug.json()

      setHashConciliacao(dataSug.hashConciliacao)
      setItens(dataSug.itens)
      setErpsSobrando(dataSug.erpsSobrando || [])

      // Inicializar decisões: auto-confirmados já vêm decididos
      const decs: Record<string, any> = {}
      dataSug.itens.forEach((item: ItemRevisao) => {
        if (item.status === "AUTO_CONFIRMADO" && item.erpPareado) {
          decs[item.extrato.id] = {
            status: "AUTO_CONFIRMADO",
            erpId: item.erpPareado.id,
            score: item.sugestoes[0]?.score,
            confianca: item.sugestoes[0]?.confianca,
            explicacoes: item.sugestoes[0]?.explicacoes,
            scoreDetalhado: item.sugestoes[0]?.scoreDetalhado,
            candidatos: item.sugestoes
          }
        }
      })
      setDecisoes(decs)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session && params.id) fetchSugestoes()
  }, [session, params.id])

  const setDecisao = (extratoId: string, dados: any) => {
    setDecisoes(prev => ({ ...prev, [extratoId]: dados }))
  }

  const confirmarSugerido = (item: ItemRevisao) => {
    const sug = item.sugestoes[0]
    if (!sug) return
    setDecisao(item.extrato.id, {
      status: "CONFIRMADO_MANUAL",
      erpId: sug.entradaOrigemId,
      score: sug.score,
      confianca: sug.confianca,
      explicacoes: sug.explicacoes,
      scoreDetalhado: sug.scoreDetalhado,
      candidatos: item.sugestoes
    })
  }

  const rejeitar = (item: ItemRevisao) => {
    setDecisao(item.extrato.id, {
      status: "REJEITADO",
      erpId: undefined,
      score: 0,
      confianca: "LOW",
      explicacoes: ["Rejeitado pelo usuário"],
      candidatos: item.sugestoes
    })
  }

  const trocarSugestao = (item: ItemRevisao, novoErpId: string) => {
    const sug = item.sugestoes.find(s => s.entradaOrigemId === novoErpId)
    if (!sug) return
    setDecisao(item.extrato.id, {
      status: "CONFIRMADO_MANUAL",
      erpId: sug.entradaOrigemId,
      score: sug.score,
      confianca: sug.confianca,
      explicacoes: sug.explicacoes,
      scoreDetalhado: sug.scoreDetalhado,
      candidatos: item.sugestoes
    })
  }

  const confirmarTodosSugeridos = () => {
    itens.forEach(item => {
      if (item.status === "SUGERIDO" && item.sugestoes[0]?.score >= 80 && !decisoes[item.extrato.id]) {
        confirmarSugerido(item)
      }
    })
  }

  const downloadExcel = async () => {
    try {
      const resp = await fetch(`/api/conciliacoes/${params.id}/exportar`)
      if (!resp.ok) throw new Error("Erro ao exportar")

      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inconsistencias-${conciliacao?.periodo || "conciliacao"}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: any) {
      setErro(e.message)
    }
  }

  const salvar = async () => {
    setConfirmando(true)
    try {
      const decisoesArray = itens.map(item => {
        const d = decisoes[item.extrato.id]
        return {
          extratoId: item.extrato.id,
          erpId: d?.erpId || null,
          status: d?.status || item.status,
          scoreMatch: d?.score || null,
          confiancaMatch: d?.confianca || null,
          explicacoes: d?.explicacoes || null,
          scoreDetalhado: d?.scoreDetalhado || null,
          candidatos: d?.candidatos || item.sugestoes || null
        }
      })

      const resp = await fetch(`/api/conciliacoes/${params.id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisoes: decisoesArray, hashConciliacao, erpsSobrando })
      })

      if (resp.ok) {
        router.push(`/conciliacoes/${params.id}`)
      } else {
        const err = await resp.json()
        setErro(err.error || "Erro ao salvar")
      }
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setConfirmando(false)
    }
  }

  // Resumos
  const autoConfirmados = itens.filter(i => i.status === "AUTO_CONFIRMADO").length
  const sugeridosPendentes = itens.filter(i => i.status === "SUGERIDO" && !decisoes[i.extrato.id]).length
  const ambiguos = itens.filter(i => i.status === "AMBIGUO" && !decisoes[i.extrato.id]).length
  const semMatch = itens.filter(i => i.status === "SEM_MATCH" && !decisoes[i.extrato.id]).length
  const totalPendentes = sugeridosPendentes + ambiguos + semMatch
  const totalErpsSobrando = erpsSobrando.length

  const getStatusBadge = (item: ItemRevisao) => {
    const d = decisoes[item.extrato.id]
    const status = d?.status || item.status
    switch (status) {
      case "AUTO_CONFIRMADO": return { label: "Auto-confirmado", className: "bg-green-500/20 text-green-400" }
      case "CONFIRMADO_MANUAL": return { label: "Confirmado", className: "bg-green-500/20 text-green-400" }
      case "SUGERIDO": return { label: "Sugerido", className: "bg-yellow-500/20 text-yellow-400" }
      case "AMBIGUO": return { label: "Ambíguo", className: "bg-orange-500/20 text-orange-400" }
      case "REJEITADO": return { label: "Rejeitado", className: "bg-red-500/20 text-red-400" }
      case "SEM_MATCH": return { label: "Sem match", className: "bg-gray-500/20 text-gray-400" }
      default: return { label: status, className: "bg-gray-500/20 text-gray-400" }
    }
  }

  const getConfiancaBadge = (conf: string) => {
    switch (conf) {
      case "HIGH": return "text-green-400"
      case "MEDIUM": return "text-yellow-400"
      case "LOW": return "text-gray-400"
      default: return "text-gray-400"
    }
  }

  if (!session) return null
  if (loading) return <div className="p-6 text-white">Carregando sugestões...</div>
  if (erro) return <div className="p-6 text-red-400">Erro: {erro}</div>

  return (
    <div className="p-6 space-y-6">
      <motion.div className="flex items-center gap-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Button onClick={() => router.back()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          ← Voltar
        </Button>
        <h1 className="text-2xl font-bold text-white">Revisar Conciliação — {conciliacao?.periodo}</h1>
      </motion.div>

      {/* Alerta de pendentes */}
      {totalPendentes > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">{totalPendentes} lançamento{totalPendentes > 1 ? "s" : ""} pendente{totalPendentes > 1 ? "s" : ""} de revisão</p>
              <p className="text-xs text-red-400/70 mt-1">O extrato é a referência. Revise os itens abaixo antes de confirmar.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cards de resumo */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6 bg-black border border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-xs">Auto-confirmados</p>
              <p className="text-2xl font-bold text-green-400">{autoConfirmados}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-xs">Sugeridos</p>
              <p className="text-2xl font-bold text-yellow-400">{sugeridosPendentes}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-xs">Ambíguos</p>
              <p className="text-2xl font-bold text-orange-400">{ambiguos}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-xs">Sem match</p>
              <p className="text-2xl font-bold text-gray-400">{semMatch}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-xs">ERP sobrando</p>
              <p className="text-2xl font-bold text-purple-400">{totalErpsSobrando}</p>
            </div>
            <div className="bg-white/5 p-4 rounded flex flex-col justify-center">
              <Button
                size="sm"
                onClick={confirmarTodosSugeridos}
                disabled={sugeridosPendentes === 0}
                className="bg-yellow-600 hover:bg-yellow-500 text-white"
              >
                Confirmar sugeridos (≥80%)
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Tabela de revisão */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-6 bg-black border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Lançamentos do Extrato</h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={downloadExcel}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
              <Button
                onClick={salvar}
                disabled={confirmando || totalPendentes > 0}
                className="bg-green-600 hover:bg-green-500 text-white"
              >
                {confirmando ? "Salvando..." : totalPendentes > 0 ? `Faltam ${totalPendentes} revisões` : "Confirmar tudo"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {itens.map((item) => {
              const badge = getStatusBadge(item)
              const d = decisoes[item.extrato.id]
              const jaDecidido = !!d

              return (
                <div
                  key={item.extrato.id}
                  className={`p-4 rounded border ${jaDecidido ? "border-white/10 bg-white/5" : "border-white/20 bg-white/[0.02]"}`}
                >
                  <div className="space-y-4">
                    {/* Header com status */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>{badge.label}</span>
                      {item.sugestoes[0] && !jaDecidido && (
                        <span className={`text-xs font-medium ${getConfiancaBadge(item.sugestoes[0].confianca)}`}>
                          Score: {item.sugestoes[0].score}%
                        </span>
                      )}
                      {item.diferencaValor !== undefined && item.diferencaValor > 0 && (
                        <span className="text-xs text-red-400">Dif: R$ {item.diferencaValor.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Cards lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Extrato */}
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                        <h4 className="text-xs font-semibold text-blue-300 mb-2">EXTRATO</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-400">Data: <span className="text-white">{new Date(item.extrato.data).toLocaleDateString("pt-BR")}</span></p>
                          <p className="text-gray-400">Descrição: <span className="text-white">{item.extrato.descricao}</span></p>
                          <p className="text-gray-400">Valor: <span className="text-white">R$ {item.extrato.valor.toFixed(2)}</span></p>
                          <p className="text-gray-400">Tipo: <span className="text-white">{item.extrato.tipo}</span></p>
                          {item.extrato.identificador && (
                            <p className="text-gray-400">ID: <span className="text-white">{item.extrato.identificador}</span></p>
                          )}
                        </div>
                      </div>

                      {/* ERP */}
                      {item.status === "AUTO_CONFIRMADO" && item.erpPareado ? (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                          <h4 className="text-xs font-semibold text-green-300 mb-2">ERP (MATCH)</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-400">Data: <span className="text-white">{new Date(item.erpPareado.data).toLocaleDateString("pt-BR")}</span></p>
                            <p className="text-gray-400">Descrição: <span className="text-white">{item.erpPareado.descricao}</span></p>
                            <p className="text-gray-400">Valor: <span className="text-white">R$ {item.erpPareado.valor.toFixed(2)}</span></p>
                            <p className="text-gray-400">Tipo: <span className="text-white">{item.erpPareado.tipo}</span></p>
                            {item.erpPareado.documento && (
                              <p className="text-gray-400">Doc: <span className="text-white">{item.erpPareado.documento}</span></p>
                            )}
                            {item.erpPareado.fornecedor && (
                              <p className="text-gray-400">Fornecedor: <span className="text-white">{item.erpPareado.fornecedor}</span></p>
                            )}
                            {item.erpPareado.categoria && (
                              <p className="text-gray-400">Categoria: <span className="text-white">{item.erpPareado.categoria}</span></p>
                            )}
                          </div>
                        </div>
                      ) : d?.status === "REJEITADO" ? (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
                          <h4 className="text-xs font-semibold text-red-300 mb-2">REJEITADO</h4>
                          <p className="text-sm text-red-400">Match rejeitado pelo usuário</p>
                        </div>
                      ) : d?.erpId ? (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                          <h4 className="text-xs font-semibold text-green-300 mb-2">ERP (CONFIRMADO)</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-400">Score: <span className="text-white">{d.score}%</span></p>
                            <p className="text-gray-400">Explicações: <span className="text-white">{item.sugestoes.find(s => s.entradaOrigemId === d.erpId)?.explicacoes.join(" · ") || "Match confirmado"}</span></p>
                          </div>
                        </div>
                      ) : item.sugestoes.length > 0 ? (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                          <h4 className="text-xs font-semibold text-yellow-300 mb-2">ERP SUGERIDO</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-400">Score: <span className="text-white">{item.sugestoes[0].score}%</span></p>
                            <p className="text-gray-400">Explicações: <span className="text-white">{item.sugestoes[0].explicacoes.join(" · ")}</span></p>
                            {item.sugestoes.length > 1 && (
                              <div className="relative inline-block mt-2">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) trocarSugestao(item, e.target.value)
                                  }}
                                  className="text-xs bg-black border border-white/20 text-white rounded p-1"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Trocar sugestão...</option>
                                  {item.sugestoes.map(s => (
                                    <option key={s.entradaOrigemId} value={s.entradaOrigemId}>
                                      {s.explicacoes[0]} — {s.score}%
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-500/10 border border-gray-500/20 rounded">
                          <h4 className="text-xs font-semibold text-gray-300 mb-2">SEM MATCH</h4>
                          <p className="text-sm text-gray-500">Nenhum candidato encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex items-center gap-1 shrink-0 mt-4">
                    {!jaDecidido && item.status !== "AUTO_CONFIRMADO" && (
                      <>
                        {item.sugestoes.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => confirmarSugerido(item)}
                            className="h-8 px-2 bg-green-600 hover:bg-green-500"
                            title="Confirmar"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => rejeitar(item)}
                          variant="outline"
                          className="h-8 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          title="Rejeitar"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {jaDecidido && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const nd = { ...decisoes }
                          delete nd[item.extrato.id]
                          setDecisoes(nd)
                        }}
                        variant="outline"
                        className="h-8 px-2 border-white/20 text-white hover:bg-white/10"
                        title="Desfazer"
                      >
                        Desfazer
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </motion.div>

      {/* ERPs sobrando */}
      {erpsSobrando.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 bg-black border border-purple-500/30">
            <h2 className="text-lg font-semibold text-purple-300 mb-4">Lançamentos ERP sem correspondência no extrato ({erpsSobrando.length})</h2>
            <div className="space-y-2">
              {erpsSobrando.map((item, idx) => (
                <div key={idx} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                  <div className="space-y-1 text-sm">
                    <p className="text-white">{item.erp.descricao}</p>
                    <p className="text-purple-300">
                      {new Date(item.erp.data).toLocaleDateString('pt-BR')} • {item.erp.tipo} • R$ {Number(item.erp.valor).toFixed(2)}
                    </p>
                    {item.erp.documento && <p className="text-purple-300">Doc: {item.erp.documento}</p>}
                    {item.erp.fornecedor && <p className="text-purple-300">Fornecedor: {item.erp.fornecedor}</p>}
                    {item.erp.categoria && <p className="text-purple-300">Categoria: {item.erp.categoria}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
