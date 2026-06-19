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
  importacaoId?: string
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
  const [bancoPendente, setBancoPendente] = useState<{ importacaoId: string; fileName: string } | null>(null)

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

  const uploadOFX = useCallback(async (item: FilaItem): Promise<{ ok: boolean; importacaoId?: string; bancoDetectado?: string | null }> => {
    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("empresaId", empresaId!)
    const res = await fetch("/api/ofx/upload", { method: "POST", body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      atualizarItem(item.id, { status: "erro", erro: data.error || "Erro no upload OFX" })
      return { ok: false }
    }
    atualizarItem(item.id, { status: "ok", importacaoId: data.importacao?.id })
    return { ok: true, importacaoId: data.importacao?.id, bancoDetectado: data.bancoDetectado }
  }, [empresaId, atualizarItem])

  const uploadCSVComMapeamento = useCallback(async (
    item: FilaItem,
    mapeamento: { [campo: string]: string | null }
  ): Promise<{ ok: boolean; importacaoId?: string; bancoDetectado?: string | null }> => {
    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("empresaId", empresaId!)
    formData.append("mapeamento", JSON.stringify(mapeamento))
    const res = await fetch("/api/csv/upload", { method: "POST", body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      atualizarItem(item.id, { status: "erro", erro: data.error || "Erro no upload CSV" })
      return { ok: false }
    }
    atualizarItem(item.id, { status: "ok", importacaoId: data.importacao?.id })
    return { ok: true, importacaoId: data.importacao?.id, bancoDetectado: data.bancoDetectado }
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

  // Considera o mapeamento "confiável" se os campos essenciais (data, valor) foram detectados.
  // Nunca confia cegamente em mapeamentoSalvo — sempre valida os campos obrigatórios.
  const mapeamentoConfiavel = (a: AnaliseCsvResult): boolean => {
    return !!(a.mapeamento.data && a.mapeamento.valor)
  }

  const confirmarMapeamento = useCallback(async (mapeamento: { [campo: string]: string | null }) => {
    if (!mapeamentoPendente) return
    atualizarItem(mapeamentoPendente.id, { status: "enviando" })
    const result = await uploadCSVComMapeamento(mapeamentoPendente, mapeamento)
    if (result.ok && result.bancoDetectado == null && result.importacaoId) {
      setBancoPendente({ importacaoId: result.importacaoId, fileName: mapeamentoPendente.file.name })
      return
    }
    setFila(prev => {
      // procurar próximo que precisa de mapeamento
      const prox = prev.find(i => i.id !== mapeamentoPendente.id && i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox && !bancoPendente) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [mapeamentoPendente, uploadCSVComMapeamento, atualizarItem, onConcluido, bancoPendente])

  const pularMapeamento = useCallback(() => {
    if (!mapeamentoPendente) return
    atualizarItem(mapeamentoPendente.id, { status: "erro", erro: "Mapeamento cancelado" })
    setFila(prev => {
      const prox = prev.find(i => i.id !== mapeamentoPendente.id && i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox && !bancoPendente) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [mapeamentoPendente, atualizarItem, onConcluido, bancoPendente])

  const confirmarTodos = useCallback(async () => {
    if (!empresaId || fila.length === 0) return
    setError("")
    setProcessando(true)

    // Snapshot dos itens pendentes
    const pendentes = fila.filter(i => i.status === "pendente")

    for (const item of pendentes) {
      if (bancoPendente) break // pausa se há modal de banco aberto
      if (item.tipo === "OFX") {
        atualizarItem(item.id, { status: "enviando" })
        const result = await uploadOFX(item)
        if (result.ok && result.bancoDetectado == null && result.importacaoId) {
          setBancoPendente({ importacaoId: result.importacaoId, fileName: item.file.name })
          break // pausa o lote para o modal
        }
      } else {
        // CSV: analisar primeiro
        atualizarItem(item.id, { status: "analisando" })
        const analise = await analisarCSV(item)
        if (!analise) continue // erro já setado

        if (mapeamentoConfiavel(analise)) {
          atualizarItem(item.id, { status: "enviando" })
          const result = await uploadCSVComMapeamento(item, analise.mapeamento)
          if (result.ok && result.bancoDetectado == null && result.importacaoId) {
            setBancoPendente({ importacaoId: result.importacaoId, fileName: item.file.name })
            break // pausa o lote para o modal
          }
        } else {
          // marca para resolver no final
          atualizarItem(item.id, { status: "precisa_mapeamento", analiseCsv: analise })
        }
      }
    }

    // Após processar OFX e CSVs confiáveis, abrir o primeiro mapeamento pendente (se não há banco pendente)
    setFila(prev => {
      if (bancoPendente) return prev
      const prox = prev.find(i => i.status === "precisa_mapeamento")
      setMapeamentoPendente(prox || null)
      if (!prox) {
        setProcessando(false)
        onConcluido()
      }
      return prev
    })
  }, [empresaId, fila, atualizarItem, uploadOFX, analisarCSV, uploadCSVComMapeamento, onConcluido, bancoPendente])

  const confirmarBanco = useCallback(async (banco: string) => {
    if (!bancoPendente) return
    try {
      const res = await fetch(`/api/importacoes/${bancoPendente.importacaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banco })
      })
      if (!res.ok) throw new Error("Erro ao atribuir banco")
      setBancoPendente(null)
      // Continua o lote
      await confirmarTodos()
    } catch {
      setError("Erro ao atribuir banco à importação")
    }
  }, [bancoPendente, confirmarTodos])

  const pularBanco = useCallback(() => {
    if (!bancoPendente) return
    setBancoPendente(null)
    // Continua o lote mesmo sem banco
    confirmarTodos()
  }, [bancoPendente, confirmarTodos])

  return {
    fila,
    processando,
    error,
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
  }
}
