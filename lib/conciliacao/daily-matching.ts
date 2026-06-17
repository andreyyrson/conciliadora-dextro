import type { EntradaConciliacao, ResultadoMatching } from "./types"
import { gerarSugestoesComparativo } from "./types"
import type { ErpTransaction, ExtratoTransaction } from "./types"

export interface DailyMatchingResult {
  matching: ResultadoMatching
  erpEntradas: EntradaConciliacao[]
  extratoEntradas: EntradaConciliacao[]
}

export function runDailyMatching(
  erpsDoDia: ErpTransaction[],
  extratosDoDia: ExtratoTransaction[]
): DailyMatchingResult {
  const erpEntradas: EntradaConciliacao[] = erpsDoDia.map(e => ({
    id: e.id,
    origem: "ERP",
    data: e.data,
    valor: e.valor,
    tipo: e.tipo as "CREDITO" | "DEBITO",
    descricao: e.descricao,
    documento: e.documento || undefined,
    fornecedor: e.fornecedor || undefined,
    categoria: e.categoria || undefined,
    banco: e.banco || undefined
  }))

  const extratoEntradas: EntradaConciliacao[] = extratosDoDia.map(e => ({
    id: e.id,
    origem: "EXTRATO",
    data: e.data,
    valor: e.valor,
    tipo: e.tipo as "CREDITO" | "DEBITO",
    descricao: e.descricao,
    identificador: e.identificador || undefined,
    banco: e.banco || undefined
  }))

  const matching = gerarSugestoesComparativo(erpEntradas, extratoEntradas)

  return { matching, erpEntradas, extratoEntradas }
}
