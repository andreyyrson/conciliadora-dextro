"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { TabelaLancamentosImportados } from "../tabela-lancamentos"
import { FiltrosLancamentos } from "../filtros-lancamentos"
import { useLancamentos } from "../use-lancamentos"
import { ArrowLeft, Download, FileText } from "lucide-react"

interface ImportacaoInfo {
  id: string
  nomeArquivo: string
  tipo: string
  totalLinhas: number
  createdAt: string
}

export default function ImportacaoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const importacaoId = params.importacaoId as string

  const [importacao, setImportacao] = useState<ImportacaoInfo | null>(null)
  const [loadingImportacao, setLoadingImportacao] = useState(true)
  const [exportando, setExportando] = useState(false)

  const {
    lancamentos,
    pagination,
    filtros,
    setFiltros,
    loading: loadingLancamentos,
    modoEdicao,
    setModoEdicao,
    error: errorLancamentos,
    onPageChange,
    onSalvar,
    onDeletar,
    onAplicarFiltros,
    fetchLancamentos,
  } = useLancamentos({ empresaId, importacaoId })

  const fetchImportacao = useCallback(async () => {
    if (!importacaoId) return
    setLoadingImportacao(true)
    try {
      const res = await fetch(`/api/importacoes/${importacaoId}/lancamentos?limit=1`)
      const data = await res.json()
      if (data.importacao) {
        setImportacao(data.importacao)
      }
    } catch (err) {
      console.error("Erro ao buscar importação:", err)
    } finally {
      setLoadingImportacao(false)
    }
  }, [importacaoId])

  useEffect(() => {
    if (session && importacaoId) fetchImportacao()
  }, [session, importacaoId, fetchImportacao])

  const handleExportar = async () => {
    setExportando(true)
    try {
      const res = await fetch(`/api/importacoes/${importacaoId}/exportar`)
      if (!res.ok) throw new Error("Erro ao exportar")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const filename = importacao?.nomeArquivo
        ? `${importacao.nomeArquivo.replace(/\.[^.]+$/, "")}_lancamentos.xlsx`
        : "lancamentos.xlsx"
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Erro ao exportar:", err)
    } finally {
      setExportando(false)
    }
  }

  if (!session) return null

  if (!empresaId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          Selecione uma empresa no topo da página.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/importar")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {loadingImportacao ? (
          <div className="h-16 bg-accent/50 rounded-lg animate-pulse" />
        ) : importacao ? (
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-brand" />
                  <h1 className="text-xl font-semibold">{importacao.nomeArquivo}</h1>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    importacao.tipo === "CSV" ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                  }`}>
                    {importacao.tipo}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {importacao.totalLinhas} lançamentos • Importado em{" "}
                  {new Date(importacao.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportar}
                disabled={exportando}
              >
                <Download className="w-4 h-4 mr-1" />
                {exportando ? "Exportando..." : "Exportar Excel"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground">Importação não encontrada</p>
          </Card>
        )}
      </motion.div>

      {/* Tabela de Lançamentos */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Lançamentos</h2>
            <Button
              variant={modoEdicao ? "default" : "outline"}
              size="sm"
              onClick={() => setModoEdicao(!modoEdicao)}
            >
              {modoEdicao ? "Visualizar" : "Editar"}
            </Button>
          </div>

          <FiltrosLancamentos
            filtros={filtros}
            onChange={setFiltros}
            onAplicar={onAplicarFiltros}
            loading={loadingLancamentos}
          />

          {errorLancamentos && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mt-3">
              {errorLancamentos}
            </div>
          )}

          <div className="mt-4">
            <TabelaLancamentosImportados
              lancamentos={lancamentos}
              modoEdicao={modoEdicao}
              onSalvar={onSalvar}
              onDeletar={onDeletar}
              pagination={pagination}
              onPageChange={onPageChange}
              loading={loadingLancamentos}
            />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
