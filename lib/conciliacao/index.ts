import { fetchConciliationData } from "./fetch-data"
import { groupByDay } from "./group-by-day"
import { buildDia } from "./build-day"
import type { DiaConciliacao } from "./types"

export type { DiaConciliacao } from "./types"
export { fetchConciliationData } from "./fetch-data"
export { groupByDay } from "./group-by-day"
export { buildDia } from "./build-day"
export { runDailyMatching } from "./daily-matching"
export { calculateStatus } from "./calculate-status"

/**
 * Orquestra a análise por dia: busca dados, agrupa por dia e monta o resultado
 * de cada dia comparando TODOS os extratos da empresa contra o ERP no período.
 */
export async function analisarPorDia(
  empresaId: string,
  inicio: Date,
  fim: Date,
  tipo?: "RECEITAS" | "DESPESAS",
  banco?: string
): Promise<DiaConciliacao[]> {
  console.log("[analisarPorDia] Iniciando com banco:", banco)
  const { erpLancamentos, extratoLancamentos } = await fetchConciliationData(empresaId, inicio, fim, tipo, banco)
  console.log("[analisarPorDia] Dados recebidos - ERPs:", erpLancamentos.length, "Extratos:", extratoLancamentos.length)

  const { erpPorDia, extratoPorDia, dias } = groupByDay(
    erpLancamentos,
    extratoLancamentos,
    inicio,
    fim
  )
  console.log("[analisarPorDia] Agrupado por dia - dias:", dias.length)

  const resultado = dias.map(dataKey => {
    const erpsDoDia = erpPorDia.get(dataKey) || []
    const extratosDoDia = extratoPorDia.get(dataKey) || []
    const dia = buildDia(dataKey, erpsDoDia, extratosDoDia)
    console.log("[analisarPorDia] Dia", dataKey, "ERPs:", erpsDoDia.length, "Extratos:", extratosDoDia.length, "TotalDebitoErp:", dia.totalDebitoErp, "TotalDebitoExtrato:", dia.totalDebitoExtrato)
    return dia
  })
  console.log("[analisarPorDia] Resultado final - dias:", resultado.length)

  return resultado
}
