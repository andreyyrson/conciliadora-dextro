"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"

interface Empresa {
  id: string
  nome: string
  cnpj: string | null
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { empresaId, setEmpresa } = useEmpresa()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEmpresas = async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      setEmpresas(data.empresas || [])
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmpresas()
  }, [])

  if (!session) {
    return null
  }

  return (
    <div>
      <motion.h1 
        className="text-2xl font-bold text-white mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Dashboard
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 mb-6 bg-black border border-white/20">
          <p className="text-gray-300">
            Bem-vindo, {session.user?.name || session.user?.email}!
          </p>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Selecionar Empresa</h2>
          
          {loading ? (
            <p className="text-gray-500">Carregando...</p>
          ) : empresas.length === 0 ? (
            <div className="space-y-2">
              <p className="text-gray-500">Nenhuma empresa cadastrada</p>
              <Button onClick={() => window.location.href = "/empresas"} className="bg-white text-black hover:bg-gray-200">
                Criar Empresa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {empresas.map((empresa, index) => (
                <motion.button
                  key={empresa.id}
                  onClick={() => setEmpresa(empresa.id)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    empresaId === empresa.id
                      ? "bg-white text-black border-white"
                      : "bg-black border-white/20 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <div className="font-medium">{empresa.nome}</div>
                  {empresa.cnpj && (
                    <div className="text-sm text-gray-400">{empresa.cnpj}</div>
                  )}
                </motion.button>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => window.location.href = "/empresas"}
                    className="w-full mt-4 bg-white text-black hover:bg-gray-200"
                  >
                    + Nova Empresa
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          )}
        </Card>
      </motion.div>

      {empresaId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 mt-6 bg-black border border-white/20">
            <h2 className="text-lg font-semibold mb-2 text-white">Status do Sistema</h2>
            <p className="text-sm text-gray-300">
              Empresa selecionada. Pronto para configurar contas bancárias e iniciar conciliações.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Módulo 3 - Gestão de Empresas concluído. Pronto para o Módulo 4.
            </p>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
