import { describe, it, expect } from "vitest"
import { buildDia } from "./build-day"
import type { ErpTransaction, ExtratoTransaction } from "./types"

function erp(id: string, valor: number, tipo: "DEBITO" | "CREDITO", descricao: string): ErpTransaction {
  return {
    id, data: new Date("2024-01-01T10:00:00Z"), descricao, valor, tipo,
    documento: null, fornecedor: null, banco: null, categoria: null
  }
}

function ext(id: string, valor: number, tipo: "DEBITO" | "CREDITO", descricao: string): ExtratoTransaction {
  return {
    id, origem: "EXTRATO", data: new Date("2024-01-01T10:00:00Z"), descricao, valor,
    tipo, saldoApos: null, identificador: null, banco: null
  }
}

describe("buildDia", () => {
  it("calcula totais e saldos corretamente", () => {
    const dia = buildDia(
      "2024-01-01",
      [erp("e1", 100, "DEBITO", "Pagamento A"), erp("e2", 50, "CREDITO", "Recebimento B")],
      [ext("x1", 100, "DEBITO", "Pagamento A"), ext("x2", 50, "CREDITO", "Recebimento B")]
    )

    expect(dia.totalDebitoErp).toBe(100)
    expect(dia.totalCreditoErp).toBe(50)
    expect(dia.totalDebitoExtrato).toBe(100)
    expect(dia.totalCreditoExtrato).toBe(50)
    expect(dia.saldoFinalErp).toBe(-50)
    expect(dia.saldoFinalExtrato).toBe(-50)
    expect(dia.qtdErp).toBe(2)
    expect(dia.qtdExtrato).toBe(2)
  })

  it("retorna SEM_DADOS quando dia vazio", () => {
    const dia = buildDia("2024-01-01", [], [])
    expect(dia.statusDia).toBe("SEM_DADOS")
    expect(dia.matches.detalhes).toHaveLength(0)
  })

  it("inclui resumo de matches", () => {
    const dia = buildDia(
      "2024-01-01",
      [erp("e1", 100, "DEBITO", "Pagamento Fornecedor XYZ")],
      [ext("x1", 100, "DEBITO", "Pagamento Fornecedor XYZ")]
    )
    expect(dia.matches.detalhes.length).toBeGreaterThan(0)
    expect(dia.qtdErp + dia.qtdExtrato).toBe(2)
  })
})
