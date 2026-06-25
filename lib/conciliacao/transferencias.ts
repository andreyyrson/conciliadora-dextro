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

function matchTransfers(entries: MatchableTransacao[], toleranciaDias = 7, toleranciaValor = 1.0): TransferenciaSugestao[] {
  const normalizadas = entries.map(e => ({ ...e, tipo: normalizarTipo(e.tipo) })).filter(e => e.tipo) as (MatchableTransacao & { tipo: "CREDITO" | "DEBITO" })[]
  const debitos = normalizadas.filter(e => e.tipo === "DEBITO")
  const creditos = normalizadas.filter(e => e.tipo === "CREDITO")
  const usados = new Set<string>()
  const sugestoes: TransferenciaSugestao[] = []

  console.log(`[transferencias] total=${entries.length} debitos=${debitos.length} creditos=${creditos.length} toleranciaDias=${toleranciaDias} toleranciaValor=${toleranciaValor}`)

  for (const debito of debitos) {
    const candidato = creditos.find(credito =>
      !usados.has(credito.id) &&
      Math.abs(credito.valor - debito.valor) <= toleranciaValor &&
      diffDias(credito.data, debito.data) <= toleranciaDias &&
      debito.banco && credito.banco && bancosDiferentes(debito.banco, credito.banco)
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

export interface DiagnosticoTransferencias {
  totalErp: number
  totalExtrato: number
  totalLancamentos: number
  debitos: number
  creditos: number
  tiposUnicos: string[]
  amostra: { id: string; tipo: string; valor: number; data: string; banco: string | null; descricao: string }[]
}

export function diagnosticarTransferencias(erps: ErpTransaction[], extratos: ExtratoTransaction[]): DiagnosticoTransferencias {
  const todos = [
    ...erps.map(tx => ({ ...tx, origem: "ERP" as const })),
    ...extratos.map(tx => ({ ...tx }))
  ]
  const tiposUnicos = Array.from(new Set(todos.map(tx => tx.tipo)))
  const debitos = todos.filter(tx => normalizarTipo(tx.tipo) === "DEBITO").length
  const creditos = todos.filter(tx => normalizarTipo(tx.tipo) === "CREDITO").length
  const amostra = todos.slice(0, 10).map(tx => ({
    id: tx.id,
    tipo: tx.tipo,
    valor: tx.valor,
    data: tx.data.toISOString(),
    banco: tx.banco || null,
    descricao: tx.descricao
  }))

  return {
    totalErp: erps.length,
    totalExtrato: extratos.length,
    totalLancamentos: todos.length,
    debitos,
    creditos,
    tiposUnicos,
    amostra
  }
}
