"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { motion } from "framer-motion"
import { Eye } from "lucide-react"

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
    } catch (error) {
      setError("Erro ao criar empresa")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <motion.h1 
        className="text-2xl font-bold text-white mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Empresas
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 mb-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Nova Empresa</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-300 mb-1">
              Nome *
            </label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Nome da empresa"
              className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
            />
          </div>

          <div>
            <label htmlFor="cnpj" className="block text-sm font-medium text-gray-300 mb-1">
              CNPJ (opcional)
            </label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={handleCNPJChange}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded animate-pulse">
              {error}
            </div>
          )}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-gray-200">
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
        <Card className="p-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Empresas Cadastradas</h2>
        {empresas.length === 0 ? (
          <p className="text-gray-500">Nenhuma empresa cadastrada</p>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left p-2 text-white font-medium">Nome</th>
                <th className="text-left p-2 text-white font-medium">CNPJ</th>
                <th className="text-left p-2 text-white font-medium">Data de Criação</th>
                <th className="text-left p-2 text-white font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2 text-gray-300">{empresa.nome}</td>
                  <td className="p-2 text-gray-300">{empresa.cnpj || "-"}</td>
                  <td className="p-2 text-gray-300">
                    {new Date(empresa.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/conciliacoes?empresaId=${empresa.id}`)}
                      variant="outline"
                      className="border-white/40 text-white hover:bg-white/20 hover:border-white/60"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        </Card>
      </motion.div>
    </div>
  )
}
