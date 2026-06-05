"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { MapeamentoColunas } from "@/components/mapeamento-colunas"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
  const [modoPluggy, setModoPluggy] = useState(false)
  const [banco, setBanco] = useState("")
  const [agencia, setAgencia] = useState("")
  const [conta, setConta] = useState("")
  const [ofxFile, setOfxFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [analiseCsv, setAnaliseCsv] = useState<any>(null)
  const [mostrarMapeamentoCsv, setMostrarMapeamentoCsv] = useState(false)
  const [connectorId, setConnectorId] = useState("")
  const [cpf, setCpf] = useState("")
  const [cnpj, setCnpj] = useState("")

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [itemId, setItemId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [connectors, setConnectors] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchContas = async (empresaId: string) => {
    try {
      const response = await fetch(`/api/contas?empresaId=${empresaId}`)
      const data = await response.json()
      setContas(data.contas || [])
    } catch (error) {
      console.error("Erro ao buscar contas:", error)
    }
  }

  const fetchEmpresas = async () => {
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
  }

  const fetchConnectors = async () => {
    // Integração Pluggy desativada
    setConnectors([])
  }

  useEffect(() => {
    if (session) {
      fetchEmpresas()
    }
  }, [session])

  useEffect(() => {
    if (empresaId) {
      setSelectedEmpresa(empresaId)
      fetchContas(empresaId)
    }
  }, [empresaId])

  useEffect(() => {
    if (session) {
      fetchConnectors()
    }
  }, [session])

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      setError("Erro ao processar arquivo CSV")
      setLoading(false)
    }
  }

  const handleCancelarMapeamentoCSV = () => {
    setMostrarMapeamentoCsv(false)
    setAnaliseCsv(null)
  }

  const handleConectarPluggy = async () => {
    if (!selectedEmpresa || !connectorId) {
      setError("Selecione uma empresa e um conector")
      return
    }

    if (!cpf && !cnpj && !user) {
      setError("Preencha pelo menos CPF, CNPJ ou Usuário")
      return
    }

    const parameters: any = {}
    if (cpf) parameters.cpf = cpf
    if (cnpj) parameters.cnpj = cnpj
    if (user) parameters.user = user
    if (password) parameters.password = password

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/contas/conectar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaId: selectedEmpresa,
          connectorId: parseInt(connectorId),
          parameters
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao conectar com Pluggy")
        setLoading(false)
        return
      }

      setItemId(data.itemId)
      setLoading(false)
      startPolling(data.itemId)
    } catch (error) {
      setError("Erro ao conectar com Pluggy")
      setLoading(false)
    }
  }

  const startPolling = (itemId: string) => {
    setPolling(true)
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/contas/integration-status/${itemId}`)
        const data = await response.json()

        if (data.status === "UPDATED" || data.status === "ERROR") {
          clearInterval(pollInterval)
          setPolling(false)
          setModoPluggy(false)
          fetchContas(selectedEmpresa)
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error)
      }
    }, 3000)
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
    } catch (error) {
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
    } catch (error) {
      setError("Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  const handleSincronizar = async (contaId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/contas/${contaId}/sincronizar`, {
        method: "POST"
      })
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Erro ao sincronizar")
        return
      }

      alert(data.message || "Sincronização iniciada")
      fetchContas(selectedEmpresa)
    } catch (error) {
      alert("Erro ao sincronizar")
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return null
  }

  return (
    <div>
      <motion.h1 
        className="text-2xl font-bold text-white mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Contas Bancárias
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 mb-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Adicionar Conta Bancária</h2>
          <p className="text-gray-400 mb-4 text-sm">
            Escolha o método de conexão: Open Finance, OFX ou manual.
          </p>

        <div className="mb-4">
          <label htmlFor="empresa" className="block text-sm font-medium text-gray-300 mb-1">
            Empresa *
          </label>
          <select
            id="empresa"
            value={selectedEmpresa}
            onChange={(e) => {
              setSelectedEmpresa(e.target.value)
              fetchContas(e.target.value)
            }}
            className="w-full p-2 border rounded bg-black border-white/20 text-white"
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
          <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded animate-pulse mb-4">
            {error}
          </div>
        )}

        {!modoManual && !modoOFX && !modoCSV && !modoPluggy && (
          <div className="flex gap-2 flex-wrap">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoPluggy(true)}
                className="bg-white text-black hover:bg-gray-200"
              >
                Open Finance
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoOFX(true)}
                className="bg-black text-white border border-white/40 hover:bg-white/10"
              >
                Importar OFX
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoCSV(true)}
                className="bg-black text-white border border-white/40 hover:bg-white/10"
              >
                Importar CSV
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setModoManual(true)}
                className="bg-black text-white border border-white/40 hover:bg-white/10"
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
              <label htmlFor="ofxFile" className="block text-sm font-medium text-gray-300 mb-1">
                Arquivo OFX *
              </label>
              <Input
                id="ofxFile"
                type="file"
                accept=".ofx,.qfx"
                onChange={(e) => setOfxFile(e.target.files?.[0] || null)}
                required
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formatos aceitos: .ofx, .qfx
              </p>
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleUploadOFX}
                  disabled={loading}
                  className="bg-white text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {loading ? "Processando..." : "Importar"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoOFX(false)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
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
              <label htmlFor="csvFile" className="block text-sm font-medium text-gray-300 mb-1">
                Arquivo CSV *
              </label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                required
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato esperado: data,descricao,valor,tipo,saldo
              </p>
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleAnalisarCSV}
                  disabled={loading || !csvFile}
                  className="bg-white text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {loading ? "Analisando..." : "Analisar e Mapear Colunas"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoCSV(false)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
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

        {modoPluggy && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="connectorId" className="block text-sm font-medium text-gray-300 mb-1">
                Conector *
              </label>
              <select
                id="connectorId"
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                className="w-full p-2 border rounded bg-black border-white/20 text-white"
                required
              >
                <option value="">Selecione um conector</option>
                {connectors.map((connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">
                CPF
              </label>
              <Input
                id="cpf"
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div>
              <label htmlFor="cnpj" className="block text-sm font-medium text-gray-300 mb-1">
                CNPJ
              </label>
              <Input
                id="cnpj"
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div>
              <label htmlFor="user" className="block text-sm font-medium text-gray-300 mb-1">
                Usuário (para Sandbox)
              </label>
              <Input
                id="user"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Usuário do banco"
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Senha (para Sandbox)
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha do banco"
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            {polling && (
              <div className="text-sm text-blue-400 bg-blue-900/20 p-3 rounded animate-pulse">
                Sincronizando com Open Finance... Aguarde.
              </div>
            )}

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleConectarPluggy}
                  disabled={loading || polling}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  {loading ? "Conectando..." : polling ? "Sincronizando..." : "Conectar"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoPluggy(false)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Voltar
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {modoManual && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="banco" className="block text-sm font-medium text-gray-300 mb-1">
                Banco *
              </label>
              <Input
                id="banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                required
                placeholder="Ex: Itaú, Bradesco, Nubank"
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div>
              <label htmlFor="agencia" className="block text-sm font-medium text-gray-300 mb-1">
                Agência (opcional)
              </label>
              <Input
                id="agencia"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="0000"
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div>
              <label htmlFor="conta" className="block text-sm font-medium text-gray-300 mb-1">
                Conta *
              </label>
              <Input
                id="conta"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                required
                placeholder="00000-0"
                className="bg-black border-white/20 text-white placeholder:text-gray-600 focus:border-white"
              />
            </div>

            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleAdicionarManual}
                  disabled={loading}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  {loading ? "Adicionando..." : "Adicionar Conta"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setModoManual(false)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
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
        <Card className="p-6 bg-black border border-white/20">
          <h2 className="text-lg font-semibold mb-4 text-white">Contas Cadastradas</h2>
        {contas.length === 0 ? (
          <p className="text-gray-500">Nenhuma conta conectada</p>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left p-2 text-white font-medium">Banco</th>
                <th className="text-left p-2 text-white font-medium">Agência</th>
                <th className="text-left p-2 text-white font-medium">Conta</th>
                <th className="text-left p-2 text-white font-medium">Status</th>
                <th className="text-left p-2 text-white font-medium">Última Sincronização</th>
                <th className="text-left p-2 text-white font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2 text-gray-300">{conta.banco}</td>
                  <td className="p-2 text-gray-300">{conta.agencia || "-"}</td>
                  <td className="p-2 text-gray-300">{conta.conta}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      conta.ativa ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-400"
                    }`}>
                      {conta.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-2 text-gray-300">
                    {conta.ultimaSincAt 
                      ? new Date(conta.ultimaSincAt).toLocaleString("pt-BR")
                      : "Nunca sincronizada"
                    }
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSincronizar(conta.id)}
                        disabled={loading}
                        className="bg-white text-black hover:bg-gray-200"
                      >
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirm(conta.id)}
                        disabled={loading}
                        className="border-red-500/50 text-red-400 hover:bg-red-900/20"
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
