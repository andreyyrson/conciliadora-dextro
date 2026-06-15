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
import { motion, AnimatePresence } from "framer-motion"
import { Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import Link from "next/link"

export interface LancamentoImportado {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
  identificador: string | null
  banco: string | null
  saldoApos: number | null
  importacao?: { nomeArquivo: string; tipo: string }
}

interface TabelaLancamentosProps {
  lancamentos: LancamentoImportado[]
  modoEdicao: boolean
  onSalvar: (id: string, dados: Partial<LancamentoImportado>) => Promise<void>
  onDeletar: (id: string) => Promise<void>
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

export function TabelaLancamentosImportados({
  lancamentos,
  modoEdicao,
  onSalvar,
  onDeletar,
  pagination,
  onPageChange,
  loading,
}: TabelaLancamentosProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<LancamentoImportado>>({})
  const [salvando, setSalvando] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deletando, setDeletando] = useState(false)

  const iniciarEdicao = (l: LancamentoImportado) => {
    setEditandoId(l.id)
    setForm({
      data: l.data.split("T")[0],
      descricao: l.descricao,
      valor: l.valor,
      tipo: l.tipo,
      identificador: l.identificador || "",
      banco: l.banco || "",
      saldoApos: l.saldoApos ?? undefined,
    })
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setForm({})
  }

  const salvar = async (id: string) => {
    setSalvando(true)
    try {
      await onSalvar(id, form)
      setEditandoId(null)
      setForm({})
    } finally {
      setSalvando(false)
    }
  }

  const handleDeletar = async (id: string) => {
    setDeletando(true)
    try {
      await onDeletar(id)
      setDeleteConfirm(null)
    } finally {
      setDeletando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="w-[110px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[120px] text-right">Valor</TableHead>
              <TableHead className="w-[80px]">Tipo</TableHead>
              <TableHead className="w-[140px]">Identificador</TableHead>
              <TableHead className="w-[120px]">Banco</TableHead>
              {lancamentos.some(l => l.importacao) && (
                <TableHead className="w-[180px]">Arquivo</TableHead>
              )}
              {modoEdicao && <TableHead className="w-[100px] text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {lancamentos.map((l) => {
                const isEditando = editandoId === l.id
                return (
                  <motion.tr
                    key={l.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-border hover:bg-accent/50 transition-colors"
                  >
                    <TableCell>
                      {isEditando ? (
                        <Input
                          type="date"
                          value={String(form.data || "")}
                          onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm">{formatarData(l.data)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditando ? (
                        <Input
                          value={String(form.descricao || "")}
                          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm">{l.descricao}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditando ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={String(form.valor ?? "")}
                          onChange={(e) => setForm((f) => ({ ...f, valor: parseFloat(e.target.value) }))}
                          className="h-8 text-sm text-right"
                        />
                      ) : (
                        <span className={`text-sm font-medium ${l.tipo === "DEBITO" ? "text-red-500" : "text-green-500"}`}>
                          R$ {formatarValor(l.valor)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditando ? (
                        <Select
                          value={String(form.tipo || "")}
                          onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                        >
                          <SelectTrigger className="h-8 text-sm w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEBITO">DÉBITO</SelectItem>
                            <SelectItem value="CREDITO">CRÉDITO</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded ${l.tipo === "DEBITO" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}>
                          {l.tipo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditando ? (
                        <Input
                          value={String(form.identificador ?? "")}
                          onChange={(e) => setForm((f) => ({ ...f, identificador: e.target.value || null }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{l.identificador || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditando ? (
                        <Input
                          value={String(form.banco ?? "")}
                          onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value || null }))}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{l.banco || "—"}</span>
                      )}
                    </TableCell>
                    {l.importacao && (
                      <TableCell>
                        <Link
                          href={`/importar/extrato/${l.id.split("-")[0]}`}
                          className="flex items-center gap-1 text-sm text-brand hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[140px]" title={l.importacao.nomeArquivo}>
                            {l.importacao.nomeArquivo}
                          </span>
                        </Link>
                      </TableCell>
                    )}
                    {modoEdicao && (
                      <TableCell className="text-right">
                        {isEditando ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => salvar(l.id)}
                              disabled={salvando}
                              className="h-7 w-7 p-0"
                            >
                              <Save className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelarEdicao}
                              disabled={salvando}
                              className="h-7 w-7 p-0"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => iniciarEdicao(l)}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(l.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </motion.tr>
                )
              })}
            </AnimatePresence>
            {lancamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={modoEdicao ? 8 : 7} className="text-center text-muted-foreground py-8">
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
            Mostrando {(pagination.page - 1) * pagination.limit + 1} a{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeletar(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        loading={deletando}
        danger
      />
    </div>
  )
}
