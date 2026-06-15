import { gerarSugestoes } from "@/lib/matching/engine"
import type { EntradaConciliacao, ResultadoMatching } from "@/lib/matching/engine"

export { gerarSugestoes }
export type { EntradaConciliacao, ResultadoMatching }

export interface ErpTransaction {
  id: string
  data: Date
  descricao: string
  valor: number
  tipo: string
  documento: string | null
  fornecedor: string | null
  banco: string | null
  categoria: string | null
}

export interface ExtratoTransaction {
  id: string
  origem: "EXTRATO" | "EXTRATO_IMPORTADO"
  data: Date
  descricao: string
  valor: number
  tipo: string
  saldoApos: number | null
  identificador: string | null
  banco: string | null
}

export interface DiaConciliacao {
  data: string
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  saldoFinalErp: number
  saldoFinalExtrato: number
  saldoAposBanco: number | null
  transacoesErp: ErpTransaction[]
  transacoesExtrato: ExtratoTransaction[]
  statusDia: "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO" | "SEM_DADOS"
  qtdErp: number
  qtdExtrato: number
  matches: MatchSummary
}

export interface MatchSummary {
  conciliados: number
  aRevisar: number
  naoConciliados: number
  erpsSobrando: number
  detalhes: MatchDetail[]
}

export interface MatchDetail {
  extratoId: string
  extratoDescricao: string
  extratoValor: number
  status: string
  confianca: string
  score: number
  erpPareado: {
    id: string
    descricao: string
    valor: number
  } | null
  diferencaValor: number | undefined
  explicacoes: string[]
}
