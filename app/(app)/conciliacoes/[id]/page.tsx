"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, AlertTriangle, Check, X, Pencil, Save } from "lucide-react"

interface ConciliacaoItem {
  id: string
  status: string
  diferencaValor?: number
  scoreMatch?: number
  observacao?: string
  resolvidoManualmente: boolean
  extrato?: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
  }
  extratoImportado?: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
  }
  erp?: {
    id: string
    data: string
    descricao: string
    valor: number
    tipo: string
    documento?: string
  }
}

interface Resumo {
  totalErp: number
  totalExtrato: number
  qtdConciliados: number
  qtdDivergentes: number
  qtdFaltandoErp: number
  qtdFaltandoBanco: number
}

interface Paginacao {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function ConciliacaoDetalhesPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [conciliacao, setConciliacao] = useState<{ id: string; periodo: string; status: string } | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [itens, setItens] = useState<ConciliacaoItem[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [editandoItem, setEditandoItem] = useState<string | null>(null)
  const [observacaoEdit, setObservacaoEdit] = useState("")
  const [atualizando, setAtualizando] = useState(false)

  const fetchDetalhes = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/conciliacoes/${params.id}/detalhes?page=${currentPage}&limit=50&status=${statusFilter}`
      )
      const data = await response.json()
      setConciliacao(data.conciliacao)
      setResumo(data.resumo)
      setItens(data.itens)
      setPaginacao(data.paginacao)
    } catch (error) {
      console.error("Erro ao buscar detalhes:", error)
    } finally {
      setLoading(false)
    }
  }, [params.id, currentPage, statusFilter])

  useEffect(() => {
    if (session && params.id) {
      fetchDetalhes()
    }
  }, [session, params.id, fetchDetalhes])

  // Redirecionar para revisão se status for PENDENTE_REVISAO
  useEffect(() => {
    if (conciliacao?.status === "PENDENTE_REVISAO") {
      router.replace(`/conciliacoes/${params.id}/revisar`)
    }
  }, [conciliacao?.status, params.id, router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AUTO_CONFIRMADO":
      case "CONFIRMADO_MANUAL":
        return "bg-success/20 text-success"
      case "REJEITADO":
        return "bg-warning/20 text-warning"
      case "SEM_MATCH":
        return "bg-destructive/20 text-destructive"
      case "SUGERIDO":
        return "bg-warning/20 text-warning"
      case "AMBIGUO":
        return "bg-brand/20 text-brand"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const atualizarItem = async (itemId: string, dados: Record<string, string | boolean>) => {
    setAtualizando(true)
    try {
      const response = await fetch(`/api/conciliacoes/${params.id}/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      })
      if (response.ok) {
        setEditandoItem(null)
        setObservacaoEdit("")
        fetchDetalhes()
      }
    } catch (error) {
      console.error("Erro ao atualizar:", error)
    } finally {
      setAtualizando(false)
    }
  }

  const naoConciliados = itens.filter(i =>
    i.status === "REJEITADO" || i.status === "SEM_MATCH" || i.status === "SUGERIDO" || i.status === "AMBIGUO"
  )

  const getExtratoData = (item: ConciliacaoItem) => {
    return item.extrato || item.extratoImportado
  }

  if (!session) {
    return null
  }

  if (loading) {
    return <div className="text-foreground">Carregando...</div>
  }

  if (!conciliacao) {
    return <div className="text-foreground">Conciliação não encontrada</div>
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          onClick={() => router.back()}
          variant="outline"
        >
          ← Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          Conciliação - {conciliacao.periodo}
        </h1>
        <span className={`px-3 py-1 rounded text-sm ${
          conciliacao.status === "CONCLUIDA" ? "bg-success/20 text-success" :
          conciliacao.status === "PROCESSANDO" ? "bg-brand/20 text-brand" :
          "bg-destructive/20 text-destructive"
        }`}>
          {conciliacao.status}
        </span>
      </motion.div>

      {/* ALERTA: Itens não conciliados */}
      {naoConciliados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {naoConciliados.length} lançamento{naoConciliados.length > 1 ? "s" : ""} não conciliado{naoConciliados.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-destructive/70 mt-1">
                O extrato é a referência. Revise os itens abaixo e faça o pareamento manual se necessário.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Resumo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-sm">Total ERP</p>
              <p className="text-2xl font-bold text-foreground">R$ {Number(resumo?.totalErp || 0).toFixed(2)}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-sm">Total Extrato</p>
              <p className="text-2xl font-bold text-foreground">R$ {Number(resumo?.totalExtrato || 0).toFixed(2)}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-sm">Conciliados</p>
              <p className="text-2xl font-bold text-success">{resumo?.qtdConciliados || 0}</p>
            </div>
            <div className="bg-accent p-4 rounded">
              <p className="text-muted-foreground text-sm">Desconciliados</p>
              <p className="text-2xl font-bold text-destructive">
                {(resumo?.qtdDivergentes || 0) + (resumo?.qtdFaltandoErp || 0) + (resumo?.qtdFaltandoBanco || 0)}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Lançamentos</h2>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="p-2 border rounded bg-background border-border text-foreground"
            >
              <option value="">Todos</option>
              <option value="AUTO_CONFIRMADO,CONFIRMADO_MANUAL">Conciliados</option>
              <option value="REJEITADO,SEM_MATCH,SUGERIDO,AMBIGUO">Desconciliados</option>
              <option value="REJEITADO">Rejeitados</option>
              <option value="SEM_MATCH">Sem Match</option>
              <option value="SUGERIDO">Sugeridos</option>
              <option value="AMBIGUO">Ambíguos</option>
            </select>
          </div>
          {itens.length === 0 ? (
            <p className="text-muted-foreground">Nenhum item encontrado</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-foreground font-medium">Status</th>
                      <th className="text-left p-2 text-foreground font-medium">Data</th>
                      <th className="text-left p-2 text-foreground font-medium">Descrição Extrato</th>
                      <th className="text-left p-2 text-foreground font-medium">Valor Extrato</th>
                      <th className="text-left p-2 text-foreground font-medium">Descrição ERP</th>
                      <th className="text-left p-2 text-foreground font-medium">Valor ERP</th>
                      <th className="text-left p-2 text-foreground font-medium">Diferença</th>
                      <th className="text-left p-2 text-foreground font-medium">Score</th>
                      <th className="text-left p-2 text-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => {
                      const extrato = getExtratoData(item)
                      return (
                        <tr key={item.id} className="border-t border-border hover:bg-accent">
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2 text-foreground">
                            {extrato ? new Date(extrato.data).toLocaleDateString("pt-BR") : "-"}
                          </td>
                          <td className="p-2 text-foreground">
                            {extrato ? extrato.descricao : "-"}
                          </td>
                          <td className="p-2 text-foreground">
                            {extrato ? `R$ ${Number(extrato.valor).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2 text-foreground">
                            {item.erp ? item.erp.descricao : "-"}
                          </td>
                          <td className="p-2 text-foreground">
                            {item.erp ? `R$ ${Number(item.erp.valor).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2 text-foreground">
                            {item.diferencaValor !== null && item.diferencaValor !== undefined ? (
                              <span className={item.diferencaValor === 0 ? "text-success" : "text-destructive"}>
                                R$ {item.diferencaValor.toFixed(2)}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="p-2">
                            {item.scoreMatch !== undefined ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.scoreMatch >= 0.80
                                  ? "bg-success/10 text-success"
                                  : item.scoreMatch >= 0.60
                                    ? "bg-warning/10 text-warning"
                                    : "bg-warning/10 text-warning"
                              }`}>
                                {(item.scoreMatch * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            {item.status !== "AUTO_CONFIRMADO" && item.status !== "CONFIRMADO_MANUAL" && (
                              <div className="flex items-center gap-1">
                                {editandoItem === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={observacaoEdit}
                                      onChange={(e) => setObservacaoEdit(e.target.value)}
                                      placeholder="Observação..."
                                      className="w-32 h-7 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => atualizarItem(item.id, { observacao: observacaoEdit })}
                                      disabled={atualizando}
                                      className="h-7 px-2 bg-success hover:bg-success/90"
                                    >
                                      <Save className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => { setEditandoItem(null); setObservacaoEdit("") }}
                                      variant="outline"
                                      className="h-7 px-2"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => { setEditandoItem(item.id); setObservacaoEdit(item.observacao || "") }}
                                      variant="outline"
                                      className="h-7 px-2"
                                      title="Adicionar observação"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    {(item.status === "REJEITADO" || item.status === "SEM_MATCH" || item.status === "SUGERIDO" || item.status === "AMBIGUO") && item.erp && getExtratoData(item) && (
                                      <Button
                                        size="sm"
                                        onClick={() => atualizarItem(item.id, { status: "CONFIRMADO_MANUAL", resolvidoManualmente: true })}
                                        disabled={atualizando}
                                        className="h-7 px-2 bg-success hover:bg-success/90"
                                        title="Marcar como conciliado"
                                      >
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
              {paginacao && paginacao.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-muted-foreground text-sm">
                    Página {paginacao.page} de {paginacao.totalPages} ({paginacao.total} itens)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(paginacao.totalPages, p + 1))}
                      disabled={currentPage === paginacao.totalPages}
                      variant="outline"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
