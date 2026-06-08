"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Check, X, AlertTriangle } from "lucide-react"
import { EntradaConciliacao } from "@/lib/matching/engine"

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

interface DecisaoRevisao {
  status: string
  erpId?: string
  score?: number
  confianca?: string
  explicacoes?: string[]
  scoreDetalhado?: Sugestao["scoreDetalhado"]
  candidatos?: Sugestao[]
  valorEditado?: number
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
  const [erpEntradas, setErpEntradas] = useState<EntradaConciliacao[]>([])
  const [hashConciliacao, setHashConciliacao] = useState("")
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState("")

  const [decisoes, setDecisoes] = useState<Record<string, DecisaoRevisao>>({})

  const fetchSugestoes = useCallback(async () => {
    try {
      setLoading(true)
      setErro("")

      const respConc = await fetch(`/api/conciliacoes/${params.id}`)
      if (!respConc.ok) throw new Error("Conciliação não encontrada")
      const dataConc = await respConc.json()
      const conc = dataConc.conciliacao as Conciliacao
      setConciliacao(conc)

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
      setErpEntradas(dataSug.erps || [])

      const decs: Record<string, DecisaoRevisao> = {}
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (session && params.id) fetchSugestoes()
  }, [session, params.id, fetchSugestoes])

  const setDecisao = (extratoId: string, dados: DecisaoRevisao) => {
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
      if (item.status === "SUGERIDO" && item.sugestoes[0]?.score >= 50 && !decisoes[item.extrato.id]) {
        confirmarSugerido(item)
      }
    })
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmando(false)
    }
  }

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
      case "AUTO_CONFIRMADO": return { label: "Auto-confirmado", className: "bg-success/20 text-success" }
      case "CONFIRMADO_MANUAL": return { label: "Confirmado", className: "bg-success/20 text-success" }
      case "SUGERIDO": return { label: "Sugerido", className: "bg-warning/20 text-warning" }
      case "AMBIGUO": return { label: "Ambíguo", className: "bg-warning/20 text-warning" }
      case "REJEITADO": return { label: "Rejeitado", className: "bg-destructive/20 text-destructive" }
      case "SEM_MATCH": return { label: "Sem match", className: "bg-muted text-muted-foreground" }
      default: return { label: status, className: "bg-muted text-muted-foreground" }
    }
  }

  const getConfiancaBadge = (conf: string) => {
    switch (conf) {
      case "HIGH": return "text-success"
      case "MEDIUM": return "text-warning"
      case "LOW": return "text-muted-foreground"
      default: return "text-muted-foreground"
    }
  }

  if (!session) return null
  if (loading) return <div className="p-6 text-foreground">Carregando sugestões...</div>
  if (erro) return <div className="p-6 text-destructive">Erro: {erro}</div>

  return (
    <div className="p-6 space-y-6">
      <motion.div className="flex items-center gap-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Button onClick={() => router.back()} variant="outline">
          ← Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Revisar Conciliação — {conciliacao?.periodo}</h1>
      </motion.div>

      {totalPendentes > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{totalPendentes} lançamento{totalPendentes > 1 ? "s" : ""} pendente{totalPendentes > 1 ? "s" : ""} de revisão</p>
              <p className="text-xs text-destructive/70 mt-1">O extrato é a referência. Revise os itens abaixo antes de confirmar.</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-xs">Auto-confirmados</p>
              <p className="text-2xl font-bold text-success">{autoConfirmados}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-xs">Sugeridos</p>
              <p className="text-2xl font-bold text-warning">{sugeridosPendentes}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-xs">Ambíguos</p>
              <p className="text-2xl font-bold text-warning">{ambiguos}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-xs">Sem match</p>
              <p className="text-2xl font-bold text-muted-foreground">{semMatch}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-xs">ERP sobrando</p>
              <p className="text-2xl font-bold text-brand">{totalErpsSobrando}</p>
            </div>
            <div className="bg-accent p-4 rounded flex flex-col justify-center">
              <Button
                size="sm"
                onClick={confirmarTodosSugeridos}
                disabled={sugeridosPendentes === 0}
                className="bg-warning hover:bg-warning/90 text-background"
              >
                Confirmar sugeridos (≥50%)
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Lançamentos do Extrato</h2>
            <Button
              onClick={salvar}
              disabled={confirmando || totalPendentes > 0}
              className="bg-success hover:bg-success/90 text-background"
            >
              {confirmando ? "Salvando..." : totalPendentes > 0 ? `Faltam ${totalPendentes} revisões` : "Confirmar tudo"}
            </Button>
          </div>

          <div className="space-y-3">
            {itens.filter(item => item.status !== "AUTO_CONFIRMADO").map((item) => {
              const badge = getStatusBadge(item)
              const d = decisoes[item.extrato.id]
              const jaDecidido = !!d

              return (
                <div
                  key={item.extrato.id}
                  className={`p-4 rounded border ${jaDecidido ? "border-border bg-accent" : item.status === "AMBIGUO" ? "border-warning/50 bg-warning/5" : "border-border bg-background"}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>{badge.label}</span>
                      {item.status === "AMBIGUO" && !jaDecidido && (
                        <span className="text-xs font-medium text-warning animate-pulse">⚠️ Requer decisão manual</span>
                      )}
                      {item.sugestoes[0] && !jaDecidido && (
                        <span className={`text-xs font-medium ${getConfiancaBadge(item.sugestoes[0].confianca)}`}>
                          Score: {item.sugestoes[0].score}%
                        </span>
                      )}
                      {item.diferencaValor !== undefined && item.diferencaValor > 0 && (
                        <span className="text-xs text-destructive">Dif: R$ {item.diferencaValor.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-brand/10 border border-brand/20 rounded">
                        <h4 className="text-xs font-semibold text-brand mb-2">EXTRATO</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">Data: <span className="text-foreground">{new Date(item.extrato.data).toLocaleDateString("pt-BR")}</span></p>
                          <p className="text-muted-foreground">Descrição: <span className="text-foreground">{item.extrato.descricao}</span></p>
                          <p className="text-muted-foreground">Valor: <span className="text-foreground">R$ {item.extrato.valor.toFixed(2)}</span></p>
                          <p className="text-muted-foreground">Tipo: <span className="text-foreground">{item.extrato.tipo}</span></p>
                          {item.extrato.identificador && (
                            <p className="text-muted-foreground">ID: <span className="text-foreground">{item.extrato.identificador}</span></p>
                          )}
                        </div>
                      </div>

                      {item.status === "AUTO_CONFIRMADO" && item.erpPareado ? (
                        <div className="p-3 bg-success/10 border border-success/20 rounded">
                          <h4 className="text-xs font-semibold text-success mb-2">ERP (MATCH)</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">Data: <span className="text-foreground">{new Date(item.erpPareado.data).toLocaleDateString("pt-BR")}</span></p>
                            <p className="text-muted-foreground">Descrição: <span className="text-foreground">{item.erpPareado.descricao}</span></p>
                            <p className="text-muted-foreground">Valor: <span className="text-foreground">R$ {item.erpPareado.valor.toFixed(2)}</span></p>
                            <p className="text-muted-foreground">Tipo: <span className="text-foreground">{item.erpPareado.tipo}</span></p>
                            {item.erpPareado.documento && (
                              <p className="text-muted-foreground">Doc: <span className="text-foreground">{item.erpPareado.documento}</span></p>
                            )}
                            {item.erpPareado.fornecedor && (
                              <p className="text-muted-foreground">Fornecedor: <span className="text-foreground">{item.erpPareado.fornecedor}</span></p>
                            )}
                            {item.erpPareado.categoria && (
                              <p className="text-muted-foreground">Categoria: <span className="text-foreground">{item.erpPareado.categoria}</span></p>
                            )}
                          </div>
                        </div>
                      ) : d?.status === "REJEITADO" ? (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                          <h4 className="text-xs font-semibold text-destructive mb-2">REJEITADO</h4>
                          <p className="text-sm text-destructive">Match rejeitado pelo usuário</p>
                        </div>
                      ) : d?.erpId ? (
                        <div className="p-3 bg-success/10 border border-success/20 rounded">
                          <h4 className="text-xs font-semibold text-success mb-2">ERP (CONFIRMADO)</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">Score: <span className="text-foreground">{d.score}%</span></p>
                            <p className="text-muted-foreground">Explicações: <span className="text-foreground">{item.sugestoes.find(s => s.entradaOrigemId === d.erpId)?.explicacoes.join(" · ") || "Match confirmado"}</span></p>
                          </div>
                        </div>
                      ) : item.sugestoes.length > 0 ? (
                        <div className="p-3 bg-warning/10 border border-warning/20 rounded">
                          <h4 className="text-xs font-semibold text-warning mb-2">ERP SUGERIDO</h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">Score: <span className="text-foreground">{item.sugestoes[0].score}%</span></p>
                            <p className="text-muted-foreground">Explicações: <span className="text-foreground">{item.sugestoes[0].explicacoes.join(" · ")}</span></p>
                            {(() => {
                              const erpSugerido = erpEntradas?.find(e => e.id === item.sugestoes[0].entradaOrigemId)
                              if (!erpSugerido) return null
                              return (
                                <>
                                  <p className="text-muted-foreground">Data: <span className="text-foreground">{new Date(erpSugerido.data).toLocaleDateString("pt-BR")}</span></p>
                                  <p className="text-muted-foreground">Descrição: <span className="text-foreground">{erpSugerido.descricao}</span></p>
                                  <p className="text-muted-foreground">Valor: <span className="text-foreground">R$ {erpSugerido.valor.toFixed(2)}</span></p>
                                  <p className="text-muted-foreground">Tipo: <span className="text-foreground">{erpSugerido.tipo}</span></p>
                                  {erpSugerido.documento && <p className="text-muted-foreground">Doc: <span className="text-foreground">{erpSugerido.documento}</span></p>}
                                  {erpSugerido.fornecedor && <p className="text-muted-foreground">Fornecedor: <span className="text-foreground">{erpSugerido.fornecedor}</span></p>}
                                  {erpSugerido.categoria && <p className="text-muted-foreground">Categoria: <span className="text-foreground">{erpSugerido.categoria}</span></p>}
                                </>
                              )
                            })()}
                            {item.sugestoes.length > 1 && (
                              <div className="relative inline-block mt-2">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) trocarSugestao(item, e.target.value)
                                  }}
                                  className="text-xs bg-background border border-border text-foreground rounded p-1"
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
                        <div className="p-3 bg-muted border border-border rounded">
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2">SEM MATCH</h4>
                          <p className="text-sm text-muted-foreground">Nenhum candidato encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 mt-4">
                    {!jaDecidido && item.status !== "AUTO_CONFIRMADO" && (
                      <>
                        {item.sugestoes.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => confirmarSugerido(item)}
                            className="h-8 px-2 bg-success hover:bg-success/90"
                            title="Confirmar"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => rejeitar(item)}
                          variant="outline"
                          className="h-8 px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
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
                        className="h-8 px-2"
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

      {erpsSobrando.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 border-brand/30">
            <h2 className="text-lg font-semibold text-brand mb-4">Lançamentos ERP sem correspondência no extrato ({erpsSobrando.length})</h2>
            <div className="space-y-2">
              {erpsSobrando.map((item, idx) => (
                <div key={idx} className="p-3 bg-brand/10 border border-brand/20 rounded">
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground">{item.erp.descricao}</p>
                    <p className="text-brand">
                      {new Date(item.erp.data).toLocaleDateString('pt-BR')} • {item.erp.tipo} • R$ {Number(item.erp.valor).toFixed(2)}
                    </p>
                    {item.erp.documento && <p className="text-brand">Doc: {item.erp.documento}</p>}
                    {item.erp.fornecedor && <p className="text-brand">Fornecedor: {item.erp.fornecedor}</p>}
                    {item.erp.categoria && <p className="text-brand">Categoria: {item.erp.categoria}</p>}
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
