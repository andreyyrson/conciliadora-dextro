"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { MapeamentoColunas } from "@/components/mapeamento-colunas"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { motion, AnimatePresence } from "framer-motion"

interface ContaBancaria {
  id: string
  banco: string
  agencia: string | null
  conta: string
  ativa: boolean
  ultimaSincAt: string | null
  createdAt: string
}

interface Empresa {
  id: string
  nome: string
}

export default function ContasPage() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [modoManual, setModoManual] = useState(false)
  const [modoOFX, setModoOFX] = useState(false)
  const [modoCSV, setModoCSV] = useState(false)
  const [banco, setBanco] = useState("")
  const [agencia, setAgencia] = useState("")
  const [conta, setConta] = useState("")
  const [ofxFile, setOfxFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [analiseCsv, setAnaliseCsv] = useState<any>(null)
  const [mostrarMapeamentoCsv, setMostrarMapeamentoCsv] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchContas = useCallback(async (empresaId: string) => {
    try {
      const response = await fetch(`/api/contas?empresaId=${empresaId}`)
      const data = await response.json()
      setContas(data.contas || [])
    } catch (error) {
      console.error("Erro ao buscar contas:", error)
    }
  }, [])

  const fetchEmpresas = useCallback(async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      setEmpresas(data.empresas || [])
      if (data.empresas?.length > 0 && !selectedEmpresa) {
        setSelectedEmpresa(data.empresas[0].id)
        fetchContas(data.empresas[0].id)
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    }
  }, [selectedEmpresa, fetchContas])

  useEffect(() => {
    if (session) {
      fetchEmpresas()
    }
  }, [session, fetchEmpresas])

  useEffect(() => {
    if (empresaId) {
      setSelectedEmpresa(empresaId)
      fetchContas(empresaId)
    }
  }, [empresaId, fetchContas])

  const handleUploadOFX = async () => {
    if (!selectedEmpresa || !ofxFile) {
      setError("Selecione uma empresa e um arquivo OFX")
      return
    }

    setError("")
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", ofxFile)
      formData.append("empresaId", selectedEmpresa)

      const response = await fetch("/api/ofx/upload", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao processar arquivo OFX")
        setLoading(false)
        return
      }

      setLoading(false)
      setModoOFX(false)
      setOfxFile(null)
      fetchContas(selectedEmpresa)
    } catch {
      setError("Erro ao processar arquivo OFX")
      setLoading(false)
    }
  }

  const handleAnalisarCSV = async () => {
    if (!selectedEmpresa || !csvFile) {
      setError("Selecione uma empresa e um arquivo CSV")
      return
    }

    setError("")
    setLoading(true)
    setAnaliseCsv(null)
    setMostrarMapeamentoCsv(false)

    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("empresaId", selectedEmpresa)

      const response = await fetch("/api/csv/analisar", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao analisar arquivo CSV")
        setLoading(false)
        return
      }

      setAnaliseCsv(data)
      setMostrarMapeamentoCsv(true)
      setLoading(false)
    } catch {
      setError("Erro ao analisar arquivo CSV")
      setLoading(false)
    }
  }

  const handleConfirmarUploadCSV = async (mapeamento: { [campo: string]: string | null }) => {
    setError("")
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", csvFile!)
      formData.append("empresaId", selectedEmpresa)
      formData.append("mapeamento", JSON.stringify(mapeamento))

      const response = await fetch("/api/csv/upload", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao processar arquivo CSV")
        setLoading(false)
        return
      }

      setLoading(false)
      setModoCSV(false)
      setCsvFile(null)
      setAnaliseCsv(null)
      setMostrarMapeamentoCsv(false)
      fetchContas(selectedEmpresa)
    } catch {
      setError("Erro ao processar arquivo CSV")
      setLoading(false)
    }
  }

  const handleCancelarMapeamentoCSV = () => {
    setMostrarMapeamentoCsv(false)
    setAnaliseCsv(null)
  }

  const handleDeleteConta = async (contaId: string) => {
    setDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/contas/${contaId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Erro ao excluir conta")
        setDeleting(false)
        return
      }

      setDeleteConfirm(null)
      fetchContas(selectedEmpresa)
    } catch {
      setError("Erro ao excluir conta")
    } finally {
      setDeleting(false)
    }
  }

  const handleAdicionarManual = async () => {
    if (!selectedEmpresa || !banco || !conta) {
      setError("Preencha todos os campos obrigatórios")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/contas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaId: selectedEmpresa,
          banco,
          agencia: agencia || null,
          conta
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao criar conta")
        setLoading(false)
        return
      }

      setBanco("")
      setAgencia("")
      setConta("")
      setModoManual(false)
      fetchContas(selectedEmpresa)
    } catch {
      setError("Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        description="Gerencie as contas bancárias conectadas"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Adicionar Conta Bancária</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Escolha o método de conexão: Open Finance, OFX ou manual.
          </p>

        <div className="mb-4">
          <label htmlFor="empresa" className="block text-sm font-medium text-muted-foreground mb-1">
            Empresa *
          </label>
          <select
            id="empresa"
            value={selectedEmpresa}
            onChange={(e) => {
              setSelectedEmpresa(e.target.value)
              fetchContas(e.target.value)
            }}
            className="w-full p-2 border rounded bg-background border-border text-foreground"
            required
          >
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nome}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {!modoManual && !modoOFX && !modoCSV && (
          <div className="flex gap-2 flex-wrap">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoOFX(true)}
                variant="outline"
              >
                Importar OFX
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoCSV(true)}
                variant="outline"
              >
                Importar CSV
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoManual(true)}
                variant="outline"
              >
                Adicionar Manualmente
              </Button>
            </motion.div>
          </div>
        )}

        {modoOFX && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="ofxFile" className="block text-sm font-medium text-muted-foreground mb-1">
                Arquivo OFX *
              </label>
              <Input
                id="ofxFile"
                type="file"
                accept=".ofx,.qfx"
                onChange={(e) => setOfxFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: .ofx, .qfx
              </p>
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleUploadOFX}
                  disabled={loading}
                >
                  {loading ? "Processando..." : "Importar"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoOFX(false)}
                  variant="outline"
                >
                  Voltar
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {modoCSV && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium text-muted-foreground mb-1">
                Arquivo CSV *
              </label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato esperado: data,descricao,valor,tipo,saldo
              </p>
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleAnalisarCSV}
                  disabled={loading || !csvFile}
                >
                  {loading ? "Analisando..." : "Analisar e Mapear Colunas"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoCSV(false)}
                  variant="outline"
                >
                  Voltar
                </Button>
              </motion.div>
            </div>

            {/* Seção de Mapeamento CSV */}
            <AnimatePresence>
              {mostrarMapeamentoCsv && analiseCsv && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6"
                >
                  <MapeamentoColunas
                    colunas={analiseCsv.colunas}
                    mapeamento={analiseCsv.mapeamento}
                    preview={analiseCsv.preview}
                    colunasNaoMapeadas={analiseCsv.colunasNaoMapeadas}
                    confianca={analiseCsv.confianca}
                    mapeamentoSalvo={analiseCsv.mapeamentoSalvo}
                    onConfirmar={handleConfirmarUploadCSV}
                    onCancelar={handleCancelarMapeamentoCSV}
                    tipo="EXTRATO"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {modoManual && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="banco" className="block text-sm font-medium text-muted-foreground mb-1">
                Banco *
              </label>
              <Input
                id="banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                required
                placeholder="Ex: Itaú, Bradesco, Nubank"
              />
            </div>

            <div>
              <label htmlFor="agencia" className="block text-sm font-medium text-muted-foreground mb-1">
                Agência (opcional)
              </label>
              <Input
                id="agencia"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="0000"
              />
            </div>

            <div>
              <label htmlFor="conta" className="block text-sm font-medium text-muted-foreground mb-1">
                Conta *
              </label>
              <Input
                id="conta"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                required
                placeholder="00000-0"
              />
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleAdicionarManual}
                  disabled={loading}
                >
                  {loading ? "Adicionando..." : "Adicionar Conta"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoManual(false)}
                  variant="outline"
                >
                  Voltar
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Contas Cadastradas</h2>
        {contas.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma conta conectada</p>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-foreground font-medium">Banco</th>
                <th className="text-left p-2 text-foreground font-medium">Agência</th>
                <th className="text-left p-2 text-foreground font-medium">Conta</th>
                <th className="text-left p-2 text-foreground font-medium">Status</th>
                <th className="text-left p-2 text-foreground font-medium">Última Sincronização</th>
                <th className="text-left p-2 text-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id} className="border-t border-border hover:bg-accent">
                  <td className="p-2 text-foreground">{conta.banco}</td>
                  <td className="p-2 text-foreground">{conta.agencia || "-"}</td>
                  <td className="p-2 text-foreground">{conta.conta}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      conta.ativa ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {conta.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-2 text-foreground">
                    {conta.ultimaSincAt 
                      ? new Date(conta.ultimaSincAt).toLocaleString("pt-BR")
                      : "Nunca sincronizada"
                    }
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteConfirm(conta.id)}
                        disabled={loading}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        </Card>
      </motion.div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeleteConta(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta conta e todos os seus lançamentos? Esta ação não pode ser desfeita."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
