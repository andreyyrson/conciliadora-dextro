"use client"

import { useState, useCallback } from "react"

export type ItemStatus = "pendente" | "analisando" | "precisa_mapeamento" | "enviando" | "ok" | "erro"

export interface FilaItem {
  id: string
  file: File
  tipo: "OFX" | "CSV"
  status: ItemStatus
  erro?: string
  // Para CSV que precisa de mapeamento
  analiseCsv?: AnaliseCsvResult
}

export interface AnaliseCsvResult {
  colunas: string[]
  mapeamento: { [campo: string]: string | null }
  preview: { [coluna: string]: string }[]
  colunasNaoMapeadas: string[]
  confianca: { [campo: string]: number }
  totalLinhas: number
  mapeamentoSalvo: boolean
}

function detectTipo(file: File): "OFX" | "CSV" {
  const name = file.name.toLowerCase()
  if (name.endsWith(".ofx") || name.endsWith(".qfx")) return "OFX"
  return "CSV"
}

function makeId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`
}

export function useUploadLote(empresaId: string | null | undefined, onConcluido: () => void) {
  const [fila, setFila] = useState<FilaItem[]>([])
  const [processando, setProcessando] = useState(false)
  const [error, setError] = useState("")
  // CSV atualmente aguardando mapeamento manual (resolvido no final)
  const [mapeamentoPendente, setMapeamentoPendente] = useState<FilaItem | null>(null)

  const adicionarArquivos = useCallback((files: FileList | File[]) => {
    const novos: FilaItem[] = Array.from(files).map(file => ({
      id: makeId(file),
      file,
      tipo: detectTipo(file),
      status: "pendente" as ItemStatus
    }))
    setFila(prev => [...prev, ...novos])
  }, [])

  const removerArquivo = useCallback((id: string) => {
    setFila(prev => prev.filter(i => i.id !== id))
  }, [])

  const limparFila = useCallback(() => {
    setFila([])
    setError("")
    setMapeamentoPendente(null)
  }, [])

  const atualizarItem = useCallback((id: string, patch: Partial<FilaItem>) => {
    setFila(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const uploadOFX = useCallback(async (item: FilaItem): Promise<boolean> => {
    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("empresaId", empresaId!)
    const res = await fetch("/api/ofx/upload", { method: "POST", body: formData })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      atualizarItem(item.id, { status: "erro", erro: data.error || "Erro no upload OFX" })
      return false
    }
    atualizarItem(item.id, { status: "ok" })
    return true
  }, [empresaId, atualizarItem])

  const uploadCSVComMapeamento = useCallback(async (
    item: FilaItem,
    mapeamento: { [campo: string]: string | null }
  ): Promise<boolean> => {
    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("empresaId", empresaId!)
    formData.append("mapeamento", JSON.stringify(mapeamento))
    const res = await fetch("/api/csv/upload", { method: "POST", body: formData })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      atualizarItem(item.id, { status: "erro", erro: data.error || "Erro no upload CSV" })
      return false
    }
    atualizarItem(item.id, { status: "ok" })
    return true
  }, [empresaId, atualizarItem])

  const analisarCSV = useCallback(async (item: FilaItem): Promise<AnaliseCsvResult | null> => {
    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("empresaId", empresaId!)
    const res = await fetch("/api/csv/analisar", { method: "POST", body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      atualizarItem(item.id, { status: "erro", erro: data.error || "Erro ao analisar CSV" })
      return null
    }
    return data as AnaliseCsvResult
  }, [empresaId, atualizarItem])

  // Considera o mapeamento "confiável" se já existe salvo ou se todos os campos
  // essenciais (data, valor, descricao) foram detectados.
  const mapeamentoConfiavel = (a: AnaliseCsvResult): boolean => {
    if (a.mapeamentoSalvo) return true
    const essenciais = ["data", "valor", "descricao"]
    return essenciais.every(campo => !!a.mapeamento[campo])
  }

  const confirmarMapeamento = useCallback(async (mapeamento: { [campo: string]: string | null }) => {
    if (!mapeamentoPendente) return
    atualizarItem(mapeamentoPendente.id, { status: "enviando" })
    await uploadCSVComMapeamento(mapeamentoPendente, mapeamento)
    setFila(prev => {
      // procurar próximo que precisa de mapeamento
      const prox = prev.find(i => i.id !== mapeamentoPendente.id && i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [mapeamentoPendente, uploadCSVComMapeamento, atualizarItem, onConcluido])

  const pularMapeamento = useCallback(() => {
    if (!mapeamentoPendente) return
    atualizarItem(mapeamentoPendente.id, { status: "erro", erro: "Mapeamento cancelado" })
    setFila(prev => {
      const prox = prev.find(i => i.id !== mapeamentoPendente.id && i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [mapeamentoPendente, atualizarItem, onConcluido])

  const confirmarTodos = useCallback(async () => {
    if (!empresaId || fila.length === 0) return
    setError("")
    setProcessando(true)

    // Snapshot dos itens pendentes
    const pendentes = fila.filter(i => i.status === "pendente")

    for (const item of pendentes) {
      if (item.tipo === "OFX") {
        atualizarItem(item.id, { status: "enviando" })
        await uploadOFX(item)
      } else {
        // CSV: analisar primeiro
        atualizarItem(item.id, { status: "analisando" })
        const analise = await analisarCSV(item)
        if (!analise) continue // erro já setado

        if (mapeamentoConfiavel(analise)) {
          atualizarItem(item.id, { status: "enviando" })
          await uploadCSVComMapeamento(item, analise.mapeamento)
        } else {
          // marca para resolver no final
          atualizarItem(item.id, { status: "precisa_mapeamento", analiseCsv: analise })
        }
      }
    }

    // Após processar OFX e CSVs confiáveis, abrir o primeiro mapeamento pendente
    setFila(prev => {
      const prox = prev.find(i => i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [empresaId, fila, atualizarItem, uploadOFX, analisarCSV, uploadCSVComMapeamento, onConcluido])

  return {
    fila,
    processando,
    error,
    mapeamentoPendente,
    adicionarArquivos,
    removerArquivo,
    limparFila,
    confirmarTodos,
    confirmarMapeamento,
    pularMapeamento
  }
}
