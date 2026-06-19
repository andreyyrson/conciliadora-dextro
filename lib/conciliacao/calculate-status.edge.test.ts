import { describe, it, expect } from "vitest"
import { calculateStatus } from "./calculate-status"

const emptyMatching = { itens: [], erpsSobrando: [], extratosSobrando: [] }

describe("calculateStatus — bordas e prioridades", () => {
  it("retorna SEM_DADOS quando nao ha ERP nem Extrato", () => {
    const status = calculateStatus({
      qtdErp: 0,
      qtdExtrato: 0,
      matching: emptyMatching as any,
      totalDebitoErp: 0,
      totalCreditoErp: 0,
      totalDebitoExtrato: 0,
      totalCreditoExtrato: 0,
      diferencaDebito: 0,
      diferencaCredito: 0,
    })
    expect(status).toBe("SEM_DADOS")
  })

  it("prioriza A_REVISAR acima de outros", () => {
    const matching = {
      itens: [
        { status: "A_REVISAR" },
        { status: "CONCILIADO" },
      ],
      erpsSobrando: [],
      extratosSobrando: [],
    }
    const status = calculateStatus({
      qtdErp: 1,
      qtdExtrato: 1,
      matching: matching as any,
      totalDebitoErp: 0,
      totalCreditoErp: 0,
      totalDebitoExtrato: 0,
      totalCreditoExtrato: 0,
      diferencaDebito: 0,
      diferencaCredito: 0,
    })
    expect(status).toBe("A_REVISAR")
  })

  it("retorna NAO_CONCILIADO quando ha erps sobrando", () => {
    const matching = {
      itens: [],
      erpsSobrando: [{ id: "e1" }],
      extratosSobrando: [],
    }
    const status = calculateStatus({
      qtdErp: 1,
      qtdExtrato: 0,
      matching: matching as any,
      totalDebitoErp: 0,
      totalCreditoErp: 0,
      totalDebitoExtrato: 0,
      totalCreditoExtrato: 0,
      diferencaDebito: 0,
      diferencaCredito: 0,
    })
    expect(status).toBe("NAO_CONCILIADO")
  })

  it("retorna CONCILIADO quando ha conciliados e diferencas dentro da tolerancia", () => {
    const matching = {
      itens: [{ status: "CONCILIADO" }],
      erpsSobrando: [],
      extratosSobrando: [],
    }
    const status = calculateStatus({
      qtdErp: 1,
      qtdExtrato: 1,
      matching: matching as any,
      totalDebitoErp: 0,
      totalCreditoErp: 0,
      totalDebitoExtrato: 0,
      totalCreditoExtrato: 0,
      diferencaDebito: 0.001,
      diferencaCredito: 0.005,
    })
    expect(status).toBe("CONCILIADO")
  })
})
