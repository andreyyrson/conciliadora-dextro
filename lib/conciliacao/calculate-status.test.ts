import { describe, it, expect } from "vitest"
import { calculateStatus } from "./calculate-status"
import type { ResultadoMatching } from "./types"

function makeMatching(overrides: Partial<ResultadoMatching> = {}): ResultadoMatching {
  return {
    itens: [],
    erpsSobrando: [],
    extratosSobrando: [],
    ...overrides
  }
}

function item(status: "CONCILIADO" | "A_REVISAR") {
  return {
    erp: null,
    extrato: { id: "e", origem: "EXTRATO" as const, data: new Date(), valor: 1, tipo: "DEBITO" as const, descricao: "x" },
    status
  }
}

describe("calculateStatus", () => {
  it("retorna SEM_DADOS quando não há ERP nem extrato", () => {
    const status = calculateStatus({
      qtdErp: 0, qtdExtrato: 0, matching: makeMatching(),
      totalDebitoErp: 0, totalCreditoErp: 0, totalDebitoExtrato: 0, totalCreditoExtrato: 0,
      diferencaDebito: 0, diferencaCredito: 0
    })
    expect(status).toBe("SEM_DADOS")
  })

  it("retorna CONCILIADO quando tudo conciliado e diferenças zeradas", () => {
    const status = calculateStatus({
      qtdErp: 1, qtdExtrato: 1, matching: makeMatching({ itens: [item("CONCILIADO")] }),
      totalDebitoErp: 100, totalCreditoErp: 0, totalDebitoExtrato: 100, totalCreditoExtrato: 0,
      diferencaDebito: 0, diferencaCredito: 0
    })
    expect(status).toBe("CONCILIADO")
  })

  it("retorna A_REVISAR quando há itens a revisar", () => {
    const status = calculateStatus({
      qtdErp: 1, qtdExtrato: 1, matching: makeMatching({ itens: [item("A_REVISAR")] }),
      totalDebitoErp: 100, totalCreditoErp: 0, totalDebitoExtrato: 100, totalCreditoExtrato: 0,
      diferencaDebito: 0, diferencaCredito: 0
    })
    expect(status).toBe("A_REVISAR")
  })

  it("retorna NAO_CONCILIADO quando há extratos sobrando", () => {
    const status = calculateStatus({
      qtdErp: 1, qtdExtrato: 2, matching: makeMatching({
        itens: [item("CONCILIADO")],
        extratosSobrando: [{ id: "s1", origem: "EXTRATO" as const, data: new Date(), valor: 1, tipo: "DEBITO" as const, descricao: "sobra" }]
      }),
      totalDebitoErp: 100, totalCreditoErp: 0, totalDebitoExtrato: 80, totalCreditoExtrato: 0,
      diferencaDebito: 20, diferencaCredito: 0
    })
    expect(status).toBe("NAO_CONCILIADO")
  })

  it("retorna NAO_CONCILIADO quando há erps sobrando", () => {
    const status = calculateStatus({
      qtdErp: 2, qtdExtrato: 1, matching: makeMatching({
        itens: [item("CONCILIADO")],
        erpsSobrando: [{ id: "s1", origem: "ERP" as const, data: new Date(), valor: 1, tipo: "DEBITO" as const, descricao: "sobra" }]
      }),
      totalDebitoErp: 100, totalCreditoErp: 0, totalDebitoExtrato: 50, totalCreditoExtrato: 0,
      diferencaDebito: 50, diferencaCredito: 0
    })
    expect(status).toBe("NAO_CONCILIADO")
  })
})
