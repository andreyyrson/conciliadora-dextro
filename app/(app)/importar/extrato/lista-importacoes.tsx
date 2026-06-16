"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Trash2, FileText, Calendar } from "lucide-react"

export interface Importacao {
  id: string
  tipo: string
  nomeArquivo: string
  totalLinhas: number
  createdAt: string
}

interface ListaImportacoesProps {
  importacoes: Importacao[]
  loading: boolean
  onDelete: (id: string) => void
}

export function ListaImportacoes({ importacoes, loading, onDelete }: ListaImportacoesProps) {
  if (importacoes.length === 0) {
    return <p className="text-muted-foreground">Nenhuma importação encontrada</p>
  }

  return (
    <div className="space-y-4">
      {importacoes.map((importacao) => (
        <motion.div
          key={importacao.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-border rounded-lg bg-accent hover:bg-accent/80 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-brand" />
                <h3 className="font-semibold text-foreground">{importacao.nomeArquivo}</h3>
                <span className={`px-2 py-1 rounded text-xs ${
                  importacao.tipo === "CSV" ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                }`}>
                  {importacao.tipo}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(importacao.createdAt).toLocaleString("pt-BR")}
                </div>
                <div>{importacao.totalLinhas} lançamentos</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(importacao.id)}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
