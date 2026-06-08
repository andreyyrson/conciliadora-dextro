"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
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
  const [empresasStatus, setEmpresasStatus] = useState<EmpresaStatus[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEmpresasComStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      const empresasData = data.empresas || []

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
  }, [])

  useEffect(() => {
    if (session) {
      fetchEmpresasComStatus()
    }
  }, [session, fetchEmpresasComStatus])

  const handleIniciarConciliacao = (empresaId: string) => {
    setEmpresa(empresaId)
    router.push("/conciliacoes")
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral das empresas e conciliações"
        actions={
          <Button
            onClick={() => router.push("/empresas")}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <p className="text-muted-foreground">
            Bem-vindo, {session.user?.name || session.user?.email}!
          </p>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Empresas</h2>
          
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : empresasStatus.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Nenhuma empresa cadastrada</p>
              <Button onClick={() => router.push("/empresas")}>
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
                      ? "bg-accent border-brand"
                      : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{status.empresa.nome}</h3>
                        {empresaId === status.empresa.id && (
                          <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded">Selecionada</span>
                        )}
                      </div>
                      {status.empresa.cnpj && (
                        <p className="text-sm text-muted-foreground">{status.empresa.cnpj}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setEmpresa(status.empresa.id)}
                      variant="outline"
                    >
                      Selecionar
                    </Button>
                  </div>

                  {/* Status de Configuração */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      {status.empresa.id ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={status.empresa.id ? "text-success" : "text-muted-foreground"}>
                        Empresa cadastrada
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temContas ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={status.temContas ? "text-success" : "text-muted-foreground"}>
                        Contas bancárias Open Finance ({status.qtdContas})
                      </span>
                      {!status.temContas && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-brand p-0 h-auto ml-auto"
                          onClick={() => router.push("/contas")}
                        >
                          Configurar
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temUploads ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={status.temUploads ? "text-success" : "text-muted-foreground"}>
                        Uploads ERP ({status.qtdUploads})
                      </span>
                      {!status.temUploads && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-brand p-0 h-auto ml-auto"
                          onClick={() => router.push("/upload")}
                        >
                          Fazer Upload
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temImportacoes ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={status.temImportacoes ? "text-success" : "text-muted-foreground"}>
                        Importações de extrato CSV/OFX ({status.qtdImportacoes})
                      </span>
                      {!status.temImportacoes && !status.temContas && (
                        <Button
                          size="sm"
                          variant="link"
                          className="text-brand p-0 h-auto ml-auto"
                          onClick={() => router.push("/importacoes")}
                        >
                          Importar
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {status.temConciliacoes ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={status.temConciliacoes ? "text-success" : "text-muted-foreground"}>
                        Conciliações realizadas ({status.qtdConciliacoes})
                      </span>
                    </div>
                  </div>

                  {/* Ação Principal */}
                  {status.podeIniciarConciliacao ? (
                    <Button
                      onClick={() => handleIniciarConciliacao(status.empresa.id)}
                      className="w-full bg-success text-background hover:bg-success/90"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Conciliação
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Completete a configuração para iniciar conciliação
                    </div>
                  )}

                  {/* Estatísticas */}
                  {status.ultimaConciliacao && (
                    <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
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
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Fluxo de Conciliação</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-foreground">Cadastrar empresa</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-foreground">Configurar contas bancárias via Open Finance (opcional)</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-foreground">Fazer upload do ERP (CSV/XLSX)</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">4</div>
              <span className="text-foreground">Importar extrato bancário via Open Finance OU CSV/OFX</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">5</div>
              <span className="text-foreground">Iniciar e revisar conciliação</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">6</div>
              <span className="text-foreground">Exportar relatório em Excel</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            <p>💡 Você pode usar Open Finance para extrato automático OU importar manualmente via CSV/OFX</p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
