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
  banco?: string,
  arquivoQuery?: string
): Promise<DiaConciliacao[]> {
  const { erpLancamentos, extratoLancamentos } = await fetchConciliationData(empresaId, inicio, fim, tipo)

  const { erpPorDia, extratoPorDia, dias } = groupByDay(
    erpLancamentos,
    extratoLancamentos,
    inicio,
    fim
  )

  return dias.map(dataKey => {
    const erpsDoDia = erpPorDia.get(dataKey) || []
    const extratosDoDia = extratoPorDia.get(dataKey) || []
    return buildDia(dataKey, erpsDoDia, extratosDoDia, banco, { arquivoQuery })
  })
}
