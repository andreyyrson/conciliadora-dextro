"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion } from "framer-motion"
import { Trash2, FileText, Calendar } from "lucide-react"

interface Importacao {
  id: string
  tipo: string
  nomeArquivo: string
  totalLinhas: number
  createdAt: string
  extratos: any[]
}

export default function ImportacoesPage() {
  const { data: session } = useSession()
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEmpresas = useCallback(async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      setEmpresas(data.empresas || [])
      if (data.empresas && data.empresas.length > 0) {
        setSelectedEmpresa(data.empresas[0].id)
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    }
  }, [])

  const fetchImportacoes = useCallback(async (empresaId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/importacoes?empresaId=${empresaId}`)
      const data = await response.json()
      setImportacoes(data.importacoes || [])
    } catch (error) {
      console.error("Erro ao buscar importações:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDeleteImportacao = async (importacaoId: string) => {
    setLoading(true)
    setDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/importacoes/${importacaoId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao excluir importação")
        setDeleting(false)
        return
      }

      setDeleteConfirm(null)
      fetchImportacoes(selectedEmpresa)
    } catch {
      setError("Erro ao excluir importação")
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEmpresas()
    }
  }, [session, fetchEmpresas])

  useEffect(() => {
    if (selectedEmpresa) {
      fetchImportacoes(selectedEmpresa)
    }
  }, [selectedEmpresa, fetchImportacoes])

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Importações de Extrato"
        description="Gerencie suas importações de arquivos CSV e OFX"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <div className="mb-4">
            <label htmlFor="empresa" className="block text-sm font-medium text-muted-foreground mb-1">
              Empresa *
            </label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="w-full p-2 border rounded bg-background border-border text-foreground"
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
              {error}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Importações Realizadas</h2>
          {importacoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma importação encontrada</p>
          ) : (
            <div className="space-y-4">
              {importacoes.map((importacao) => (
                <motion.div
                  key={importacao.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-border rounded-lg bg-accent hover:bg-accent/80 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-brand" />
                        <h3 className="font-semibold text-foreground">{importacao.nomeArquivo}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          importacao.tipo === "CSV" ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                        }`}>
                          {importacao.tipo}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(importacao.createdAt).toLocaleString("pt-BR")}
                        </div>
                        <div>
                          {importacao.totalLinhas} lançamentos
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirm(importacao.id)}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeleteImportacao(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja deletar esta importação? Esta ação irá deletar permanentemente todos os lançamentos associados a esta importação."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
