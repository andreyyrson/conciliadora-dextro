import { describe, it, expect } from "vitest"
import {
  detectarColunas,
  calcularScore,
  detectarPorConteudo,
  aplicarMapeamento,
  CampoPadrao,
} from "./detector-colunas"

// ========== REGRAS DE NEGÓCIO: DETECÇÃO POR NOME DE COLUNA ==========
describe("calcularScore - heurísticas de nome", () => {
  it("deve detectar 'Data' como data com score alto", () => {
    const score = calcularScore("Data", "data")
    expect(score).toBeGreaterThan(0.7)
  })

  it("deve detectar 'Valor' como valor com score alto", () => {
    const score = calcularScore("Valor", "valor")
    expect(score).toBeGreaterThan(0.7)
  })

  it("deve detectar 'Descrição' como descricao com score alto", () => {
    const score = calcularScore("Descrição", "descricao")
    expect(score).toBeGreaterThan(0.7)
  })

  it("deve detectar nomes em inglês", () => {
    expect(calcularScore("Date", "data")).toBeGreaterThan(0.7)
    expect(calcularScore("Amount", "valor")).toBeGreaterThan(0.7)
    expect(calcularScore("Description", "descricao")).toBeGreaterThan(0.7)
  })

  it("deve detectar variações brasileiras", () => {
    expect(calcularScore("Data Pagamento", "data")).toBeGreaterThan(0.5)
    expect(calcularScore("Valor Líquido", "valor")).toBeGreaterThan(0.5)
    expect(calcularScore("Histórico", "descricao")).toBeGreaterThan(0.5)
  })

  it("deve retornar score baixo para nomes irrelevantes", () => {
    expect(calcularScore("XYZABC", "data")).toBeLessThan(0.35)
    expect(calcularScore("FOOBAR123", "valor")).toBeLessThan(0.35)
  })

  it("deve detectar prefixo/sufixo com score 0.75", () => {
    expect(calcularScore("Data de Vencimento", "data")).toBeGreaterThanOrEqual(0.7)
  })
})

// ========== REGRAS DE NEGÓCIO: DETECÇÃO POR CONTEÚDO ==========
describe("detectarPorConteudo - inferência por células", () => {
  it("deve inferir data quando ≥ 70% das células são datas DD/MM/YYYY", () => {
    const linhas = Array.from({ length: 10 }, (_, i) => ({
      colA: `${String(i + 1).padStart(2, "0")}/01/2024`,
    }))
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBe("data")
    expect(result.score).toBeGreaterThanOrEqual(0.85)
  })

  it("deve inferir valor quando ≥ 70% das células são monetárias", () => {
    const linhas = [
      { colA: "1.050,23" },
      { colA: "R$ 500,00" },
      { colA: "-1.234,56" },
      { colA: "10.000,00" },
      { colA: "0,00" },
      { colA: "99,99" },
      { colA: "1.000,00" },
      { colA: "2.500,00" },
      { colA: "100,00" },
      { colA: "50,00" },
    ]
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBe("valor")
    expect(result.score).toBeGreaterThanOrEqual(0.85)
  })

  it("deve inferir saldo quando nome contém 'saldo' e valores monetários", () => {
    const linhas = [
      { "Saldo Atual": "10.000,00" },
      { "Saldo Atual": "9.500,00" },
      { "Saldo Atual": "11.200,00" },
    ]
    const result = detectarPorConteudo("Saldo Atual", linhas)
    expect(result.campo).toBe("saldoApos")
  })

  it("deve inferir CNPJ quando ≥ 50% das células são CNPJs", () => {
    const linhas = [
      { colA: "11.222.333/0001-81" },
      { colA: "11222333000181" },
      { colA: "11.222.333/0001-82" },
      { colA: "11.222.333/0001-83" },
    ]
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBe("cnpj")
    expect(result.score).toBeGreaterThanOrEqual(0.9)
  })

  it("deve inferir tipo quando ≥ 60% das células são tipos conhecidos", () => {
    const linhas = [
      { colA: "C" },
      { colA: "D" },
      { colA: "CREDITO" },
      { colA: "DEBITO" },
      { colA: "entrada" },
      { colA: "saída" },
      { colA: "C" },
      { colA: "D" },
      { colA: "C" },
      { colA: "D" },
    ]
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBe("tipo")
    expect(result.score).toBeGreaterThanOrEqual(0.8)
  })

  it("deve inferir status quando ≥ 50% das células são status conhecidos", () => {
    const linhas = [
      { colA: "pago" },
      { colA: "pendente" },
      { colA: "cancelado" },
      { colA: "processado" },
    ]
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBe("status")
  })

  it("deve retornar null quando não reconhece o conteúdo", () => {
    const linhas = [
      { colA: "foobar" },
      { colA: "bazqux" },
      { colA: "lorem ipsum" },
    ]
    const result = detectarPorConteudo("colA", linhas)
    expect(result.campo).toBeNull()
    expect(result.score).toBe(0)
  })
})

// ========== REGRAS DE NEGÓCIO: DETECÇÃO COMPLETA ==========
describe("detectarColunas - mapeamento completo", () => {
  it("deve mapear colunas óbvias por nome", () => {
    const colunas = ["Data", "Valor", "Descrição", "Tipo"]
    const preview = [
      { Data: "15/01/2024", Valor: "1.000,00", Descrição: "Teste", Tipo: "DEBITO" },
    ]
    const result = detectarColunas(colunas, preview)
    expect(result.mapeamento["data"]).toBe("Data")
    expect(result.mapeamento["valor"]).toBe("Valor")
    expect(result.mapeamento["descricao"]).toBe("Descrição")
    expect(result.mapeamento["tipo"]).toBe("Tipo")
  })

  it("deve usar fallback por conteúdo quando nome não ajuda", () => {
    const colunas = ["A", "B", "C", "D"]
    const preview = [
      { A: "15/01/2024", B: "1.000,00", C: "Pagamento teste", D: "D" },
    ]
    const result = detectarColunas(colunas, preview)
    expect(result.mapeamento["data"]).toBe("A")
    expect(result.mapeamento["valor"]).toBe("B")
    expect(result.mapeamento["descricao"]).toBe("C")
    expect(result.mapeamento["tipo"]).toBe("D")
  })

  it("deve retornar colunas não mapeadas", () => {
    const colunas = ["Data", "Valor", "Descrição", "Extra1", "Extra2"]
    const preview = [
      { Data: "15/01/2024", Valor: "1.000,00", Descrição: "Teste", Extra1: "x", Extra2: "y" },
    ]
    const result = detectarColunas(colunas, preview)
    expect(result.colunasNaoMapeadas).toContain("Extra1")
    expect(result.colunasNaoMapeadas).toContain("Extra2")
  })

  it("deve gerar preview com até 50 linhas", () => {
    const colunas = ["Data"]
    const preview = Array.from({ length: 100 }, (_, i) => ({ Data: `${i}/01/2024` }))
    const result = detectarColunas(colunas, preview)
    expect(result.preview).toHaveLength(50)
  })
})

// ========== REGRAS DE NEGÓCIO: MAPEAMENTO MANUAL ==========
describe("aplicarMapeamento - override do usuário", () => {
  it("deve sobrescrever mapeamento automático com mapeamento do usuário", () => {
    const auto = detectarColunas(["Data", "Valor", "Desc"], [
      { Data: "15/01/2024", Valor: "1.000,00", Desc: "Teste" },
    ])
    const usuario = { data: "Desc", descricao: "Data" }
    const result = aplicarMapeamento(usuario, auto)
    expect(result.mapeamento["data"]).toBe("Desc")
    expect(result.mapeamento["descricao"]).toBe("Data")
  })

  it("deve definir confiança máxima para campos confirmados pelo usuário", () => {
    const auto = detectarColunas(["Data"], [{ Data: "15/01/2024" }])
    const usuario = { data: "Data" }
    const result = aplicarMapeamento(usuario, auto)
    expect(result.confianca["data"]).toBe(1.0)
  })

  it("deve permitir desmarcar campo (null)", () => {
    const auto = detectarColunas(["Data"], [{ Data: "15/01/2024" }])
    const usuario = { data: null }
    const result = aplicarMapeamento(usuario, auto)
    expect(result.mapeamento["data"]).toBeNull()
    expect(result.confianca["data"]).toBe(0)
  })
})
