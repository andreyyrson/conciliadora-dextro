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

import { analisarPorDia } from "./index"

describe("analisarPorDia (orquestração)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.uploadFind.mockResolvedValue([{ id: "up1" }])
    mocks.contaFind.mockResolvedValue([{ id: "c1" }])
    mocks.importacaoFind.mockResolvedValue([{ id: "imp1" }, { id: "imp2" }])
  })

  it("compara múltiplos extratos (de importações diferentes) contra 1 ERP no mesmo dia", async () => {
    mocks.erpFind.mockResolvedValue([
      { id: "e1", data: new Date("2024-01-01T10:00:00Z"), descricao: "Pagamento Fornecedor ABC", valor: 200, tipo: "DEBITO", documento: null, fornecedor: "ABC", banco: "Itau", categoria: null },
      { id: "e2", data: new Date("2024-01-01T10:00:00Z"), descricao: "Recebimento Cliente XYZ", valor: 500, tipo: "CREDITO", documento: null, fornecedor: "XYZ", banco: "Itau", categoria: null }
    ])
    // Extrato de uma conta conectada
    mocks.extratoFind.mockResolvedValue([
      { id: "x1", data: new Date("2024-01-01T11:00:00Z"), descricao: "Pagamento Fornecedor ABC", valor: 200, tipo: "DEBITO", saldoApos: 1000, identificador: "ID1", banco: "Itau" }
    ])
    // Extrato vindo de importação OFX/CSV (multi-upload)
    mocks.importadoFind.mockResolvedValue([
      { id: "im1", data: new Date("2024-01-01T12:00:00Z"), descricao: "Recebimento Cliente XYZ", valor: 500, tipo: "CREDITO", saldoApos: null, identificador: null, banco: "Itau" }
    ])

    const dias = await analisarPorDia("emp1", new Date("2024-01-01T00:00:00Z"), new Date("2024-01-01T23:59:59Z"))

    expect(dias).toHaveLength(1)
    const dia = dias[0]
    expect(dia.qtdErp).toBe(2)
    expect(dia.qtdExtrato).toBe(2) // 1 da conta + 1 da importação
    expect(dia.matches.detalhes).toHaveLength(2)
    // Ambos os extratos devem casar com os ERPs
    expect(dia.matches.naoConciliados).toBe(0)
  })

  it("gera um item por dia do período mesmo sem dados", async () => {
    mocks.erpFind.mockResolvedValue([])
    mocks.extratoFind.mockResolvedValue([])
    mocks.importadoFind.mockResolvedValue([])

    const dias = await analisarPorDia("emp1", new Date("2024-01-01T00:00:00Z"), new Date("2024-01-03T23:59:59Z"))
    expect(dias).toHaveLength(3)
    expect(dias.every(d => d.statusDia === "SEM_DADOS")).toBe(true)
  })
})
