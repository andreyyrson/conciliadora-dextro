import type { ResultadoMatching } from "./types"

export type StatusDia = "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO" | "SEM_DADOS"

export interface StatusInput {
  qtdErp: number
  qtdExtrato: number
  matching: ResultadoMatching
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  diferencaDebito: number
  diferencaCredito: number
}

export function calculateStatus({
  qtdErp,
  qtdExtrato,
  matching,
  diferencaDebito,
  diferencaCredito
}: StatusInput): StatusDia {
  const tolerancia = 0.01

  const temConciliado = matching.itens.some(i => i.status === "CONCILIADO")
  const temARevisar = matching.itens.some(i => i.status === "A_REVISAR")
  const temErpsSobrando = matching.erpsSobrando.length > 0 || matching.extratosSobrando.length > 0

  if (qtdErp === 0 && qtdExtrato === 0) {
    return "SEM_DADOS"
  }

  // Prioridade: A_REVISAR > NAO_CONCILIADO > CONCILIADO
  if (temARevisar) {
    return "A_REVISAR"
  }

  if (temErpsSobrando || diferencaDebito > tolerancia || diferencaCredito > tolerancia) {
    return "NAO_CONCILIADO"
  }

  if (temConciliado && diferencaDebito <= tolerancia && diferencaCredito <= tolerancia) {
    return "CONCILIADO"
  }

  return "NAO_CONCILIADO"
}
