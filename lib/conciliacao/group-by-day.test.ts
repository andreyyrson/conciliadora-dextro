import { describe, it, expect } from "vitest"
import { groupByDay } from "./group-by-day"
import type { ErpTransaction, ExtratoTransaction } from "./types"

function erp(id: string, dateISO: string): ErpTransaction {
  return {
    id, data: new Date(dateISO), descricao: "erp " + id, valor: 100, tipo: "DEBITO",
    documento: null, fornecedor: null, banco: null, categoria: null
  }
}

function ext(id: string, dateISO: string): ExtratoTransaction {
  return {
    id, origem: "EXTRATO", data: new Date(dateISO), descricao: "ext " + id, valor: 100,
    tipo: "DEBITO", saldoApos: null, identificador: null, banco: null
  }
}

describe("groupByDay", () => {
  it("agrupa ERP e extratos por dia (YYYY-MM-DD)", () => {
    const erps = [erp("a", "2024-01-01T10:00:00Z"), erp("b", "2024-01-01T15:00:00Z"), erp("c", "2024-01-02T09:00:00Z")]
    const exts = [ext("x", "2024-01-01T12:00:00Z"), ext("y", "2024-01-03T12:00:00Z")]

    const { erpPorDia, extratoPorDia, dias } = groupByDay(
      erps, exts, new Date("2024-01-01T00:00:00Z"), new Date("2024-01-03T23:59:59Z")
    )

    expect(erpPorDia.get("2024-01-01")).toHaveLength(2)
    expect(erpPorDia.get("2024-01-02")).toHaveLength(1)
    expect(extratoPorDia.get("2024-01-01")).toHaveLength(1)
    expect(extratoPorDia.get("2024-01-03")).toHaveLength(1)
  })

  it("gera lista de dias contínua do período", () => {
    const { dias } = groupByDay(
      [], [], new Date("2024-01-01T00:00:00Z"), new Date("2024-01-03T23:59:59Z")
    )
    expect(dias).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"])
  })
})
