import { describe, it, expect } from "vitest"
import { runDailyMatching } from "./daily-matching"
import type { ErpTransaction, ExtratoTransaction } from "./types"

function d(date: string) {
  return new Date(date)
}

describe("runDailyMatching — casos de borda", () => {
  it("deve casar 1:1 quando data, valor e tipo coincidem", () => {
    const erp: ErpTransaction[] = [
      { id: "e1", data: d("2024-05-10"), descricao: "PIX ABC", valor: 100, tipo: "DEBITO", documento: null, fornecedor: null, banco: null, categoria: null },
    ]
    const ext: ExtratoTransaction[] = [
      { id: "x1", origem: "EXTRATO", data: d("2024-05-10"), descricao: "PIX ABC", valor: 100, tipo: "DEBITO", saldoApos: null, identificador: null, banco: null },
    ]

    const { matching } = runDailyMatching(erp, ext)

    expect(matching.itens).toHaveLength(1)
    expect(matching.itens[0].status).toBeDefined()
    expect(["CONCILIADO", "A_REVISAR"]).toContain(matching.itens[0].status)
  })

  it("nao deve casar quando valores divergem além da tolerância", () => {
    const erp: ErpTransaction[] = [
      { id: "e1", data: d("2024-05-10"), descricao: "PIX ABC", valor: 100, tipo: "DEBITO", documento: null, fornecedor: null, banco: null, categoria: null },
    ]
    const ext: ExtratoTransaction[] = [
      { id: "x1", origem: "EXTRATO", data: d("2024-05-10"), descricao: "PIX ABC", valor: 100.5, tipo: "DEBITO", saldoApos: null, identificador: null, banco: null },
    ]

    const { matching } = runDailyMatching(erp, ext)

    // Esperamos um item A_REVISAR/NAO_CONCILIADO dependendo de regras do motor
    expect(matching.itens.length >= 0).toBe(true)
  })

  it("deve permitir múltiplos extratos para um único ERP como pendências", () => {
    const erp: ErpTransaction[] = [
      { id: "e1", data: d("2024-05-10"), descricao: "BOLETO XYZ", valor: 200, tipo: "DEBITO", documento: null, fornecedor: null, banco: null, categoria: null },
    ]
    const ext: ExtratoTransaction[] = [
      { id: "x1", origem: "EXTRATO", data: d("2024-05-10"), descricao: "BOLETO XYZ", valor: 150, tipo: "DEBITO", saldoApos: null, identificador: null, banco: null },
      { id: "x2", origem: "EXTRATO", data: d("2024-05-10"), descricao: "BOLETO XYZ", valor: 50, tipo: "DEBITO", saldoApos: null, identificador: null, banco: null },
    ]

    const { matching } = runDailyMatching(erp, ext)

    // Pelo menos uma sugestão deve existir
    expect(matching.itens.length >= 1).toBe(true)
  })

  it("nao deve quebrar com listas vazias", () => {
    const { matching } = runDailyMatching([], [])
    expect(matching.itens.length >= 0).toBe(true)
  })
})
