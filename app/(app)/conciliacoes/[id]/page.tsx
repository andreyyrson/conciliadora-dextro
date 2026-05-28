"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Eye, AlertTriangle, Check, X, Pencil, Save } from "lucide-react"

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
  const [conciliacao, setConciliacao] = useState<any>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [itens, setItens] = useState<ConciliacaoItem[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [editandoItem, setEditandoItem] = useState<string | null>(null)
  const [observacaoEdit, setObservacaoEdit] = useState("")
  const [atualizando, setAtualizando] = useState(false)

  const fetchDetalhes = async () => {
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
  }

  useEffect(() => {
    if (session && params.id) {
      fetchDetalhes()
    }
  }, [session, params.id, currentPage, statusFilter])

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
        return "bg-green-900/30 text-green-400"
      case "REJEITADO":
        return "bg-orange-900/30 text-orange-400"
      case "SEM_MATCH":
        return "bg-red-900/30 text-red-400"
      case "SUGERIDO":
        return "bg-yellow-900/30 text-yellow-400"
      case "AMBIGUO":
        return "bg-purple-900/30 text-purple-400"
      default:
        return "bg-gray-800 text-gray-400"
    }
  }

  const atualizarItem = async (itemId: string, dados: any) => {
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
    return <div className="text-white">Carregando...</div>
  }

  if (!conciliacao) {
    return <div className="text-white">Conciliação não encontrada</div>
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
          className="border-white/20 text-white hover:bg-white/10"
        >
          ← Voltar
        </Button>
        <h1 className="text-2xl font-bold text-white">
          Conciliação - {conciliacao.periodo}
        </h1>
        <span className={`px-3 py-1 rounded text-sm ${
          conciliacao.status === "CONCLUIDA" ? "bg-green-900/30 text-green-400" :
          conciliacao.status === "PROCESSANDO" ? "bg-blue-900/30 text-blue-400" :
          "bg-red-900/30 text-red-400"
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
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">
                {naoConciliados.length} lançamento{naoConciliados.length > 1 ? "s" : ""} não conciliado{naoConciliados.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-400/70 mt-1">
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
        <Card className="p-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Resumo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-sm">Total ERP</p>
              <p className="text-2xl font-bold text-white">R$ {Number(resumo?.totalErp || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-sm">Total Extrato</p>
              <p className="text-2xl font-bold text-white">R$ {Number(resumo?.totalExtrato || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-sm">Conciliados</p>
              <p className="text-2xl font-bold text-green-400">{resumo?.qtdConciliados || 0}</p>
            </div>
            <div className="bg-white/5 p-4 rounded">
              <p className="text-gray-400 text-sm">Desconciliados</p>
              <p className="text-2xl font-bold text-red-400">
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
        <Card className="p-6 bg-black border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Lançamentos</h2>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="p-2 border rounded bg-black border-white/20 text-white"
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
            <p className="text-gray-500">Nenhum item encontrado</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-white font-medium">Status</th>
                      <th className="text-left p-2 text-white font-medium">Data</th>
                      <th className="text-left p-2 text-white font-medium">Descrição Extrato</th>
                      <th className="text-left p-2 text-white font-medium">Valor Extrato</th>
                      <th className="text-left p-2 text-white font-medium">Descrição ERP</th>
                      <th className="text-left p-2 text-white font-medium">Valor ERP</th>
                      <th className="text-left p-2 text-white font-medium">Diferença</th>
                      <th className="text-left p-2 text-white font-medium">Score</th>
                      <th className="text-left p-2 text-white font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => {
                      const extrato = getExtratoData(item)
                      return (
                        <tr key={item.id} className="border-t border-white/10 hover:bg-white/5">
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2 text-gray-300">
                            {extrato ? new Date(extrato.data).toLocaleDateString("pt-BR") : "-"}
                          </td>
                          <td className="p-2 text-gray-300">
                            {extrato ? extrato.descricao : "-"}
                          </td>
                          <td className="p-2 text-gray-300">
                            {extrato ? `R$ ${Number(extrato.valor).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2 text-gray-300">
                            {item.erp ? item.erp.descricao : "-"}
                          </td>
                          <td className="p-2 text-gray-300">
                            {item.erp ? `R$ ${Number(item.erp.valor).toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2 text-gray-300">
                            {item.diferencaValor !== null && item.diferencaValor !== undefined ? (
                              <span className={item.diferencaValor === 0 ? "text-green-400" : "text-red-400"}>
                                R$ {item.diferencaValor.toFixed(2)}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="p-2">
                            {item.scoreMatch !== undefined ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.scoreMatch >= 0.80
                                  ? "bg-green-500/10 text-green-400"
                                  : item.scoreMatch >= 0.60
                                    ? "bg-yellow-500/10 text-yellow-400"
                                    : "bg-orange-500/10 text-orange-400"
                              }`}>
                                {(item.scoreMatch * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
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
                                      className="w-32 h-7 text-xs bg-black border-white/20 text-white"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => atualizarItem(item.id, { observacao: observacaoEdit })}
                                      disabled={atualizando}
                                      className="h-7 px-2 bg-green-600 hover:bg-green-500"
                                    >
                                      <Save className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => { setEditandoItem(null); setObservacaoEdit("") }}
                                      variant="outline"
                                      className="h-7 px-2 border-white/20"
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
                                      className="h-7 px-2 border-white/20 text-white hover:bg-white/10"
                                      title="Adicionar observação"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    {(item.status === "REJEITADO" || item.status === "SEM_MATCH" || item.status === "SUGERIDO" || item.status === "AMBIGUO") && item.erp && getExtratoData(item) && (
                                      <Button
                                        size="sm"
                                        onClick={() => atualizarItem(item.id, { status: "CONFIRMADO_MANUAL", resolvidoManualmente: true })}
                                        disabled={atualizando}
                                        className="h-7 px-2 bg-green-600 hover:bg-green-500"
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
                  <p className="text-gray-400 text-sm">
                    Página {paginacao.page} de {paginacao.totalPages} ({paginacao.total} itens)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(paginacao.totalPages, p + 1))}
                      disabled={currentPage === paginacao.totalPages}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
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
