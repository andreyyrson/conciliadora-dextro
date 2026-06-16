"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckSquare, Square } from "lucide-react"
import type { LinhaComparativa } from "./use-comparativo"

interface ModalAceitarARevisarProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  divergentes: LinhaComparativa[]
  onConfirmar: (ids: string[]) => void
}

function formatarValor(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarData(s: string) {
  return new Date(s).toLocaleDateString("pt-BR")
}

export function ModalAceitarARevisar({ open, onOpenChange, divergentes, onConfirmar }: ModalAceitarARevisarProps) {
  const ids = useMemo(() => divergentes.map(l => l.erp?.id || l.extrato?.id || ""), [divergentes])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(ids))

  useEffect(() => {
    if (open) setSelecionados(new Set(ids))
  }, [open]) // reset selection every time modal opens

  const todos = selecionados.size === ids.length && ids.length > 0

  function toggleTodos() {
    if (todos) setSelecionados(new Set())
    else setSelecionados(new Set(ids))
  }

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirmar() {
    onConfirmar(Array.from(selecionados))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aceitar itens &ldquo;A Revisar&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          Selecione quais pares com divergência deseja aceitar como conciliados.
          <span className="ml-2 font-medium text-foreground">{selecionados.size}/{ids.length} selecionados</span>
        </div>

        {/* Cabeçalho da lista */}
        <div className="border-b border-border pb-2 mb-1 grid grid-cols-[32px_1fr_1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
          <button onClick={toggleTodos} className="flex items-center justify-center">
            {todos ? <CheckSquare className="w-4 h-4 text-brand" /> : <Square className="w-4 h-4" />}
          </button>
          <span>ERP</span>
          <span>Extrato</span>
          <span className="text-right">Valor ERP</span>
          <span className="text-right">Valor Ext.</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {divergentes.map((l, i) => {
            const id = ids[i]
            const checked = selecionados.has(id)
            return (
              <div
                key={id || i}
                onClick={() => toggle(id)}
                className={`grid grid-cols-[32px_1fr_1fr_auto_auto] gap-2 items-center rounded-lg px-1 py-2 cursor-pointer transition-colors text-sm ${checked ? "bg-yellow-500/10" : "hover:bg-accent"}`}
              >
                <span className="flex items-center justify-center">
                  {checked
                    ? <CheckSquare className="w-4 h-4 text-yellow-500" />
                    : <Square className="w-4 h-4 text-muted-foreground" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.erp?.descricao || "—"}</p>
                  <p className="text-xs text-muted-foreground">{l.erp ? formatarData(l.erp.data) : "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.extrato?.descricao || "—"}</p>
                  <p className="text-xs text-muted-foreground">{l.extrato ? formatarData(l.extrato.data) : "—"}</p>
                </div>
                <span className="text-right tabular-nums whitespace-nowrap">
                  {l.erp ? formatarValor(l.erp.valor) : "—"}
                </span>
                <span className="text-right tabular-nums whitespace-nowrap">
                  {l.extrato ? formatarValor(l.extrato.valor) : "—"}
                </span>
              </div>
            )
          })}
          {divergentes.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item &ldquo;A Revisar&rdquo; encontrado.</p>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={selecionados.size === 0}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            Aceitar {selecionados.size > 0 ? `(${selecionados.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
