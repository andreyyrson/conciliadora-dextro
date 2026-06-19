import { describe, it, expect, vi, beforeEach } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    uploadFind: vi.fn(),
    contaFind: vi.fn(),
    importacaoFind: vi.fn(),
    erpFind: vi.fn(),
    extratoFind: vi.fn(),
    importadoFind: vi.fn()
  }
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    uploadErp: { findMany: mocks.uploadFind },
    contaBancaria: { findMany: mocks.contaFind },
    importacaoExtrato: { findMany: mocks.importacaoFind },
    erpLancamento: { findMany: mocks.erpFind },
    extratoLancamento: { findMany: mocks.extratoFind },
    extratoImportado: { findMany: mocks.importadoFind }
  }
}))

import { fetchConciliationData } from "./fetch-data"

describe("fetchConciliationData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.uploadFind.mockResolvedValue([{ id: "up1" }])
    mocks.contaFind.mockResolvedValue([{ id: "c1" }])
    mocks.importacaoFind.mockResolvedValue([{ id: "imp1" }])
  })

  it("normaliza ERP e combina extratos de contas + importados", async () => {
    mocks.erpFind.mockResolvedValue([
      { id: "e1", data: new Date("2024-01-01"), descricao: "ERP 1", valor: 100, tipo: "DEBITO", documento: "D1", fornecedor: "F1", banco: "B1", categoria: "Cat" }
    ])
    mocks.extratoFind.mockResolvedValue([
      { id: "x1", data: new Date("2024-01-01"), descricao: "Ext 1", valor: 100, tipo: "DEBITO", saldoApos: 500, identificador: "ID1", banco: "B1" }
    ])
    mocks.importadoFind.mockResolvedValue([
      { id: "im1", data: new Date("2024-01-02"), descricao: "Imp 1", valor: 50, tipo: "CREDITO", saldoApos: null, identificador: null, banco: null }
    ])

    const result = await fetchConciliationData("emp1", new Date("2024-01-01"), new Date("2024-01-31"))

    expect(result.erpLancamentos).toHaveLength(1)
    expect(result.erpLancamentos[0]).toMatchObject({ id: "e1", valor: 100, tipo: "DEBITO" })
    expect(result.extratoLancamentos).toHaveLength(2)
    expect(result.extratoLancamentos[0].origem).toBe("EXTRATO")
    expect(result.extratoLancamentos[1].origem).toBe("EXTRATO_IMPORTADO")
  })

  it("retorna vazio quando não há dados", async () => {
    mocks.erpFind.mockResolvedValue([])
    mocks.extratoFind.mockResolvedValue([])
    mocks.importadoFind.mockResolvedValue([])

    const result = await fetchConciliationData("emp1", new Date("2024-01-01"), new Date("2024-01-31"))
    expect(result.erpLancamentos).toHaveLength(0)
    expect(result.extratoLancamentos).toHaveLength(0)
  })

  it("filtra por banco case-insensitive sem acentos", async () => {
    mocks.erpFind.mockResolvedValue([
      { id: "e1", data: new Date("2024-01-01"), descricao: "ERP Itaú", valor: 100, tipo: "DEBITO", documento: "D1", fornecedor: "F1", banco: "Itaú", categoria: "Cat" },
      { id: "e2", data: new Date("2024-01-01"), descricao: "ERP Bradesco", valor: 200, tipo: "DEBITO", documento: "D2", fornecedor: "F2", banco: "Bradesco", categoria: "Cat" }
    ])
    mocks.extratoFind.mockResolvedValue([
      { id: "x1", data: new Date("2024-01-01"), descricao: "Ext Itaú", valor: 100, tipo: "DEBITO", saldoApos: 500, identificador: "ID1", banco: "Itaú" },
      { id: "x2", data: new Date("2024-01-01"), descricao: "Ext Bradesco", valor: 200, tipo: "DEBITO", saldoApos: 600, identificador: "ID2", banco: "Bradesco" }
    ])
    mocks.importadoFind.mockResolvedValue([
      { id: "im1", data: new Date("2024-01-02"), descricao: "Imp Itaú", valor: 50, tipo: "CREDITO", saldoApos: null, identificador: null, banco: "Itaú" }
    ])

    const result = await fetchConciliationData("emp1", new Date("2024-01-01"), new Date("2024-01-31"), undefined, "itau")

    expect(result.erpLancamentos).toHaveLength(1)
    expect(result.erpLancamentos[0].id).toBe("e1")
    expect(result.extratoLancamentos).toHaveLength(2)
    expect(result.extratoLancamentos.every(ex => ex.banco === "Itaú")).toBe(true)
  })

  it("retorna arrays vazios quando banco não existe", async () => {
    mocks.erpFind.mockResolvedValue([
      { id: "e1", data: new Date("2024-01-01"), descricao: "ERP 1", valor: 100, tipo: "DEBITO", documento: "D1", fornecedor: "F1", banco: "Itaú", categoria: "Cat" }
    ])
    mocks.extratoFind.mockResolvedValue([
      { id: "x1", data: new Date("2024-01-01"), descricao: "Ext 1", valor: 100, tipo: "DEBITO", saldoApos: 500, identificador: "ID1", banco: "Itaú" }
    ])
    mocks.importadoFind.mockResolvedValue([])

    const result = await fetchConciliationData("emp1", new Date("2024-01-01"), new Date("2024-01-31"), undefined, "Banco Inexistente")

    expect(result.erpLancamentos).toHaveLength(0)
    expect(result.extratoLancamentos).toHaveLength(0)
  })
})
