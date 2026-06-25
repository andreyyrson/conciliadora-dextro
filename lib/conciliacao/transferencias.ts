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

function normalizarTipo(tipo: string): "CREDITO" | "DEBITO" | null {
  const limpo = tipo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (limpo.startsWith("D")) return "DEBITO"
  if (limpo.startsWith("C")) return "CREDITO"
  if (limpo === "SAIDA" || limpo === "SAI") return "DEBITO"
  if (limpo === "ENTRADA" || limpo === "ENT") return "CREDITO"
  return null
}

function diffDias(a: Date, b: Date) {
  const aCopy = new Date(a)
  const bCopy = new Date(b)
  aCopy.setHours(0, 0, 0, 0)
  bCopy.setHours(0, 0, 0, 0)
  const ms = Math.abs(aCopy.getTime() - bCopy.getTime())
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function construirId(origemTipo: TransferenciaTipo, origemId: string, destinoTipo: TransferenciaTipo, destinoId: string) {
  return `${origemTipo}:${origemId}|${destinoTipo}:${destinoId}`
}

function bancosDiferentes(a?: string | null, b?: string | null) {
  if (!a || !b) return true
  return a.trim().toLowerCase() !== b.trim().toLowerCase()
}

function matchTransfers(entries: MatchableTransacao[], toleranciaDias = 3, toleranciaCentavos = 0): TransferenciaSugestao[] {
  const normalizadas = entries.map(e => ({ ...e, tipo: normalizarTipo(e.tipo) })).filter(e => e.tipo) as (MatchableTransacao & { tipo: "CREDITO" | "DEBITO" })[]
  const debitos = normalizadas.filter(e => e.tipo === "DEBITO")
  const creditos = normalizadas.filter(e => e.tipo === "CREDITO")
  const usados = new Set<string>()
  const sugestoes: TransferenciaSugestao[] = []

  console.log(`[transferencias] total=${entries.length} debitos=${debitos.length} creditos=${creditos.length}`)

  for (const debito of debitos) {
    const candidato = creditos.find(credito =>
      !usados.has(credito.id) &&
      Math.abs(credito.valor - debito.valor) <= toleranciaCentavos &&
      diffDias(credito.data, debito.data) <= toleranciaDias &&
      bancosDiferentes(debito.banco, credito.banco)
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

  console.log(`[transferencias] sugestoes=${sugestoes.length}`)
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
