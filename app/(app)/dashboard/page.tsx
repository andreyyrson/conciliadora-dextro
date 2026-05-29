"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Building2, CheckCircle, Circle, ArrowRight, Plus, Play } from "lucide-react"

interface Empresa {
  id: string
  nome: string
  cnpj: string | null
}

interface EmpresaStatus {
  empresa: Empresa
  temContas: boolean
  qtdContas: number
  temUploads: boolean
  qtdUploads: number
  temImportacoes: boolean
  qtdImportacoes: number
  temConciliacoes: boolean
  qtdConciliacoes: number
  ultimaConciliacao: string | null
  podeIniciarConciliacao: boolean
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { empresaId, setEmpresa } = useEmpresa()
  const router = useRouter()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresasStatus, setEmpresasStatus] = useState<EmpresaStatus[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEmpresasComStatus = async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      const empresasData = data.empresas || []
      setEmpresas(empresasData)

      // Buscar status de cada empresa
      const statusPromises = empresasData.map(async (empresa: Empresa) => {
        const [contasRes, uploadsRes, importacoesRes, conciliacoesRes] = await Promise.all([
          fetch(`/api/contas?empresaId=${empresa.id}`),
          fetch(`/api/upload?empresaId=${empresa.id}`),
          fetch(`/api/importacoes?empresaId=${empresa.id}`),
          fetch(`/api/conciliacoes?empresaId=${empresa.id}`)
        ])

        const contas = await contasRes.json()
        const uploads = await uploadsRes.json()
        const importacoes = await importacoesRes.json()
        const conciliacoes = await conciliacoesRes.json()

        const temContas = (contas.contas || []).length > 0
        const temUploads = (uploads.uploads || []).length > 0
        const temImportacoes = (importacoes.importacoes || []).length > 0
        const temConciliacoes = (conciliacoes.conciliacoes || []).length > 0

        const podeIniciarConciliacao = temUploads && (temContas || temImportacoes)

        return {
          empresa,
          temContas,
          qtdContas: (contas.contas || []).length,
          temUploads,
          qtdUploads: (uploads.uploads || []).length,
          temImportacoes,
          qtdImportacoes: (importacoes.importacoes || []).length,
          temConciliacoes,
          qtdConciliacoes: (conciliacoes.conciliacoes || []).length,
          ultimaConciliacao: (conciliacoes.conciliacoes || [])[0]?.criadoEm || null,
          podeIniciarConciliacao
        }
      })

      const status = await Promise.all(statusPromises)
      setEmpresasStatus(status)
    } catch (error) {
      console.error("Erro ao buscar empresas com status:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEmpresasComStatus()
    }
  }, [session])

  const handleIniciarConciliacao = (empresaId: string) => {
    setEmpresa(empresaId)
    router.push("/conciliacoes")
  }

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Empresas</h2>
            <Button
              onClick={() => router.push("/empresas")}
              size="sm"
              className="bg-white text-black hover:bg-gray-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
          
          {loading ? (
            <p className="text-gray-500">Carregando...</p>
          ) : empresasStatus.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhuma empresa cadastrada</p>
              <Button onClick={() => router.push("/empresas")} className="bg-white text-black hover:bg-gray-200">
                Criar Primeira Empresa
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {empresasStatus.map((status, index) => (
                <motion.div
                  key={status.empresa.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    empresaId === status.empresa.id
                      ? "bg-white/10 border-white/40"
                      : "bg-black border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{status.empresa.nome}</h3>
                        {empresaId === status.empresa.id && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Selecionada</span>
                        )}
                      </div>
                      {status.empresa.cnpj && (
                        <p className="text-sm text-gray-400">{status.empresa.cnpj}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setEmpresa(status.empresa.id)}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Selecionar
                    </Button>
                  </div>

                  {/* Status de Configuração */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      {status.empresa.id ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={status.empresa.id ? "text-green-400" : "text-gray-500"}>
                        Empresa cadastrada
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temContas ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={status.temContas ? "text-green-400" : "text-gray-500"}>
                        Contas bancárias ({status.qtdContas})
                      </span>
                      {!status.temContas && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-blue-400 p-0 h-auto ml-auto"
                          onClick={() => router.push("/contas")}
                        >
                          Configurar
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temUploads ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={status.temUploads ? "text-green-400" : "text-gray-500"}>
                        Uploads ERP ({status.qtdUploads})
                      </span>
                      {!status.temUploads && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-blue-400 p-0 h-auto ml-auto"
                          onClick={() => router.push("/upload")}
                        >
                          Fazer Upload
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temImportacoes ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={status.temImportacoes ? "text-green-400" : "text-gray-500"}>
                        Importações de extrato ({status.qtdImportacoes})
                      </span>
                      {!status.temImportacoes && !status.temContas && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-blue-400 p-0 h-auto ml-auto"
                          onClick={() => router.push("/importacoes")}
                        >
                          Importar
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temConciliacoes ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600" />
                      )}
                      <span className={status.temConciliacoes ? "text-green-400" : "text-gray-500"}>
                        Conciliações realizadas ({status.qtdConciliacoes})
                      </span>
                    </div>
                  </div>

                  {/* Ação Principal */}
                  {status.podeIniciarConciliacao ? (
                    <Button
                      onClick={() => handleIniciarConciliacao(status.empresa.id)}
                      className="w-full bg-green-500 text-black hover:bg-green-400"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Conciliação
                    </Button>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-2">
                      Completete a configuração para iniciar conciliação
                    </div>
                  )}

                  {/* Estatísticas */}
                  {status.ultimaConciliacao && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
                      Última conciliação: {new Date(status.ultimaConciliacao).toLocaleString("pt-BR")}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Guia de Fluxo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 mt-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Fluxo de Conciliação</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-gray-300">Cadastrar empresa</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-gray-300">Configurar contas bancárias (Open Finance)</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-gray-300">Fazer upload do ERP (CSV/XLSX)</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">4</div>
              <span className="text-gray-300">Importar extrato bancário (CSV/OFX)</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">5</div>
              <span className="text-gray-300">Iniciar e revisar conciliação</span>
              <ArrowRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">6</div>
              <span className="text-gray-300">Exportar relatório em Excel</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
