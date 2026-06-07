"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { motion } from "framer-motion"
import { Eye, Trash2 } from "lucide-react"

interface Empresa {
  id: string
  nome: string
  cnpj: string | null
  createdAt: string
}

export default function EmpresasPage() {
  const router = useRouter()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nome, setNome] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEmpresas = async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      setEmpresas(data.empresas || [])
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    }
  }

  useEffect(() => {
    fetchEmpresas()
  }, [])

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    const maxLength = 14
    
    if (numbers.length > maxLength) {
      return numbers.slice(0, maxLength)
    }
    
    let formatted = ""
    for (let i = 0; i < numbers.length; i++) {
      if (i === 2 || i === 5) {
        formatted += "."
      } else if (i === 8) {
        formatted += "/"
      } else if (i === 12) {
        formatted += "-"
      }
      formatted += numbers[i]
    }
    
    return formatted
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setCnpj(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nome, cnpj })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao criar empresa")
        return
      }

      setNome("")
      setCnpj("")
      fetchEmpresas()
    } catch {
      setError("Erro ao criar empresa")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (empresaId: string) => {
    setDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/empresas?empresaId=${empresaId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao deletar empresa")
        setDeleting(false)
        return
      }

      setDeleteConfirm(null)
      fetchEmpresas()
    } catch {
      setError("Erro ao deletar empresa")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Gerencie as empresas cadastradas"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Nova Empresa</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-muted-foreground mb-1">
              Nome *
            </label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <label htmlFor="cnpj" className="block text-sm font-medium text-muted-foreground mb-1">
              CNPJ (opcional)
            </label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={handleCNPJChange}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Empresa"}
            </Button>
          </motion.div>
        </form>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Empresas Cadastradas</h2>
        {empresas.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-foreground font-medium">Nome</th>
                <th className="text-left p-2 text-foreground font-medium">CNPJ</th>
                <th className="text-left p-2 text-foreground font-medium">Data de Criação</th>
                <th className="text-left p-2 text-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="border-t border-border hover:bg-accent">
                  <td className="p-2 text-foreground">{empresa.nome}</td>
                  <td className="p-2 text-foreground">{empresa.cnpj || "-"}</td>
                  <td className="p-2 text-foreground">
                    {new Date(empresa.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/conciliacoes?empresaId=${empresa.id}`)}
                          variant="outline"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          size="sm"
                          onClick={() => setDeleteConfirm(empresa.id)}
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        </Card>
      </motion.div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja deletar esta empresa? Esta ação irá deletar permanentemente: Todas as contas bancárias, Todos os uploads de ERP, Todas as importações de extrato, Todas as conciliações, Todos os lançamentos associados."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
