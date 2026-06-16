"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, Trash2, CheckCircle, Pencil } from "lucide-react"
import { TabelaComparativaConciliacao } from "./comparativo/tabela-comparativa"
import { useComparativo } from "./comparativo/use-comparativo"

interface Conciliacao {
  id: string
  periodo: string
  status: string
  totalErp: number
  totalExtrato: number
  qtdConciliados: number
  qtdDivergentes: number
  qtdFaltandoErp: number
  qtdFaltandoBanco: number
  criadoEm: string
  upload: {
    nomeArquivo: string
  }
}

interface Upload {
  id: string
  nomeArquivo: string
  periodo: string
}

interface Conta {
  id: string
  banco: string
  conta: string
}

interface Importacao {
  id: string
  tipo: string
  nomeArquivo: string
  totalLinhas: number
}

export function ConciliacoesListaScreen() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const router = useRouter()
  const [conciliacoes, setConciliacoes] = useState<Conciliacao[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [selectedUpload, setSelectedUpload] = useState("")
  const [contas, setContas] = useState<Conta[]>([])
  const [selectedConta, setSelectedConta] = useState("")
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [selectedImportacao, setSelectedImportacao] = useState("")
  const [modoExtrato, setModoExtrato] = useState<"conta" | "importacao">("conta")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const {
    linhas,
    pagination,
    filtros,
    setFiltros,
    loading: loadingComparativo,
    modoEdicao,
    setModoEdicao,
    error: errorComparativo,
    onPageChange,
    onSalvarErp,
    onSalvarExtrato,
    onDeletarErp,
    onDeletarExtrato,
    onAplicarFiltros,
  } = useComparativo({ empresaId })

  useEffect(() => {
    if (showSuccessAnimation) {
      const timer = setTimeout(() => {
        setShowSuccessAnimation(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showSuccessAnimation])

  const fetchConciliacoes = useCallback(async (empId: string) => {
    try {
      const response = await fetch(`/api/conciliacoes?empresaId=${empId}`)
      const data = await response.json()
      setConciliacoes(data.conciliacoes || [])
    } catch (error) {
      console.error("Erro ao buscar conciliações:", error)
    }
  }, [])

  const fetchUploads = useCallback(async (empId: string) => {
    try {
      const response = await fetch(`/api/upload?empresaId=${empId}`)
      if (!response.ok) {
        console.error("API upload retornou", response.status)
        setError(`Erro ao buscar uploads: ${response.status}`)
        setUploads([])
        return
      }
      const data = await response.json()
      console.log("Uploads recebidos:", data)
      setUploads(data.uploads || [])
    } catch (error) {
      console.error("Erro ao buscar uploads:", error)
      setError("Erro de rede ao buscar uploads")
      setUploads([])
    }
  }, [])

  const fetchContas = useCallback(async (empId: string) => {
    try {
      const response = await fetch(`/api/contas?empresaId=${empId}`)
      if (!response.ok) {
        console.error("API contas retornou", response.status)
        return
      }
      const data = await response.json()
      setContas(data.contas || [])
    } catch (error) {
      console.error("Erro ao buscar contas:", error)
    }
  }, [])

  const fetchImportacoes = useCallback(async (empId: string) => {
    try {
      const response = await fetch(`/api/importacoes?empresaId=${empId}`)
      if (!response.ok) {
        console.error("API importacoes retornou", response.status)
        return
      }
      const data = await response.json()
      console.log("Importacoes recebidas:", data)
      setImportacoes(data.importacoes || [])
    } catch (error) {
      console.error("Erro ao buscar importações:", error)
    }
  }, [])

  useEffect(() => {
    if (empresaId) {
      fetchConciliacoes(empresaId)
      fetchUploads(empresaId)
      fetchContas(empresaId)
      fetchImportacoes(empresaId)
    }
  }, [empresaId, fetchConciliacoes, fetchUploads, fetchContas, fetchImportacoes])

  const handleIniciarConciliacao = async () => {
    if (!selectedUpload) {
      setError("Selecione um upload do ERP")
      return
    }

    if (modoExtrato === "conta" && !selectedConta) {
      setError("Selecione uma conta bancária")
      return
    }

    if (modoExtrato === "importacao" && !selectedImportacao) {
      setError("Selecione uma importação de extrato")
      return
    }

    setLoading(true)
    setError("")

    try {
      const body: Record<string, string> = {
        uploadId: selectedUpload,
        empresaId: empresaId!
      }

      if (modoExtrato === "conta") {
        body.contaId = selectedConta
      } else {
        body.importacaoId = selectedImportacao
      }

      const response = await fetch("/api/conciliacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao iniciar conciliação")
        return
      }

      setShowSuccessAnimation(true)
      if (empresaId) fetchConciliacoes(empresaId)
    } catch {
      setError("Erro ao iniciar conciliação")
    } finally {
      setLoading(false)
    }
  }

  const handleDeletar = async (id: string) => {
    setDeleting(true)

    try {
      const response = await fetch(`/api/conciliacoes/${id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setDeleteConfirm(null)
        if (empresaId) fetchConciliacoes(empresaId)
      } else {
        const data = await response.json()
        setError(data.error || "Erro ao deletar conciliação")
        setDeleting(false)
      }
    } catch (error) {
      console.error("Erro ao deletar conciliação:", error)
      setError("Erro ao deletar conciliação")
      setDeleting(false)
    }
  }

  if (!session) {
    return null
  }

  if (!empresaId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          Selecione uma empresa no topo da página para gerenciar conciliações.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="hidden"
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Nova Conciliação</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="upload" className="block text-sm font-medium text-muted-foreground mb-1">
              Upload ERP *
            </label>
            <select
              id="upload"
              value={selectedUpload}
              onChange={(e) => setSelectedUpload(e.target.value)}
              className="w-full p-2 border rounded bg-background border-border text-foreground"
            >
              <option value="">Selecione um upload</option>
              {uploads.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {upload.nomeArquivo} ({upload.periodo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Fonte do Extrato *
            </label>
            <div className="flex gap-4">
              <label htmlFor="modo-conta" className="flex items-center gap-2 cursor-pointer">
                <input
                  id="modo-conta"
                  type="radio"
                  name="modoExtrato"
                  value="conta"
                  checked={modoExtrato === "conta"}
                  onChange={(e) => setModoExtrato(e.target.value as "conta" | "importacao")}
                  className="bg-background border-border"
                />
                <span className="text-foreground">Conta Bancária (Open Finance)</span>
              </label>
              <label htmlFor="modo-importacao" className="flex items-center gap-2 cursor-pointer">
                <input
                  id="modo-importacao"
                  type="radio"
                  name="modoExtrato"
                  value="importacao"
                  checked={modoExtrato === "importacao"}
                  onChange={(e) => setModoExtrato(e.target.value as "conta" | "importacao")}
                  className="bg-background border-border"
                />
                <span className="text-foreground">Importação (CSV/OFX)</span>
              </label>
            </div>
          </div>

          {modoExtrato === "conta" && (
            <div>
              <label htmlFor="conta" className="block text-sm font-medium text-muted-foreground mb-1">
                Conta Bancária *
              </label>
              <select
                id="conta"
                value={selectedConta}
                onChange={(e) => setSelectedConta(e.target.value)}
                className="w-full p-2 border rounded bg-background border-border text-foreground"
              >
                <option value="">Selecione uma conta</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.banco} - {conta.conta}
                  </option>
                ))}
              </select>
            </div>
          )}

          {modoExtrato === "importacao" && (
            <div>
              <label htmlFor="importacao" className="block text-sm font-medium text-muted-foreground mb-1">
                Importação de Extrato *
              </label>
              <select
                id="importacao"
                value={selectedImportacao}
                onChange={(e) => setSelectedImportacao(e.target.value)}
                className="w-full p-2 border rounded bg-background border-border text-foreground"
              >
                <option value="">Selecione uma importação</option>
                {importacoes.map((importacao) => (
                  <option key={importacao.id} value={importacao.id}>
                    {importacao.nomeArquivo} ({importacao.tipo}) - {importacao.totalLinhas} lançamentos
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={handleIniciarConciliacao} disabled={loading}>
              {loading ? "Processando..." : "Iniciar Conciliação"}
            </Button>
          </motion.div>
        </div>
        </Card>
      </motion.div>

      {/* Tabela Comparativa */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Comparativo ERP x Extrato</h2>
            <Button
              variant={modoEdicao ? "default" : "outline"}
              size="sm"
              onClick={() => setModoEdicao(!modoEdicao)}
            >
              {modoEdicao ? (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Visualizar
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </>
              )}
            </Button>
          </div>

          {errorComparativo && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
              {errorComparativo}
            </div>
          )}

          <TabelaComparativaConciliacao
            linhas={linhas}
            modoEdicao={modoEdicao}
            filtros={filtros}
            onChangeFiltros={setFiltros}
            onAplicarFiltros={onAplicarFiltros}
            onSalvarErp={onSalvarErp}
            onSalvarExtrato={onSalvarExtrato}
            onDeletarErp={onDeletarErp}
            onDeletarExtrato={onDeletarExtrato}
            pagination={pagination}
            onPageChange={onPageChange}
            loading={loadingComparativo}
            empresaId={empresaId}
          />
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="hidden"
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Histórico de Conciliações</h2>
          {conciliacoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma conciliação realizada</p>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-foreground font-medium">Período</th>
                <th className="text-left p-2 text-foreground font-medium">Arquivo</th>
                <th className="text-left p-2 text-foreground font-medium">Status</th>
                <th className="text-left p-2 text-foreground font-medium">Conciliados</th>
                <th className="text-left p-2 text-foreground font-medium">Divergentes</th>
                <th className="text-left p-2 text-foreground font-medium">Faltando ERP</th>
                <th className="text-left p-2 text-foreground font-medium">Faltando Banco</th>
                <th className="text-left p-2 text-foreground font-medium">Data</th>
                <th className="text-left p-2 text-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {conciliacoes.map((conciliacao) => (
                <tr key={conciliacao.id} className="border-t border-border hover:bg-accent">
                  <td className="p-2 text-foreground">{conciliacao.periodo}</td>
                  <td className="p-2 text-foreground">{conciliacao.upload.nomeArquivo}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      conciliacao.status === "CONCLUIDA"
                        ? "bg-success/20 text-success"
                        : conciliacao.status === "PROCESSANDO"
                        ? "bg-brand/20 text-brand"
                        : "bg-destructive/20 text-destructive"
                    }`}>
                      {conciliacao.status}
                    </span>
                  </td>
                  <td className="p-2 text-foreground">{conciliacao.qtdConciliados}</td>
                  <td className="p-2 text-foreground">{conciliacao.qtdDivergentes}</td>
                  <td className="p-2 text-foreground">{conciliacao.qtdFaltandoErp}</td>
                  <td className="p-2 text-foreground">{conciliacao.qtdFaltandoBanco}</td>
                  <td className="p-2 text-foreground">
                    {new Date(conciliacao.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => router.push(`/conciliacoes/${conciliacao.id}`)}
                        variant="outline"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDeleteConfirm(conciliacao.id)}
                        variant="destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        </Card>
      </motion.div>

      {/* Animação de Sucesso */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-success/95 flex items-center justify-center z-50"
            onClick={() => setShowSuccessAnimation(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", damping: 15, stiffness: 200 }}
                className="mb-6"
              >
                <CheckCircle className="w-48 h-48 text-success mx-auto" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl font-bold text-foreground mb-4"
              >
                Conciliação Realizada!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-xl text-success"
              >
                Com Sucesso
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeletar(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja deletar esta conciliação? Esta ação não pode ser desfeita."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
