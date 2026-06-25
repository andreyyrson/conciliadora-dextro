import type { ErpTransaction, ExtratoTransaction } from "./types"

export type TransferenciaTipo = "ERP" | "EXTRATO" | "EXTRATO_IMPORTADO"

export interface TransferenciaSugestao {
  id: string
  valor: number
  dataOrigem: string
  dataDestino: string
  descricaoOrigem: string
  descricaoDestino: string
  origemTipo: TransferenciaTipo
  origemId: string
  destinoTipo: TransferenciaTipo
  destinoId: string
  bancoOrigem?: string | null
  bancoDestino?: string | null
}

interface MatchableTransacao {
  id: string
  valor: number
  data: Date
  tipo: "CREDITO" | "DEBITO"
  descricao: string
  banco?: string | null
  origemTipo: TransferenciaTipo
}

function diffDias(a: Date, b: Date) {
  const ms = Math.abs(a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0))
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function construirId(origemTipo: TransferenciaTipo, origemId: string, destinoTipo: TransferenciaTipo, destinoId: string) {
  return `${origemTipo}:${origemId}|${destinoTipo}:${destinoId}`
}

function matchTransfers(entries: MatchableTransacao[]): TransferenciaSugestao[] {
  const debitos = entries.filter(e => e.tipo === "DEBITO")
  const creditos = entries.filter(e => e.tipo === "CREDITO")
  const usados = new Set<string>()
  const sugestoes: TransferenciaSugestao[] = []

  for (const debito of debitos) {
    const candidato = creditos.find(credito =>
      !usados.has(credito.id) &&
      credito.valor === debito.valor &&
      diffDias(credito.data, debito.data) <= 1
    )
    if (!candidato) continue
    usados.add(candidato.id)
    sugestoes.push({
      id: construirId(debito.origemTipo, debito.id, candidato.origemTipo, candidato.id),
      valor: debito.valor,
      dataOrigem: debito.data.toISOString(),
      dataDestino: candidato.data.toISOString(),
      descricaoOrigem: debito.descricao,
      descricaoDestino: candidato.descricao,
      origemTipo: debito.origemTipo,
      origemId: debito.id,
      destinoTipo: candidato.origemTipo,
      destinoId: candidato.id,
      bancoOrigem: debito.banco || null,
      bancoDestino: candidato.banco || null,
    })
  }

  return sugestoes
}

export function detectTransferenciasExtrato(extratos: ExtratoTransaction[]): TransferenciaSugestao[] {
  const matchable = extratos.map(tx => ({
    id: tx.id,
    valor: tx.valor,
    data: tx.data,
    tipo: tx.tipo as "CREDITO" | "DEBITO",
    descricao: tx.descricao,
    banco: tx.banco,
    origemTipo: tx.origem,
  }))
  return matchTransfers(matchable)
}

export function detectTransferenciasErp(erps: ErpTransaction[]): TransferenciaSugestao[] {
  const matchable = erps.map(tx => ({
    id: tx.id,
    valor: tx.valor,
    data: tx.data,
    tipo: tx.tipo as "CREDITO" | "DEBITO",
    descricao: tx.descricao,
    banco: tx.banco,
    origemTipo: "ERP" as TransferenciaTipo,
  }))
  return matchTransfers(matchable)
}

export function detectTransferencias(erps: ErpTransaction[], extratos: ExtratoTransaction[]): TransferenciaSugestao[] {
  return [
    ...detectTransferenciasErp(erps),
    ...detectTransferenciasExtrato(extratos)
  ]
}
