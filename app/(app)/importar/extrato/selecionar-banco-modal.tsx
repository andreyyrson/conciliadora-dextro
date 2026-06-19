"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { listarBancos } from "@/lib/bancos/detectar-banco"
import { Button } from "@/components/ui/button"

interface SelecionarBancoModalProps {
  importacaoId: string | null
  fileName: string | null
  onConfirmar: (banco: string) => void
  onCancelar: () => void
}

export function SelecionarBancoModal({ importacaoId, fileName, onConfirmar, onCancelar }: SelecionarBancoModalProps) {
  const [bancoSelecionado, setBancoSelecionado] = useState("")
  const bancos = listarBancos()

  const aberto = !!importacaoId && !!fileName

  return (
    <AnimatePresence>
      {aberto && (
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
            className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-semibold mb-1">Atribuir Banco</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível detectar o banco automaticamente no arquivo <strong>{fileName}</strong>.
              Selecione o banco correspondente:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Banco</label>
                <select
                  value={bancoSelecionado}
                  onChange={(e) => setBancoSelecionado(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecionar banco...</option>
                  {bancos.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onCancelar}>
                  Cancelar
                </Button>
                <Button
                  disabled={!bancoSelecionado}
                  onClick={() => {
                    if (bancoSelecionado) {
                      onConfirmar(bancoSelecionado)
                      setBancoSelecionado("")
                    }
                  }}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
