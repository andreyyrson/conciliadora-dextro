"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion } from "framer-motion"
import { useUploadLote } from "./extrato/use-upload-lote"
import { UploadFila } from "./extrato/upload-fila"
import { MapeamentoCsvModal } from "./extrato/mapeamento-csv-modal"
import { SelecionarBancoModal } from "./extrato/selecionar-banco-modal"
import { ListaImportacoesResumida, type ImportacaoResumo } from "./extrato/lista-importacoes-resumida"

export function ExtratoScreen() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()

  const [importacoes, setImportacoes] = useState<ImportacaoResumo[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const fetchImportacoes = useCallback(async () => {
    if (!empresaId) return
    try {
      const response = await fetch(`/api/importacoes?empresaId=${empresaId}`)
      const data = await response.json()
      setImportacoes(data.importacoes || [])
    } catch (err) {
      console.error("Erro ao buscar importações:", err)
    }
  }, [empresaId])

  const {
    fila,
    processando,
    error: uploadError,
    mapeamentoPendente,
    bancoPendente,
    adicionarArquivos,
    removerArquivo,
    limparFila,
    confirmarTodos,
    confirmarMapeamento,
    pularMapeamento,
    confirmarBanco,
    pularBanco
  } = useUploadLote(empresaId, fetchImportacoes)

  useEffect(() => {
    if (empresaId) fetchImportacoes()
  }, [empresaId, fetchImportacoes])

  const handleDeleteImportacao = async (importacaoId: string) => {
    setDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/importacoes/${importacaoId}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao excluir importação")
        setDeleting(false)
        return
      }
      setDeleteConfirm(null)
      fetchImportacoes()
    } catch {
      setError("Erro ao excluir importação")
    } finally {
      setDeleting(false)
    }
  }

  if (!session) return null

  if (!empresaId) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          Selecione uma empresa no topo da página para importar extratos bancários.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {(processando || deleting) && (
        <div className="h-1 w-full bg-accent rounded overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-pulse" />
        </div>
      )}
      {/* Upload */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Importar Extratos Bancários</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Adicione um ou vários arquivos OFX/CSV de uma vez. Eles serão importados em lote.
          </p>

          {(error || uploadError) && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
              {error || uploadError}
            </div>
          )}

          <UploadFila
            fila={fila}
            processando={processando}
            onAdicionar={adicionarArquivos}
            onRemover={removerArquivo}
            onConfirmar={confirmarTodos}
            onLimpar={limparFila}
          />
        </Card>
      </motion.div>

      {/* Lista Resumida de Importações */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Importações Realizadas</h2>
          <ListaImportacoesResumida
            importacoes={importacoes}
            loading={deleting}
            onDelete={(id: string) => setDeleteConfirm(id)}
          />
        </Card>
      </motion.div>

      <MapeamentoCsvModal
        item={mapeamentoPendente}
        onConfirmar={confirmarMapeamento}
        onCancelar={pularMapeamento}
      />

      <SelecionarBancoModal
        importacaoId={bancoPendente?.importacaoId || null}
        fileName={bancoPendente?.fileName || null}
        onConfirmar={confirmarBanco}
        onCancelar={pularBanco}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeleteImportacao(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja deletar esta importação? Esta ação irá deletar permanentemente todos os lançamentos associados a esta importação."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
