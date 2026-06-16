"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Zap, Check, AlertCircle, Loader2, Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useComparativo } from "./comparativo/use-comparativo"
import { TabelaComparativaConciliacao } from "./comparativo/tabela-comparativa"

function ComparativoPreview({ empresaId, periodo }: { empresaId: string | null; periodo?: string }) {
  const {
    linhas,
    pagination,
    filtros,
    setFiltros,
    loading,
    onPageChange,
    onSalvarErp,
    onDeletarErp,
    onDeletarExtrato,
    onAplicarFiltros,
    allLinhas,
    onAceitarDivergentes,
  } = useComparativo({ empresaId })

  // Ajustar filtros pelo período selecionado (yyyy-mm)
  React.useEffect(() => {
    if (!periodo) return
    const [y, m] = periodo.split("-")
    if (!y || !m) return
    const inicio = `${y}-${m}-01`
    const fimDate = new Date(Number(y), Number(m), 0) // último dia do mês
    const fim = fimDate.toISOString().split("T")[0]
    setFiltros((prev: any) => ({ ...prev, dataInicio: inicio, dataFim: fim }))
  }, [periodo, setFiltros])

  return (
    <TabelaComparativaConciliacao
      linhas={linhas}
      modoEdicao
      filtros={filtros as any}
      onChangeFiltros={setFiltros as any}
      onAplicarFiltros={onAplicarFiltros}
      onSalvarErp={onSalvarErp}
      // Extrato é somente delete
      onSalvarExtrato={async () => { /* no-op */ }}
      onDeletarErp={onDeletarErp}
      onDeletarExtrato={onDeletarExtrato}
      pagination={pagination as any}
      onPageChange={onPageChange}
      loading={loading}
      allLinhas={allLinhas}
      onAceitarDivergentes={onAceitarDivergentes}
    />
  )
}

interface UploadErp {
  id: string
  nomeArquivo: string
  periodo: string
  totalLinhas: number
  createdAt: string
}

interface ContaBancaria {
  id: string
  banco: string
  agencia: string
  conta: string
  ativa: boolean
}

interface ImportacaoExtrato {
  id: string
  nomeArquivo: string
  tipo: string
  periodo: string
  totalLinhas: number
  createdAt: string
}

interface ProcessamentoStatus {
  status: "idle" | "processing" | "completed" | "error"
  progress: number
  message: string
  conciliacaoId?: string
}

export function ProcessamentoLoteScreen() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const router = useRouter()
  const [uploadsErp, setUploadsErp] = useState<UploadErp[]>([])
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([])
  const [importacoesExtrato, setImportacoesExtrato] = useState<ImportacaoExtrato[]>([])
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set())
  const [selectedContas, setSelectedContas] = useState<Set<string>>(new Set())
  const [selectedImportacoes, setSelectedImportacoes] = useState<Set<string>>(new Set())
  const [periodo, setPeriodo] = useState("")
  const [processamentoStatus, setProcessamentoStatus] = useState<ProcessamentoStatus>({
    status: "idle",
    progress: 0,
    message: ""
  })

  const carregarDados = useCallback(async (empId: string) => {
    try {
      const [uploadsRes, contasRes, importacoesRes] = await Promise.all([
        fetch(`/api/upload?empresaId=${empId}`),
        fetch(`/api/contas?empresaId=${empId}`),
        fetch(`/api/importacoes?empresaId=${empId}`)
      ])

      if (uploadsRes.ok) {
        const uploadsData = await uploadsRes.json()
        setUploadsErp(uploadsData.uploads || [])
      }

      if (contasRes.ok) {
        const contasData = await contasRes.json()
        setContasBancarias(contasData.contas || [])
      }

      if (importacoesRes.ok) {
        const importacoesData = await importacoesRes.json()
        setImportacoesExtrato(importacoesData.importacoes || [])
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
    }
  }, [])

  useEffect(() => {
    if (empresaId) {
      carregarDados(empresaId)
    }
  }, [empresaId, carregarDados])

  const toggleUpload = (id: string) => {
    const newSelected = new Set(selectedUploads)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedUploads(newSelected)
  }

  const toggleConta = (id: string) => {
    const newSelected = new Set(selectedContas)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedContas(newSelected)
  }

  const toggleImportacao = (id: string) => {
    const newSelected = new Set(selectedImportacoes)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedImportacoes(newSelected)
  }

  const processarLote = async () => {
    if (selectedUploads.size === 0 || (selectedContas.size === 0 && selectedImportacoes.size === 0)) {
      alert("Selecione pelo menos um upload ERP e uma conta bancária ou importação de extrato")
      return
    }

    setProcessamentoStatus({
      status: "processing",
      progress: 0,
      message: "Iniciando processamento..."
    })

    try {
      const response = await fetch("/api/conciliacoes/processamento-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadIds: Array.from(selectedUploads),
          contaIds: Array.from(selectedContas),
          importacaoIds: Array.from(selectedImportacoes),
          periodo: periodo || new Date().toISOString().split('T')[0].substring(0, 7)
        })
      })

      const data = await response.json()

      if (response.ok) {
        setProcessamentoStatus({
          status: "completed",
          progress: 100,
          message: "Processamento concluído com sucesso!",
          conciliacaoId: data.conciliacaoId
        })

        setTimeout(() => {
          router.push(`/conciliacoes/${data.conciliacaoId}`)
        }, 2000)
      } else {
        setProcessamentoStatus({
          status: "error",
          progress: 0,
          message: data.error || "Erro ao processar lote"
        })
      }
    } catch {
      setProcessamentoStatus({
        status: "error",
        progress: 0,
        message: "Erro ao processar lote"
      })
    }
  }

  if (!session) {
    return null
  }

  if (!empresaId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          Selecione uma empresa no topo da página para processar em lote.
        </p>
      </Card>
    )
  }

  const [openPeriodo, setOpenPeriodo] = useState(false)

  return (
    <div className="space-y-6">
      {/* Seleção de Período */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Período</h3>
        <Popover open={openPeriodo} onOpenChange={setOpenPeriodo}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start w-[220px]" role="combobox">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {periodo ? `${periodo}` : "Selecionar mês"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-2">
            <Calendar
              mode="single"
              selected={periodo ? new Date(`${periodo}-01`) : undefined}
              onSelect={(date) => {
                if (date) {
                  const y = date.getFullYear()
                  const m = String(date.getMonth() + 1).padStart(2, "0")
                  setPeriodo(`${y}-${m}`)
                  setOpenPeriodo(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </Card>

      {/* Seleção de Uploads ERP */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Uploads ERP</h3>
        <div className="space-y-2">
          {uploadsErp.map((upload) => (
            <div
              key={upload.id}
              className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                selectedUploads.has(upload.id)
                  ? "bg-brand/20 border-brand"
                  : "bg-background border-border hover:bg-accent"
              }`}
              onClick={() => toggleUpload(upload.id)}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{upload.nomeArquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {upload.periodo} • {upload.totalLinhas} linhas
                </p>
              </div>
              {selectedUploads.has(upload.id) && (
                <Check className="text-brand" size={20} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Seleção de Contas Bancárias */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Contas Bancárias</h3>
        <div className="space-y-2">
          {contasBancarias.map((conta) => (
            <div
              key={conta.id}
              className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                selectedContas.has(conta.id)
                  ? "bg-brand/20 border-brand"
                  : "bg-background border-border hover:bg-accent"
              }`}
              onClick={() => toggleConta(conta.id)}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{conta.banco}</p>
                <p className="text-xs text-muted-foreground">
                  Ag: {conta.agencia} • CC: {conta.conta}
                </p>
              </div>
              {selectedContas.has(conta.id) && (
                <Check className="text-brand" size={20} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Seleção de Importações de Extrato */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Importações de Extrato</h3>
        <div className="space-y-2">
          {importacoesExtrato.map((importacao) => (
            <div
              key={importacao.id}
              className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                selectedImportacoes.has(importacao.id)
                  ? "bg-brand/20 border-brand"
                  : "bg-background border-border hover:bg-accent"
              }`}
              onClick={() => toggleImportacao(importacao.id)}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{importacao.nomeArquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {importacao.tipo} • {importacao.periodo} • {importacao.totalLinhas} linhas
                </p>
              </div>
              {selectedImportacoes.has(importacao.id) && (
                <Check className="text-brand" size={20} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Pré-visualização Comparativa ERP x Extrato (reutilizado) */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Pré-visualização Comparativa</h3>
        <ComparativoPreview empresaId={empresaId} periodo={periodo} />
      </Card>

      {/* Status do Processamento */}
      {processamentoStatus.status !== "idle" && (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            {processamentoStatus.status === "processing" && (
              <Loader2 className="animate-spin text-brand" size={24} />
            )}
            {processamentoStatus.status === "completed" && (
              <Check className="text-success" size={24} />
            )}
            {processamentoStatus.status === "error" && (
              <AlertCircle className="text-destructive" size={24} />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{processamentoStatus.message}</p>
              {processamentoStatus.status === "processing" && (
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div
                    className="bg-brand h-2 rounded-full transition-all"
                    style={{ width: `${processamentoStatus.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Botão de Processamento */}
      <Button
        onClick={processarLote}
        disabled={processamentoStatus.status === "processing"}
        className="w-full"
        size="lg"
      >
        {processamentoStatus.status === "processing" ? (
          <>
            <Loader2 className="animate-spin mr-2" size={20} />
            Processando...
          </>
        ) : (
          <>
            <Zap className="mr-2" size={20} />
            Processar em Lote
          </>
        )}
      </Button>
    </div>
  )
}
