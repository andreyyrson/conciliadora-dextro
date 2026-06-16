import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TabelaComparativaConciliacao } from "./tabela-comparativa"

const baseProps = {
  modoEdicao: true,
  filtros: { search: "", tipo: "", dataInicio: "", dataFim: "", status: "" },
  onChangeFiltros: () => {},
  onAplicarFiltros: () => {},
  onSalvarErp: async () => {},
  onSalvarExtrato: async () => {},
  onDeletarErp: async () => {},
  onDeletarExtrato: async () => {},
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  onPageChange: () => {},
}

describe("TabelaComparativaConciliacao", () => {
  it("renderiza linha com data formatada e colunas ERP/Extrato", () => {
    const linhas = [{
      data: "2024-05-10T00:00:00.000Z",
      status: "match",
      erp: { id: "erp1", data: "2024-05-10T00:00:00.000Z", descricao: "ERP desc", valor: 100, tipo: "DEBITO", documento: "123", fornecedor: "ABC", categoria: "Cat", banco: "Itau" },
      extrato: { id: "ext1", data: "2024-05-10T00:00:00.000Z", descricao: "EXT desc", valor: 100, tipo: "DEBITO", identificador: "ID1", banco: "Itau", saldoApos: null },
    }]

    render(<TabelaComparativaConciliacao {...baseProps} linhas={linhas as any} />)

    // Data do dia (pt-BR)
    expect(screen.getByText(/10\/05\/2024/)).toBeTruthy()

    // Descrições presentes
    expect(screen.getByText("ERP desc")).toBeTruthy()
    expect(screen.getByText("EXT desc")).toBeTruthy()

    // Valor formatado no extrato
    expect(screen.getAllByText(/R\$/)[0].textContent).toContain("100,00")
  })

  it("mostra botões de ações quando modoEdicao=true", () => {
    const linhas = [{
      data: "2024-05-10T00:00:00.000Z",
      status: "match",
      erp: { id: "erp1", data: "2024-05-10T00:00:00.000Z", descricao: "ERP desc", valor: 100, tipo: "DEBITO", documento: null, fornecedor: null, categoria: null, banco: null },
      extrato: { id: "ext1", data: "2024-05-10T00:00:00.000Z", descricao: "EXT desc", valor: 100, tipo: "DEBITO", identificador: null, banco: null, saldoApos: null },
    }]

    render(<TabelaComparativaConciliacao {...baseProps} linhas={linhas as any} />)

    // Deve existir algum botão (ícones ghost) para editar/deletar
    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBeGreaterThan(0)
  })
})
