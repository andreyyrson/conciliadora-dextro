import { describe, it, expect } from "vitest"
import {
  normalizarValor,
  normalizarData,
  normalizarDescricao,
  normalizarCnpj,
  normalizarTipo,
  normalizarLinha,
  executarPipeline,
} from "./pipeline"

describe("normalizarValor", () => {
  it("deve retornar 0 para null/undefined/vazio", () => {
    expect(normalizarValor(null)).toBe(0)
    expect(normalizarValor(undefined)).toBe(0)
    expect(normalizarValor("")).toBe(0)
  })

  it("deve converter formato brasileiro com ponto de milhar e vírgula decimal", () => {
    expect(normalizarValor("1.050,23")).toBe(1050.23)
    expect(normalizarValor("10.000,00")).toBe(10000)
  })

  it("deve converter formato brasileiro simples com vírgula", () => {
    expect(normalizarValor("5,25")).toBe(5.25)
    expect(normalizarValor("100,99")).toBe(100.99)
  })

  it("deve converter formato americano", () => {
    expect(normalizarValor("1,050.23")).toBe(1050.23)
  })

  it("deve remover símbolos monetários", () => {
    expect(normalizarValor("R$ 1.050,23")).toBe(1050.23)
    expect(normalizarValor("R$ 5,25")).toBe(5.25)
  })

  it("deve converter número puro", () => {
    expect(normalizarValor(1050.23)).toBe(1050.23)
    expect(normalizarValor("1050.23")).toBe(1050.23)
  })

  it("deve retornar 0 para valores inválidos", () => {
    expect(normalizarValor("abc")).toBe(0)
    expect(normalizarValor("R$ --")).toBe(0)
  })
})

describe("normalizarData", () => {
  it("deve converter DD/MM/YYYY", () => {
    const result = normalizarData("15/01/2024")
    expect(result.getUTCFullYear()).toBe(2024)
    expect(result.getUTCMonth()).toBe(0)
    expect(result.getUTCDate()).toBe(15)
  })

  it("deve converter DD-MM-YYYY", () => {
    const result = normalizarData("15-01-2024")
    expect(result.getUTCFullYear()).toBe(2024)
    expect(result.getUTCMonth()).toBe(0)
    expect(result.getUTCDate()).toBe(15)
  })

  it("deve converter YYYY-MM-DD (ISO)", () => {
    const result = normalizarData("2024-01-15")
    expect(result.getUTCFullYear()).toBe(2024)
    expect(result.getUTCMonth()).toBe(0)
    expect(result.getUTCDate()).toBe(15)
  })

  it("deve converter DD/MM/YY", () => {
    const result = normalizarData("15/01/24")
    expect(result.getFullYear()).toBe(2024)
  })

  it("deve remover dia da semana", () => {
    const result = normalizarData("15/01/2024 - SEX")
    expect(result.getUTCDate()).toBe(15)
  })

  it("deve retornar data atual para input vazio", () => {
    const result = normalizarData("")
    expect(result).toBeInstanceOf(Date)
  })
})

describe("normalizarDescricao", () => {
  it("deve fazer trim e uppercase", () => {
    expect(normalizarDescricao("  pagamento  ")).toBe("PAGAMENTO")
  })

  it("deve remover espaços duplos", () => {
    expect(normalizarDescricao("pagamento  fornecedor")).toBe("PAGAMENTO FORNECEDOR")
  })

  it("deve retornar string vazia para input vazio", () => {
    expect(normalizarDescricao("")).toBe("")
    expect(normalizarDescricao(null)).toBe("")
    expect(normalizarDescricao(undefined)).toBe("")
  })
})

describe("normalizarCnpj", () => {
  it("deve remover pontos, traços e barras", () => {
    expect(normalizarCnpj("11.222.333/0001-81")).toBe("11222333000181")
  })

  it("deve manter apenas números", () => {
    expect(normalizarCnpj("11222333000181")).toBe("11222333000181")
  })

  it("deve retornar string vazia para input vazio", () => {
    expect(normalizarCnpj("")).toBe("")
    expect(normalizarCnpj(null)).toBe("")
  })
})

describe("normalizarTipo", () => {
  it("deve detectar CREDITO por palavras-chave", () => {
    expect(normalizarTipo("credito", 100)).toBe("CREDITO")
    expect(normalizarTipo("recebido", 100)).toBe("CREDITO")
    expect(normalizarTipo("entrada", 100)).toBe("CREDITO")
    expect(normalizarTipo("depósito", 100)).toBe("CREDITO")
  })

  it("deve detectar DEBITO por palavras-chave", () => {
    expect(normalizarTipo("debito", -100)).toBe("DEBITO")
    expect(normalizarTipo("pago", -100)).toBe("DEBITO")
    expect(normalizarTipo("pagamento", -100)).toBe("DEBITO")
    expect(normalizarTipo("despesa", -100)).toBe("DEBITO")
  })

  it("deve usar valor como fallback", () => {
    expect(normalizarTipo("", 100)).toBe("CREDITO")
    expect(normalizarTipo("", -100)).toBe("DEBITO")
    expect(normalizarTipo(null, -50)).toBe("DEBITO")
  })
})

describe("normalizarLinha", () => {
  const mockMapeamento = {
    data: "Data",
    valor: "Valor",
    tipo: "Tipo",
    descricao: "Descricao",
    fornecedor: "Fornecedor",
    identificador: "Identificador",
  }

  it("deve normalizar uma linha completa", () => {
    const linha = {
      Data: "15/01/2024",
      Valor: "1.050,23",
      Tipo: "DEBITO",
      Descricao: "Pagamento fornecedor",
      Fornecedor: "ABC Ltda",
      Identificador: "TXN-001",
    }

    const result = normalizarLinha(linha, mockMapeamento)
    expect(result.data.getUTCDate()).toBe(15)
    expect(result.valor).toBe(1050.23)
    expect(result.tipo).toBe("DEBITO")
    expect(result.descricao).toBe("PAGAMENTO FORNECEDOR")
    expect(result.fornecedor).toBe("ABC LTDA")
    expect(result.identificador).toBe("TXN-001")
  })

  it("deve converter valor negativo para positivo com tipo DEBITO", () => {
    const linha = {
      Data: "15/01/2024",
      Valor: "-500,00",
      Tipo: "",
      Descricao: "Saque",
    }

    const result = normalizarLinha(linha, mockMapeamento)
    expect(result.valor).toBe(500)
    expect(result.tipo).toBe("DEBITO")
  })
})

describe("executarPipeline", () => {
  const mockMapeamento = {
    data: "Data",
    valor: "Valor",
    tipo: "Tipo",
    descricao: "Descricao",
  }

  it("deve filtrar linhas sem valor", () => {
    const linhas = [
      { Data: "15/01/2024", Valor: "1.000,00", Tipo: "DEBITO", Descricao: "Teste 1" },
      { Data: "15/01/2024", Valor: "", Tipo: "DEBITO", Descricao: "Teste 2" },
      { Data: "15/01/2024", Valor: "0", Tipo: "DEBITO", Descricao: "Teste 3" },
    ]

    const result = executarPipeline(linhas, mockMapeamento)
    expect(result).toHaveLength(1)
    expect(result[0].descricao).toBe("TESTE 1")
  })

  it("deve processar múltiplas linhas", () => {
    const linhas = [
      { Data: "15/01/2024", Valor: "1.000,00", Tipo: "DEBITO", Descricao: "Teste 1" },
      { Data: "16/01/2024", Valor: "2.000,00", Tipo: "CREDITO", Descricao: "Teste 2" },
    ]

    const result = executarPipeline(linhas, mockMapeamento)
    expect(result).toHaveLength(2)
    expect(result[0].valor).toBe(1000)
    expect(result[1].valor).toBe(2000)
  })
})
