"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Trash2, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react"
import type { FilaItem, ItemStatus } from "./use-upload-lote"

const statusLabel: Record<ItemStatus, string> = {
  pendente: "Pendente",
  analisando: "Analisando...",
  precisa_mapeamento: "Aguardando mapeamento",
  enviando: "Enviando...",
  ok: "Importado",
  erro: "Erro"
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-success" />
  if (status === "erro") return <AlertCircle className="w-4 h-4 text-destructive" />
  if (status === "enviando" || status === "analisando") return <Loader2 className="w-4 h-4 text-brand animate-spin" />
  return <Clock className="w-4 h-4 text-muted-foreground" />
}

interface UploadFilaProps {
  fila: FilaItem[]
  processando: boolean
  onAdicionar: (files: FileList) => void
  onRemover: (id: string) => void
  onConfirmar: () => void
  onLimpar: () => void
}

export function UploadFila({
  fila,
  processando,
  onAdicionar,
  onRemover,
  onConfirmar,
  onLimpar
}: UploadFilaProps) {
  const pendentes = fila.filter(i => i.status === "pendente").length

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="extratoFiles" className="block text-sm font-medium text-muted-foreground mb-1">
          Arquivos de extrato (OFX, QFX ou CSV) — selecione vários de uma vez
        </label>
        <Input
          id="extratoFiles"
          type="file"
          accept=".ofx,.qfx,.csv"
          multiple
          disabled={processando}
          onChange={(e) => {
            if (e.target.files?.length) {
              onAdicionar(e.target.files)
              e.target.value = ""
            }
          }}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Todos os extratos importados serão comparados em conjunto contra o ERP na tela de Conciliações.
        </p>
      </div>

      <AnimatePresence>
        {fila.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {fila.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border border-border rounded-lg bg-accent"
              >
                <FileText className="w-5 h-5 text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{item.file.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      item.tipo === "CSV" ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                    }`}>
                      {item.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <StatusIcon status={item.status} />
                    <span>{statusLabel[item.status]}</span>
                    {item.erro && <span className="text-destructive">— {item.erro}</span>}
                  </div>
                </div>
                {item.status === "pendente" && !processando && (
                  <Button size="sm" variant="ghost" onClick={() => onRemover(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {fila.length > 0 && (
        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={onConfirmar} disabled={processando || pendentes === 0}>
              {processando ? "Importando..." : `Importar ${pendentes > 0 ? `(${pendentes})` : "Todos"}`}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline" onClick={onLimpar} disabled={processando}>
              Limpar fila
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
