import type { ErpTransaction, ExtratoTransaction } from "./types"

export interface GroupedByDay {
  erpPorDia: Map<string, ErpTransaction[]>
  extratoPorDia: Map<string, ExtratoTransaction[]>
  dias: string[]
}

export function groupByDay(
  erpLancamentos: ErpTransaction[],
  extratoLancamentos: ExtratoTransaction[],
  inicio: Date,
  fim: Date
): GroupedByDay {
  const erpPorDia = new Map<string, ErpTransaction[]>()
  for (const l of erpLancamentos) {
    const key = l.data.toISOString().split("T")[0]
    if (!erpPorDia.has(key)) erpPorDia.set(key, [])
    erpPorDia.get(key)!.push(l)
  }

  const extratoPorDia = new Map<string, ExtratoTransaction[]>()
  for (const e of extratoLancamentos) {
    const key = e.data.toISOString().split("T")[0]
    if (!extratoPorDia.has(key)) extratoPorDia.set(key, [])
    extratoPorDia.get(key)!.push(e)
  }

  const dias: string[] = []
  const atual = new Date(inicio)
  while (atual <= fim) {
    dias.push(atual.toISOString().split("T")[0])
    atual.setDate(atual.getDate() + 1)
  }

  return { erpPorDia, extratoPorDia, dias }
}
