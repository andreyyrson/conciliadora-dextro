import type { ErpTransaction, ExtratoTransaction, DiaConciliacao, MatchSummary } from "./types"
import { runDailyMatching } from "./daily-matching"
import { calculateStatus } from "./calculate-status"

export function buildDia(
  dataKey: string,
  erpsDoDia: ErpTransaction[],
  extratosDoDia: ExtratoTransaction[],
  banco?: string
): DiaConciliacao {
  function normalizarBanco(str?: string | null): string {
    if (!str) return ""
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  }

  // Filtrar por banco se fornecido
  if (banco && banco.trim()) {
    const bancoNormalizado = normalizarBanco(banco)
    erpsDoDia = erpsDoDia.filter(e =>
      e.banco && normalizarBanco(e.banco).includes(bancoNormalizado)
    )
    extratosDoDia = extratosDoDia.filter(ex =>
      ex.banco && normalizarBanco(ex.banco).includes(bancoNormalizado)
    )
  }

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

  const detalhes: MatchSummary["detalhes"] = [
    ...matching.itens.map(item => ({
      extratoId: item.extrato?.id ?? "",
      extratoDescricao: item.extrato?.descricao ?? "",
      extratoValor: item.extrato?.valor ?? 0,
      banco: item.extrato?.banco,
      status: item.status,
      confianca: item.status === "CONCILIADO" ? "HIGH" : "MEDIUM",
      score: item.status === "CONCILIADO" ? 3 : 2,
      erpPareado: item.erp ? { id: item.erp.id, descricao: item.erp.descricao, valor: item.erp.valor, banco: item.erp.banco } : null,
      diferencaValor: item.erp && item.extrato ? Math.abs(item.erp.valor - item.extrato.valor) : undefined,
      explicacoes: [],
    })),
    ...matching.extratosSobrando.map(ex => ({
      extratoId: ex.id,
      extratoDescricao: ex.descricao,
      extratoValor: ex.valor,
      banco: ex.banco,
      status: "NAO_CONCILIADO",
      confianca: "LOW",
      score: 0,
      erpPareado: null,
      diferencaValor: undefined,
      explicacoes: [],
    })),
  ]

  const matches: MatchSummary = {
    conciliados: matching.itens.filter(i => i.status === "CONCILIADO").length,
    aRevisar: matching.itens.filter(i => i.status === "A_REVISAR").length,
    naoConciliados: matching.erpsSobrando.length + matching.extratosSobrando.length,
    erpsSobrando: matching.erpsSobrando.length,
    detalhes,
    erpsSobrandoDetalhes: matching.erpsSobrando.map(e => ({
      id: e.id,
      descricao: e.descricao,
      valor: e.valor,
      tipo: e.tipo,
      banco: e.banco,
    })),
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
    matches,
    diferencaDebito,
    diferencaCredito,
  }
}
