"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useEmpresa } from "@/lib/use-empresa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PageHeader } from "@/components/page-header"
import { MapeamentoColunas } from "@/components/mapeamento-colunas"
import { ExtracaoPreview } from "@/components/extracao-preview"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Trash2 } from "lucide-react"

interface Empresa {
  id: string
  nome: string
}

interface Upload {
  id: string
  nomeArquivo: string
  periodo: string
  totalLinhas: number
  createdAt: string
}

interface AnaliseResult {
  colunas: string[]
  mapeamento: { [campo: string]: string | null }
  preview: { [coluna: string]: string }[]
  colunasNaoMapeadas: string[]
  confianca: { [campo: string]: number }
  totalLinhas: number
  mapeamentoSalvo: boolean
}

export default function UploadPage() {
  const { data: session } = useSession()
  const { empresaId } = useEmpresa()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState("")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [uploads, setUploads] = useState<Upload[]>([])
  const [analise, setAnalise] = useState<AnaliseResult | null>(null)
  const [mostrarMapeamento, setMostrarMapeamento] = useState(false)
  const [extracaoPreview, setExtracaoPreview] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEmpresas = async () => {
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      setEmpresas(data.empresas || [])
      if (data.empresas?.length > 0 && !selectedEmpresa) {
        setSelectedEmpresa(data.empresas[0].id)
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    }
  }

  const fetchUploads = async () => {
    if (!selectedEmpresa) return
    try {
      const response = await fetch(`/api/upload?empresaId=${selectedEmpresa}`)
      const data = await response.json()
      setUploads(data.uploads || [])
    } catch (error) {
      console.error("Erro ao buscar uploads:", error)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)

    try {
      const response = await fetch(`/api/upload/${id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        setDeleteConfirm(null)
        fetchUploads()
      } else {
        const data = await response.json()
        setError(data.error || "Erro ao deletar upload")
        setDeleting(false)
      }
    } catch (error) {
      console.error("Erro ao deletar upload:", error)
      setError("Erro ao deletar upload")
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEmpresas()
    }
  }, [session])

  useEffect(() => {
    if (empresaId) {
      setSelectedEmpresa(empresaId)
    }
  }, [empresaId])

  useEffect(() => {
    if (selectedEmpresa) {
      fetchUploads()
    }
  }, [selectedEmpresa])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      // Limitar a 4MB para evitar erro 413 no Vercel
      if (droppedFile.size > 4 * 1024 * 1024) {
        setError("Arquivo muito grande. Máximo permitido: 4MB")
        setFile(null)
        return
      }
      setFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      // Limitar a 4MB para evitar erro 413 no Vercel
      if (selectedFile.size > 4 * 1024 * 1024) {
        setError("Arquivo muito grande. Máximo permitido: 4MB")
        setFile(null)
        return
      }
      setFile(selectedFile)
    }
  }

  const handleAnalisar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setAnalise(null)
    setMostrarMapeamento(false)
    setExtracaoPreview(null)
    setLoading(true)

    if (!file || !selectedEmpresa || !date) {
      setError("Selecione o arquivo, empresa e período")
      setLoading(false)
      return
    }

    // Ler arquivo e enviar apenas primeiras 100 linhas para análise
    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target?.result as string
      let previewLines: any[] = []

      if (file.name.endsWith('.csv')) {
        const Papa = require("papaparse")
        const result = Papa.parse(content, {
          header: true,
          skipEmptyLines: true
        })
        previewLines = result.data.slice(0, 100)
      } else if (file.name.endsWith('.xlsx')) {
        const XLSX = require("xlsx")
        const workbook = XLSX.read(content, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        previewLines = jsonData.slice(0, 100)
      }

      const formData = new FormData()
      formData.append("file", new Blob([JSON.stringify(previewLines)], { type: 'application/json' }), 'preview.json')
      formData.append("empresaId", selectedEmpresa)
      formData.append("fileName", file.name)

      try {
        const response = await fetch("/api/upload/analisar", {
          method: "POST",
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || "Erro ao analisar arquivo")
          setLoading(false)
          return
        }

        setAnalise(data)
        setMostrarMapeamento(true)
      } catch (error) {
        setError("Erro ao analisar arquivo")
      } finally {
        setLoading(false)
      }
    }

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      reader.readAsBinaryString(file)
    }
  }

  const handleConfirmarUpload = async (mapeamento: { [campo: string]: string | null }) => {
    setError("")
    setSuccess("")
    setLoading(true)

    const dataReferencia = format(date!, "yyyy-MM-dd")

    const formData = new FormData()
    formData.append("file", file!)
    formData.append("empresaId", selectedEmpresa)
    formData.append("periodo", dataReferencia)
    formData.append("mapeamento", JSON.stringify(mapeamento))

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao fazer upload")
        setLoading(false)
        return
      }

      setSuccess(`Upload concluído! ${data.totalLinhas} lançamentos processados.`)
      setFile(null)
      setDate(new Date())
      setAnalise(null)
      setMostrarMapeamento(false)
      setExtracaoPreview(data.preview ? { totalLinhas: data.totalLinhas, preview: data.preview } : null)
      fetchUploads()
    } catch (error) {
      setError("Erro ao fazer upload")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelarMapeamento = () => {
    setMostrarMapeamento(false)
    setAnalise(null)
    setFile(null)
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload ERP"
        description="Faça upload de arquivos do ERP (CSV ou XLSX)"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <form onSubmit={handleAnalisar} className="space-y-6">
          <div>
            <label htmlFor="empresa" className="block text-sm font-medium text-muted-foreground mb-1">
              Empresa *
            </label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
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

          <div>
            <label htmlFor="periodo" className="block text-sm font-medium text-muted-foreground mb-1">
              Data de Referência *
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione a data de referência para os lançamentos
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Arquivo (CSV ou XLSX) *
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-border"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setFile(null)}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground">
                    Arraste e solte o arquivo aqui ou
                  </p>
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileChange}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-success bg-success/10 p-3 rounded">
              {success}
            </div>
          )}

          {extracaoPreview && (
            <ExtracaoPreview
              totalLinhas={extracaoPreview.totalLinhas}
              preview={extracaoPreview.preview}
            />
          )}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button type="submit" disabled={loading || !file}>
              {loading ? "Analisando..." : "Analisar Arquivo"}
            </Button>
          </motion.div>
        </form>
        </Card>
      </motion.div>

      {/* Seção de Mapeamento */}
      <AnimatePresence>
        {mostrarMapeamento && analise && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6 mt-6">
              <MapeamentoColunas
                colunas={analise.colunas}
                mapeamento={analise.mapeamento}
                preview={analise.preview}
                colunasNaoMapeadas={analise.colunasNaoMapeadas}
                confianca={analise.confianca}
                mapeamentoSalvo={analise.mapeamentoSalvo}
                onConfirmar={handleConfirmarUpload}
                onCancelar={handleCancelarMapeamento}
                tipo="ERP"
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Uploads Recentes</h2>
          {uploads.length === 0 ? (
            <p className="text-muted-foreground">Nenhum upload encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-foreground font-medium">Arquivo</th>
                    <th className="text-left p-2 text-foreground font-medium">Período</th>
                    <th className="text-left p-2 text-foreground font-medium">Linhas</th>
                    <th className="text-left p-2 text-foreground font-medium">Data Upload</th>
                    <th className="text-left p-2 text-foreground font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id} className="border-b border-border hover:bg-accent">
                      <td className="p-2 text-foreground">{upload.nomeArquivo}</td>
                      <td className="p-2 text-foreground">{upload.periodo}</td>
                      <td className="p-2 text-foreground">{upload.totalLinhas}</td>
                      <td className="p-2 text-foreground">
                        {new Date(upload.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          onClick={() => setDeleteConfirm(upload.id)}
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Formato do Arquivo</h2>
          <p className="text-sm text-muted-foreground mb-2">
            O arquivo deve conter as seguintes colunas:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>data:</strong> Data do lançamento (YYYY-MM-DD)</li>
          <li><strong>descricao:</strong> Descrição do lançamento</li>
          <li><strong>valor:</strong> Valor numérico</li>
          <li><strong>tipo:</strong> CREDITO ou DEBITO</li>
          <li><strong>documento:</strong> (opcional) Número do documento</li>
          <li><strong>centroCusto:</strong> (opcional) Centro de custo</li>
        </ul>
        </Card>
      </motion.div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja deletar este upload? Esta ação não pode ser desfeita."
        confirmText="Confirmar Exclusão"
        loading={deleting}
        danger
      />
    </div>
  )
}
