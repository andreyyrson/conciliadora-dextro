import type { ErpTransaction, ExtratoTransaction, DiaConciliacao, MatchSummary } from "./types"
import { runDailyMatching } from "./daily-matching"
import { calculateStatus } from "./calculate-status"

export function buildDia(
  dataKey: string,
  erpsDoDia: ErpTransaction[],
  extratosDoDia: ExtratoTransaction[]
): DiaConciliacao {
  const totalDebitoErp = erpsDoDia
    .filter(e => e.tipo === "DEBITO")
    .reduce((s, e) => s + e.valor, 0)
  const totalCreditoErp = erpsDoDia
    .filter(e => e.tipo === "CREDITO")
    .reduce((s, e) => s + e.valor, 0)

  const totalDebitoExtrato = extratosDoDia
    .filter(e => e.tipo === "DEBITO")
    .reduce((s, e) => s + e.valor, 0)
  const totalCreditoExtrato = extratosDoDia
    .filter(e => e.tipo === "CREDITO")
    .reduce((s, e) => s + e.valor, 0)

  const saldoFinalErp = totalCreditoErp - totalDebitoErp
  const saldoFinalExtrato = totalCreditoExtrato - totalDebitoExtrato

  // Saldo final do banco (último saldoApos do dia, se disponível)
  const saldoAposBanco = extratosDoDia.length > 0
    ? extratosDoDia[extratosDoDia.length - 1].saldoApos
    : null

  const { matching } = runDailyMatching(erpsDoDia, extratosDoDia)

  const diferencaDebito = Math.abs(totalDebitoErp - totalDebitoExtrato)
  const diferencaCredito = Math.abs(totalCreditoErp - totalCreditoExtrato)

  const statusDia = calculateStatus({
    qtdErp: erpsDoDia.length,
    qtdExtrato: extratosDoDia.length,
    matching,
    totalDebitoErp,
    totalCreditoErp,
    totalDebitoExtrato,
    totalCreditoExtrato,
    diferencaDebito,
    diferencaCredito
  })

  const matches: MatchSummary = {
    conciliados: matching.itens.filter(i => i.status === "CONCILIADO").length,
    aRevisar: matching.itens.filter(i => i.status === "A_REVISAR").length,
    naoConciliados: matching.itens.filter(i => i.status === "NAO_CONCILIADO").length,
    erpsSobrando: matching.erpsSobrando.length,
    detalhes: matching.itens.map(i => ({
      extratoId: i.extrato.id,
      extratoDescricao: i.extrato.descricao,
      extratoValor: i.extrato.valor,
      status: i.status,
      confianca: i.confianca,
      score: i.sugestoes[0]?.score || 0,
      erpPareado: i.erpPareado ? {
        id: i.erpPareado.id,
        descricao: i.erpPareado.descricao,
        valor: i.erpPareado.valor
      } : null,
      diferencaValor: i.diferencaValor,
      explicacoes: i.sugestoes[0]?.explicacoes || []
    }))
  }

  return {
    data: dataKey,
    totalDebitoErp,
    totalCreditoErp,
    totalDebitoExtrato,
    totalCreditoExtrato,
    saldoFinalErp,
    saldoFinalExtrato,
    saldoAposBanco,
    transacoesErp: erpsDoDia,
    transacoesExtrato: extratosDoDia,
    statusDia,
    qtdErp: erpsDoDia.length,
    qtdExtrato: extratosDoDia.length,
    matches
  }
}
