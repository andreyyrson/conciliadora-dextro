"use client"

import { MapeamentoColunas } from "@/components/mapeamento-colunas"
import { motion, AnimatePresence } from "framer-motion"
import type { FilaItem } from "./use-upload-lote"

interface MapeamentoCsvModalProps {
  item: FilaItem | null
  onConfirmar: (mapeamento: { [campo: string]: string | null }) => void
  onCancelar: () => void
}

export function MapeamentoCsvModal({ item, onConfirmar, onCancelar }: MapeamentoCsvModalProps) {
  return (
    <AnimatePresence>
      {item && item.analiseCsv && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="bg-card border border-border rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
          >
            <h3 className="text-lg font-semibold mb-1">Mapear colunas — {item.file.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível detectar automaticamente todas as colunas deste CSV. Revise o mapeamento abaixo.
            </p>
            <MapeamentoColunas
              colunas={item.analiseCsv.colunas}
              mapeamento={item.analiseCsv.mapeamento}
              preview={item.analiseCsv.preview}
              colunasNaoMapeadas={item.analiseCsv.colunasNaoMapeadas}
              confianca={item.analiseCsv.confianca}
              mapeamentoSalvo={item.analiseCsv.mapeamentoSalvo}
              onConfirmar={onConfirmar}
              onCancelar={onCancelar}
              tipo="EXTRATO"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
