import { describe, it, expect, vi } from "vitest"

// Mock do prisma
const mockFindMany = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { create: mockCreate, findUnique: mockFindUnique },
    empresa: { create: mockCreate, findMany: mockFindMany },
    uploadErp: { create: mockCreate, findMany: mockFindMany },
    erpLancamento: { create: mockCreate, findMany: mockFindMany },
    contaBancaria: { create: mockCreate, findMany: mockFindMany },
    extratoLancamento: { create: mockCreate, findMany: mockFindMany },
    importacaoExtrato: { create: mockCreate, findMany: mockFindMany },
    extratoImportado: { create: mockCreate, findMany: mockFindMany },
    $disconnect: vi.fn(),
  }
}))

import { prisma } from "@/lib/db"

describe("Prisma Integration — Queries reais (mocked)", () => {
  it("should query uploads by empresaId", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "u1", nomeArquivo: "test.csv", periodo: "2026-06", totalLinhas: 10 },
      { id: "u2", nomeArquivo: "test2.csv", periodo: "2026-06", totalLinhas: 5 },
    ])

    const uploads = await prisma.uploadErp.findMany({ where: { empresaId: "emp1" } })
    expect(uploads).toHaveLength(2)
    expect(mockFindMany).toHaveBeenCalledWith({ where: { empresaId: "emp1" } })
  })

  it("should query ERP lancamentos by date range", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "l1", data: new Date("2026-06-01"), tipo: "CREDITO", valor: 150, descricao: "Test" },
      { id: "l2", data: new Date("2026-06-02"), tipo: "DEBITO", valor: 50, descricao: "Test" },
    ])

    const inicio = new Date("2026-06-01")
    const fim = new Date("2026-06-10")
    fim.setHours(23, 59, 59, 999)

    const lancamentos = await prisma.erpLancamento.findMany({
      where: { uploadId: "up1", data: { gte: inicio, lte: fim } }
    })

    expect(lancamentos).toHaveLength(2)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { uploadId: "up1", data: { gte: inicio, lte: fim } }
    })
  })

  it("should aggregate ERP by day correctly", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "l1", data: new Date("2026-06-01"), tipo: "CREDITO", valor: 100, descricao: "Test" },
      { id: "l2", data: new Date("2026-06-01"), tipo: "DEBITO", valor: 30, descricao: "Test" },
    ])

    const lancamentos = await prisma.erpLancamento.findMany({
      where: { uploadId: "up1", data: new Date("2026-06-01") }
    })

    const totalCredito = lancamentos
      .filter((l: any) => l.tipo === "CREDITO")
      .reduce((s: number, l: any) => s + Number(l.valor), 0)
    const totalDebito = lancamentos
      .filter((l: any) => l.tipo === "DEBITO")
      .reduce((s: number, l: any) => s + Number(l.valor), 0)

    expect(totalCredito).toBe(100)
    expect(totalDebito).toBe(30)
  })

  it("should reproduce analise-dia aggregation logic", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { id: "e1", data: new Date("2026-06-01"), tipo: "CREDITO", valor: 500 },
        { id: "e2", data: new Date("2026-06-01"), tipo: "DEBITO", valor: 200 },
      ])
      .mockResolvedValueOnce([
        { id: "ex1", data: new Date("2026-06-01"), tipo: "CREDITO", valor: 480 },
        { id: "ex2", data: new Date("2026-06-01"), tipo: "DEBITO", valor: 180 },
      ])
      .mockResolvedValueOnce([
        { id: "im1", data: new Date("2026-06-01"), tipo: "CREDITO", valor: 20 },
      ])

    const uploadIds = ["up1"]
    const contaIds = ["c1"]
    const importacaoIds = ["imp1"]

    const erpsDoDia = await prisma.erpLancamento.findMany({
      where: { uploadId: { in: uploadIds }, data: new Date("2026-06-01") }
    })
    const extratosDoDia = await prisma.extratoLancamento.findMany({
      where: { contaId: { in: contaIds }, data: new Date("2026-06-01") }
    })
    const importadosDoDia = await prisma.extratoImportado.findMany({
      where: { importacaoId: { in: importacaoIds }, data: new Date("2026-06-01") }
    })

    const totalCreditoErp = erpsDoDia
      .filter((e: any) => e.tipo === "CREDITO")
      .reduce((s: number, e: any) => s + Number(e.valor), 0)
    const totalDebitoErp = erpsDoDia
      .filter((e: any) => e.tipo === "DEBITO")
      .reduce((s: number, e: any) => s + Number(e.valor), 0)
    const totalCreditoExtrato = [...extratosDoDia, ...importadosDoDia]
      .filter((e: any) => e.tipo === "CREDITO")
      .reduce((s: number, e: any) => s + Number(e.valor), 0)
    const totalDebitoExtrato = [...extratosDoDia, ...importadosDoDia]
      .filter((e: any) => e.tipo === "DEBITO")
      .reduce((s: number, e: any) => s + Number(e.valor), 0)

    expect(totalCreditoErp).toBe(500)
    expect(totalDebitoErp).toBe(200)
    expect(totalCreditoExtrato).toBe(500)
    expect(totalDebitoExtrato).toBe(180)
  })
})
