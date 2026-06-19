export interface TransacaoErp {
  id: string
  descricao: string
  valor: number
  tipo: string
  documento?: string | null
  fornecedor?: string | null
  banco?: string | null
}

export interface TransacaoExtrato {
  id: string
  descricao: string
  valor: number
  tipo: string
  identificador?: string | null
  banco?: string | null
}

export interface MatchDetalhe {
  extratoId: string
  extratoDescricao: string
  extratoValor: number
  status: "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO"
  confianca: "HIGH" | "MEDIUM" | "LOW"
  score: number
  erpPareado: { id: string; descricao: string; valor: number; banco?: string | null } | null
  banco?: string | null
  diferencaValor?: number
  explicacoes: string[]
  requerDecisaoManual?: boolean
}

export interface MatchDia {
  conciliados: number
  aRevisar: number
  naoConciliados: number
  erpsSobrando: number
  detalhes: MatchDetalhe[]
  erpsSobrandoDetalhes: { id: string; descricao: string; valor: number; tipo: string; banco?: string | null }[]
}

export interface DiaAnalise {
  data: string
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  saldoFinalErp: number
  saldoFinalExtrato: number
  saldoAposBanco: number | null
  transacoesErp: TransacaoErp[]
  transacoesExtrato: TransacaoExtrato[]
  statusDia: "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO" | "SEM_DADOS"
  qtdErp: number
  qtdExtrato: number
  matches: MatchDia
  diferencaDebito: number
  diferencaCredito: number
}

export type StatusDia = DiaAnalise["statusDia"]

export function formatarData(dataStr: string): string {
  const [ano, mes, dia] = dataStr.split("-")
  return `${dia}/${mes}/${ano}`
}

export function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
