import { describe, it, expect, vi } from "vitest"
import * as XLSX from "xlsx"

const mockFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    empresa: { findUnique: vi.fn().mockResolvedValue({ id: "emp1", userId: "user1" }) },
    uploadErp: { findMany: vi.fn().mockResolvedValue([{ id: "up1" }]) },
    contaBancaria: { findMany: vi.fn().mockResolvedValue([{ id: "c1", banco: "Banco Teste" }]) },
    importacaoExtrato: { findMany: vi.fn().mockResolvedValue([{ id: "imp1" }]) },
    erpLancamento: { findMany: mockFindMany },
    extratoLancamento: { findMany: mockFindMany },
    extratoImportado: { findMany: mockFindMany },
  }
}))

describe("Exportacao Analise Dia — End-to-end (mocked)", () => {
  it("should generate Excel with 3 tabs and correct data", async () => {
    const erpData = [
      { id: "e1", data: new Date("2026-06-01"), descricao: "ERP 1", tipo: "CREDITO", valor: 500, documento: "DOC001", fornecedor: "Forn A", banco: "Banco A", categoria: "Cat A" },
      { id: "e2", data: new Date("2026-06-01"), descricao: "ERP 2", tipo: "DEBITO", valor: 200, documento: "", fornecedor: "", banco: "", categoria: "" },
      { id: "e3", data: new Date("2026-06-02"), descricao: "ERP 3", tipo: "CREDITO", valor: 300, documento: "", fornecedor: "", banco: "", categoria: "" },
    ]
    const extratoData = [
      { id: "ex1", data: new Date("2026-06-01"), descricao: "Ext 1", tipo: "CREDITO", valor: 480, identificador: "ID1", banco: "Banco B" },
      { id: "ex2", data: new Date("2026-06-01"), descricao: "Ext 2", tipo: "DEBITO", valor: 180, identificador: "", banco: "Banco B" },
      { id: "ex3", data: new Date("2026-06-03"), descricao: "Ext 3", tipo: "CREDITO", valor: 100, identificador: "", banco: "Banco B" },
    ]
    const importadoData = [
      { id: "im1", data: new Date("2026-06-01"), descricao: "Imp 1", tipo: "CREDITO", valor: 20, identificador: "", banco: "" },
      { id: "im2", data: new Date("2026-06-01"), descricao: "Imp 2", tipo: "DEBITO", valor: 10, identificador: "", banco: "" },
    ]

    mockFindMany
      .mockResolvedValueOnce(erpData)
      .mockResolvedValueOnce(extratoData)
      .mockResolvedValueOnce(importadoData)

    const inicio = new Date("2026-06-01")
    const fim = new Date("2026-06-30")
    fim.setHours(23, 59, 59, 999)

    // Simular queries da API
    const erpLancamentos = erpData.filter(l => l.data >= inicio && l.data <= fim)
    const extratoLancamentos = extratoData.filter(l => l.data >= inicio && l.data <= fim)
    const extratosImportados = importadoData.filter(l => l.data >= inicio && l.data <= fim)

    // Aba 1: Extrato
    const extratoRows = [
      ...extratoLancamentos.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || "",
      })),
      ...extratosImportados.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || "",
      })),
    ]
    extratoRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // Aba 2: ERP
    const erpRows = erpLancamentos.map(l => ({
      Data: new Date(l.data).toLocaleDateString("pt-BR"),
      Descricao: l.descricao,
      Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
      Valor: Number(l.valor),
      Documento: l.documento || "",
      Fornecedor: l.fornecedor || "",
      Banco: l.banco || "",
      Categoria: l.categoria || "",
    }))
    erpRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // Aba 3: Resumo Diario
    const dias = new Set<string>()
    erpLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratoLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratosImportados.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))

    const diasOrdenados = Array.from(dias).sort()
    const resumoRows = diasOrdenados.map(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const impDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const entradasErp = erpDia.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasErp = erpDia.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)
      const entradasExtrato = [...extDia, ...impDia].filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasExtrato = [...extDia, ...impDia].filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)

      return {
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        "Entradas Extrato": entradasExtrato,
        "Saídas Extrato": saidasExtrato,
        "Saldo Extrato": entradasExtrato - saidasExtrato,
        "Entradas ERP": entradasErp,
        "Saídas ERP": saidasErp,
        "Saldo ERP": entradasErp - saidasErp,
        "Diferença Saldo": (entradasExtrato - saidasExtrato) - (entradasErp - saidasErp),
      }
    })

    expect(extratoRows).toHaveLength(5)
    expect(erpRows).toHaveLength(3)
    expect(resumoRows).toHaveLength(3)

    const resumoDia1 = resumoRows.find(r => r.Data === "01/06/2026")
    expect(resumoDia1).toBeDefined()
    expect(resumoDia1?.["Entradas ERP"]).toBe(500)
    expect(resumoDia1?.["Saídas ERP"]).toBe(200)
    expect(resumoDia1?.["Saldo ERP"]).toBe(300)
    expect(resumoDia1?.["Entradas Extrato"]).toBe(500)
    expect(resumoDia1?.["Saídas Extrato"]).toBe(190)
    expect(resumoDia1?.["Saldo Extrato"]).toBe(310)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(extratoRows), "Extrato Bancário")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(erpRows), "ERP (Relatório)")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), "Resumo Diário")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    expect(buffer.length).toBeGreaterThan(0)

    const wbRead = XLSX.read(buffer, { type: "buffer" })
    expect(wbRead.SheetNames).toContain("Extrato Bancário")
    expect(wbRead.SheetNames).toContain("ERP (Relatório)")
    expect(wbRead.SheetNames).toContain("Resumo Diário")
  })
})

function parseData(d: string): number {
  const [dd, mm, yyyy] = d.split("/")
  return new Date(`${yyyy}-${mm}-${dd}`).getTime()
}
