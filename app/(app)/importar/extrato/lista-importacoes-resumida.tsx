"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Trash2, FileText, Calendar, ExternalLink } from "lucide-react"
import Link from "next/link"

export interface ImportacaoResumo {
  id: string
  tipo: string
  nomeArquivo: string
  totalLinhas: number
  createdAt: string
}

interface ListaImportacoesResumidaProps {
  importacoes: ImportacaoResumo[]
  loading: boolean
  onDelete: (id: string) => void
}

export function ListaImportacoesResumida({ importacoes, loading, onDelete }: ListaImportacoesResumidaProps) {
  if (importacoes.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma importação realizada</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {importacoes.map((importacao) => (
        <motion.div
          key={importacao.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 border border-border rounded-lg bg-accent hover:bg-accent/80 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                <span className="font-medium text-sm truncate" title={importacao.nomeArquivo}>
                  {importacao.nomeArquivo}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  importacao.tipo === "CSV" ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                }`}>
                  {importacao.tipo}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(importacao.createdAt).toLocaleDateString("pt-BR")}
                </div>
                <div>{importacao.totalLinhas} lançamentos</div>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Link
                href={`/importar/extrato/${importacao.id}`}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Ver detalhes"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(importacao.id)}
                disabled={loading}
                className="h-7 w-7 p-0"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
