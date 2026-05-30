"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, FileText, Calendar, AlertTriangle } from "lucide-react"

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
  const { empresaId } = useEmpresa()
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEmpresas = async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      console.log("Empresas recebidas (importacoes):", data)
      setEmpresas(data.empresas || [])
      if (data.empresas && data.empresas.length > 0) {
        setSelectedEmpresa(data.empresas[0].id)
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    }
  }

  const fetchImportacoes = async (empresaId: string) => {
    try {
      const response = await fetch(`/api/importacoes?empresaId=${empresaId}`)
      const data = await response.json()
      setImportacoes(data.importacoes || [])
    } catch (error) {
      console.error("Erro ao buscar importações:", error)
    }
  }

  const handleDeleteImportacao = async (importacaoId: string) => {
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
    } catch (error) {
      setError("Erro ao excluir importação")
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEmpresas()
    }
  }, [session])

  useEffect(() => {
    if (selectedEmpresa) {
      fetchImportacoes(selectedEmpresa)
    }
  }, [selectedEmpresa])

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white mb-2">Importações de Extrato</h1>
        <p className="text-gray-400">Gerencie suas importações de arquivos CSV e OFX</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 bg-black border border-white/20">
          <div className="mb-4">
            <label htmlFor="empresa" className="block text-sm font-medium text-gray-300 mb-1">
              Empresa *
            </label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="w-full p-2 border rounded bg-black border-white/20 text-white"
            >
              <option value="">Selecione uma empresa</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded animate-pulse mb-4">
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
        <Card className="p-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Importações Realizadas</h2>
          {importacoes.length === 0 ? (
            <p className="text-gray-500">Nenhuma importação encontrada</p>
          ) : (
            <div className="space-y-4">
              {importacoes.map((importacao) => (
                <motion.div
                  key={importacao.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-white">{importacao.nomeArquivo}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          importacao.tipo === "CSV" ? "bg-green-900/30 text-green-400" : "bg-purple-900/30 text-purple-400"
                        }`}>
                          {importacao.tipo}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
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
                      variant="outline"
                      onClick={() => setDeleteConfirm(importacao.id)}
                      disabled={loading}
                      className="border-red-500/50 text-red-400 hover:bg-red-900/20"
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

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-black border border-white/20 rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Confirmar Exclusão</h3>
              </div>
              
              <p className="text-gray-300 mb-2">
                Tem certeza que deseja deletar esta importação?
              </p>
              <p className="text-sm text-red-400 mb-6">
                Esta ação irá deletar permanentemente todos os lançamentos associados a esta importação.
              </p>
              
              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={() => setDeleteConfirm(null)}
                    variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={() => handleDeleteImportacao(deleteConfirm)}
                    className="w-full bg-red-600 text-white hover:bg-red-700"
                    disabled={deleting}
                  >
                    {deleting ? "Deletando..." : "Confirmar Exclusão"}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
