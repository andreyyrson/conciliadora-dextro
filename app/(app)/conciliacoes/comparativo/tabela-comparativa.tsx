"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion } from "framer-motion"
import { Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react"
import type { ErpLancamento, ExtratoLancamento, LinhaComparativa } from "./use-comparativo"

interface FiltrosComparativo {
  search: string
  tipo: string
  dataInicio: string
  dataFim: string
  status: string
}

interface TabelaComparativaProps {
  linhas: LinhaComparativa[]
  modoEdicao: boolean
  filtros: FiltrosComparativo
  onChangeFiltros: (f: FiltrosComparativo) => void
  onAplicarFiltros: () => void
  onSalvarErp: (id: string, dados: Partial<ErpLancamento>) => Promise<void>
  onSalvarExtrato: (id: string, dados: Partial<ExtratoLancamento>) => Promise<void>
  onDeletarErp: (id: string) => Promise<void>
  onDeletarExtrato: (id: string) => Promise<void>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onPageChange: (page: number) => void
  loading?: boolean
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarData(dataStr: string): string {
  const d = new Date(dataStr)
  return d.toLocaleDateString("pt-BR")
}

function statusBadge(status: LinhaComparativa["status"]) {
  switch (status) {
    case "match":
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">✓</span>
    case "divergente":
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">≠</span>
    case "sobra_erp":
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">ERP</span>
    case "sobra_extrato":
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">EXT</span>
  }
}

function statusRowBg(status: LinhaComparativa["status"]) {
  switch (status) {
    case "match":
      return "bg-green-500/5"
    case "divergente":
      return "bg-yellow-500/5"
    case "sobra_erp":
      return "bg-blue-500/5"
    case "sobra_extrato":
      return "bg-purple-500/5"
  }
}

export function TabelaComparativaConciliacao({
  linhas,
  modoEdicao,
  filtros,
  onChangeFiltros,
  onAplicarFiltros,
  onSalvarErp,
  onSalvarExtrato,
  onDeletarErp,
  onDeletarExtrato,
  pagination,
  onPageChange,
  loading,
}: TabelaComparativaProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoLado, setEditandoLado] = useState<"erp" | "extrato" | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [salvando, setSalvando] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; lado: "erp" | "extrato" } | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false)

  const iniciarEdicao = (id: string, lado: "erp" | "extrato", item: ErpLancamento | ExtratoLancamento) => {
    setEditandoId(id)
    setEditandoLado(lado)
    setForm({
      data: item.data.split("T")[0],
      descricao: item.descricao,
      valor: item.valor,
      tipo: item.tipo,
      ...(lado === "erp"
        ? {
            documento: (item as ErpLancamento).documento || "",
            fornecedor: (item as ErpLancamento).fornecedor || "",
            categoria: (item as ErpLancamento).categoria || "",
            banco: (item as ErpLancamento).banco || "",
          }
        : {
            identificador: (item as ExtratoLancamento).identificador || "",
            banco: (item as ExtratoLancamento).banco || "",
            saldoApos: (item as ExtratoLancamento).saldoApos ?? undefined,
          }),
    })
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setEditandoLado(null)
    setForm({})
  }

  const salvar = async () => {
    if (!editandoId || !editandoLado) return
    setSalvando(true)
    try {
      if (editandoLado === "erp") {
        await onSalvarErp(editandoId, form)
      } else {
        await onSalvarExtrato(editandoId, form)
      }
      setEditandoId(null)
      setEditandoLado(null)
      setForm({})
    } finally {
      setSalvando(false)
    }
  }

  const handleDeletar = async () => {
    if (!deleteConfirm) return
    setDeletando(true)
    try {
      if (deleteConfirm.lado === "erp") {
        await onDeletarErp(deleteConfirm.id)
      } else {
        await onDeletarExtrato(deleteConfirm.id)
      }
      setDeleteConfirm(null)
    } finally {
      setDeletando(false)
    }
  }

  const temFiltros = filtros.search || filtros.tipo || filtros.dataInicio || filtros.dataFim || filtros.status

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em descrição, documento, fornecedor, identificador..."
              value={filtros.search}
              onChange={(e) => onChangeFiltros({ ...filtros, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && onAplicarFiltros()}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltrosExpandidos(!filtrosExpandidos)}
            className={temFiltros ? "border-brand text-brand" : ""}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filtros
            {temFiltros && <span className="ml-1 w-2 h-2 rounded-full bg-brand" />}
          </Button>
          <Button size="sm" onClick={onAplicarFiltros} disabled={loading}>
            Buscar
          </Button>
        </div>

        {filtrosExpandidos && (
          <div className="p-3 border border-border rounded-lg bg-accent/50 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={filtros.tipo} onValueChange={(v) => onChangeFiltros({ ...filtros, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="DEBITO">Débito</SelectItem>
                  <SelectItem value="CREDITO">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={filtros.status} onValueChange={(v) => onChangeFiltros({ ...filtros, status: v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="match">Match</SelectItem>
                  <SelectItem value="divergente">Divergente</SelectItem>
                  <SelectItem value="sobra_erp">Sobra ERP</SelectItem>
                  <SelectItem value="sobra_extrato">Sobra Extrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data início</label>
              <Input type="date" value={filtros.dataInicio} onChange={(e) => onChangeFiltros({ ...filtros, dataInicio: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data fim</label>
              <Input type="date" value={filtros.dataFim} onChange={(e) => onChangeFiltros({ ...filtros, dataFim: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {/* Tabela comparativa */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead colSpan={modoEdicao ? 6 : 5} className="text-center bg-blue-500/5 border-l border-r border-border">
                ERP do Sistema
              </TableHead>
              <TableHead colSpan={modoEdicao ? 7 : 6} className="text-center bg-purple-500/5">
                Extrato Bancário
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs">Fornecedor</TableHead>
              {modoEdicao && <TableHead className="text-xs text-right">Ações</TableHead>}
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Data (Extrato)</TableHead>
              <TableHead className="text-xs">Identificador</TableHead>
              <TableHead className="text-xs">Banco</TableHead>
              {modoEdicao && <TableHead className="text-xs text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => {
              const erpEditando = modoEdicao && editandoId === linha.erp?.id && editandoLado === "erp"
              const extEditando = false
              return (
                <TableRow key={`${linha.data}-${linha.erp?.id || ""}-${linha.extrato?.id || ""}`} className={`border-b border-border ${statusRowBg(linha.status)}`}>
                  <TableCell className="py-2">{statusBadge(linha.status)}</TableCell>
                  <TableCell className="py-2 text-sm whitespace-nowrap">{formatarData(linha.data)}</TableCell>

                  {/* Colunas ERP */}
                  {linha.erp ? (
                    <>
                      <TableCell className="py-2 text-sm border-l border-border">
                        {erpEditando ? (
                          <Input value={String(form.descricao || "")} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} className="h-7 text-sm" />
                        ) : (
                          <span className="truncate max-w-[160px] inline-block" title={linha.erp.descricao}>{linha.erp.descricao}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-right">
                        {erpEditando ? (
                          <Input type="number" step="0.01" value={String(form.valor ?? "")} onChange={(e) => setForm((f) => ({ ...f, valor: parseFloat(e.target.value) }))} className="h-7 text-sm text-right" />
                        ) : (
                          <span className={`font-medium ${linha.erp.tipo === "DEBITO" ? "text-red-500" : "text-green-500"}`}>R$ {formatarValor(linha.erp.valor)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {erpEditando ? (
                          <Select value={String(form.tipo || "")} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                            <SelectTrigger className="h-7 text-xs w-[80px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DEBITO">DÉBITO</SelectItem>
                              <SelectItem value="CREDITO">CRÉDITO</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${linha.erp.tipo === "DEBITO" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}>{linha.erp.tipo}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {erpEditando ? (
                          <Input value={String(form.documento ?? "")} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value || null }))} className="h-7 text-sm" />
                        ) : (
                          linha.erp.documento || "—"
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {erpEditando ? (
                          <Input value={String(form.fornecedor ?? "")} onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value || null }))} className="h-7 text-sm" />
                        ) : (
                          linha.erp.fornecedor || "—"
                        )}
                      </TableCell>
                      {modoEdicao && (
                        <TableCell className="py-2 text-right border-r border-border">
                          {erpEditando ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={salvar} disabled={salvando} className="h-6 w-6 p-0"><Save className="w-3.5 h-3.5 text-green-500" /></Button>
                              <Button size="sm" variant="ghost" onClick={cancelarEdicao} disabled={salvando} className="h-6 w-6 p-0"><X className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(linha.erp!.id, "erp", linha.erp!)} className="h-6 w-6 p-0"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ id: linha.erp!.id, lado: "erp" })} className="h-6 w-6 p-0"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </>
                  ) : (
                    <>
                      <TableCell colSpan={modoEdicao ? 6 : 5} className="py-2 text-center text-muted-foreground text-xs border-l border-r border-border">
                        — Sem correspondência ERP —
                      </TableCell>
                    </>
                  )}

                  {/* Colunas Extrato */}
                  {linha.extrato ? (
                    <>
                      <TableCell className="py-2 text-sm">
                        <span className="truncate max-w-[160px] inline-block" title={linha.extrato.descricao}>{linha.extrato.descricao}</span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-right">
                        <span className={`font-medium ${linha.extrato.tipo === "DEBITO" ? "text-red-500" : "text-green-500"}`}>R$ {formatarValor(linha.extrato.valor)}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${linha.extrato.tipo === "DEBITO" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}>{linha.extrato.tipo}</span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {formatarData(linha.extrato.data)}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {linha.extrato.identificador || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {linha.extrato.banco || "—"}
                      </TableCell>
                      {modoEdicao && (
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ id: linha.extrato!.id, lado: "extrato" })} className="h-6 w-6 p-0"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </>
                  ) : (
                    <>
                      <TableCell colSpan={modoEdicao ? 7 : 6} className="py-2 text-center text-muted-foreground text-xs">
                        — Sem correspondência Extrato —
                      </TableCell>
                    </>
                  )}
                </TableRow>
              )
            })}
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={modoEdicao ? 15 : 13} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1 || loading}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">{pagination.page} / {pagination.totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || loading}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeletar}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este lançamento?"
        confirmText="Excluir"
        loading={deletando}
        danger
      />
    </div>
  )
}
