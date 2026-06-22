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
  const [submitting, setSubmitting] = useState(false)
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
                <Button variant="outline" onClick={onCancelar} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  disabled={!bancoSelecionado || submitting}
                  onClick={async () => {
                    if (!bancoSelecionado || submitting) return
                    try {
                      setSubmitting(true)
                      await Promise.resolve(onConfirmar(bancoSelecionado))
                      setBancoSelecionado("")
                    } catch (e) {
                      // feedback simples; ideal: toast centralizado
                      window.alert("Falha ao confirmar banco")
                    } finally {
                      setSubmitting(false)
                    }
                  }}
                >
                  {submitting ? (
                    <span className="inline-flex items-center"><svg className="w-4 h-4 mr-1 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"></path></svg>Processando...</span>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
