import { describe, it, expect } from "vitest"
import {
  scoreValor,
  scoreData,
  scoreDescricao,
  scoreFornecedor,
  scoreBanco,
  passaPreFiltro,
  calcularConfianca,
  gerarExplicacoes,
  normalizarBanco,
  similaridadeHibrida,
  gerarSugestoes,
  EntradaConciliacao,
} from "./engine"

// ========== REGRAS DE NEGÓCIO: SCORE DE VALOR ==========
describe("scoreValor - regras de limiar", () => {
  it("deve retornar 50 para valores idênticos (< 0,01 de diferença)", () => {
    expect(scoreValor(1000.0, 1000.0)).toBe(50)
    expect(scoreValor(1000.0, 1000.009)).toBe(50)
  })

  it("deve retornar 45 para diferença ≤ 0,5%", () => {
    expect(scoreValor(1000, 995)).toBe(45)   // 0,5%
    expect(scoreValor(1000, 1005)).toBe(45)  // 0,5%
  })

  it("deve retornar 40 para diferença ≤ 1%", () => {
    expect(scoreValor(1000, 990)).toBe(40)  // 1%
    expect(scoreValor(1000, 1010)).toBe(40) // 1%
  })

  it("deve retornar 30 para diferença ≤ 2%", () => {
    expect(scoreValor(1000, 980)).toBe(30)  // 2%
    expect(scoreValor(1000, 1020)).toBe(30) // 2%
  })

  it("deve retornar 15 para diferença ≤ 5%", () => {
    expect(scoreValor(1000, 950)).toBe(15)  // 5%
    expect(scoreValor(1000, 1050)).toBe(15) // 5%
  })

  it("deve retornar 0 para diferença > 5%", () => {
    expect(scoreValor(1000, 940)).toBe(0)   // 6%
    expect(scoreValor(1000, 1060)).toBe(0) // 6%
  })

  it("deve lidar com valor zero como máximo", () => {
    expect(scoreValor(0, 0)).toBe(50)
  })
})

// ========== REGRAS DE NEGÓCIO: SCORE DE DATA ==========
describe("scoreData - regras de limiar", () => {
  it("deve retornar 10 para mesma data", () => {
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-15"))).toBe(10)
  })

  it("deve retornar 10 para diferença ≤ 3 dias", () => {
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-12"))).toBe(10)
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-18"))).toBe(10)
  })

  it("deve retornar 5 para diferença entre 4 e 7 dias", () => {
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-11"))).toBe(5)
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-22"))).toBe(5)
  })

  it("deve retornar 0 para diferença > 7 dias", () => {
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-07"))).toBe(0) // 8 dias
    expect(scoreData(new Date("2024-01-15"), new Date("2024-01-24"))).toBe(0) // 9 dias
  })
})

// ========== REGRAS DE NEGÓCIO: SCORE DE DESCRIÇÃO ==========
describe("scoreDescricao - similaridade híbrida", () => {
  it("deve retornar 25 para descrições idênticas", () => {
    expect(scoreDescricao("PAGAMENTO FORNECEDOR", "PAGAMENTO FORNECEDOR")).toBe(25)
  })

  it("deve retornar valor proporcional para descrições similares", () => {
    const score = scoreDescricao("PAGAMENTO FORNECEDOR XYZ", "PAGAMENTO FORNECEDOR ABC")
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(25)
  })

  it("deve retornar baixo score para descrições muito diferentes", () => {
    const score = scoreDescricao("PAGAMENTO FORNECEDOR", "RECEBIMENTO CLIENTE")
    expect(score).toBeLessThan(10)
  })
})

// ========== REGRAS DE NEGÓCIO: SCORE DE FORNECEDOR ==========
describe("scoreFornecedor - regras de negócio", () => {
  it("deve retornar 15 quando fornecedor está contido na descrição", () => {
    expect(scoreFornecedor("XYZ LTDA", "PAGAMENTO XYZ LTDA")).toBe(15)
  })

  it("deve retornar score proporcional quando fornecedor é similar", () => {
    const score = scoreFornecedor("XYZ LTDA", "PAGAMENTO XYZ LIMITADA")
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(15)
  })

  it("deve retornar 0 quando fornecedor não é encontrado", () => {
    expect(scoreFornecedor("XYZ LTDA", "PAGAMENTO ABC")).toBe(0)
  })

  it("deve retornar 0 quando fornecedor é nulo", () => {
    expect(scoreFornecedor(null, "PAGAMENTO")).toBe(0)
    expect(scoreFornecedor("XYZ", null)).toBe(0)
  })
})

// ========== REGRAS DE NEGÓCIO: SCORE DE BANCO ==========
describe("scoreBanco - regras de normalização", () => {
  it("deve retornar 20 para bancos idênticos após normalização", () => {
    expect(scoreBanco("ITAU", "ITAU")).toBe(20)
    expect(scoreBanco("BB", "BANCO DO BRASIL")).toBe(20)
  })

  it("deve retornar score proporcional para bancos similares", () => {
    const score = scoreBanco("ITAU", "ITAÚ UNIBANCO")
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(20)
  })

  it("deve retornar 0 quando banco é nulo", () => {
    expect(scoreBanco(null, "ITAU")).toBe(0)
    expect(scoreBanco("ITAU", null)).toBe(0)
  })
})

describe("normalizarBanco", () => {
  it("deve normalizar abreviações", () => {
    expect(normalizarBanco("BB")).toBe("DO BRASIL")
    expect(normalizarBanco("ITAU")).toBe("ITAU")
  })

  it("deve remover acentos e palavras comuns", () => {
    expect(normalizarBanco("BANCO DO BRASIL")).toBe("DO BRASIL")
    expect(normalizarBanco("CAIXA ECONÔMICA FEDERAL")).toBe("CAIXA")
  })
})

// ========== REGRAS DE NEGÓCIO: PRÉ-FILTRO ==========
describe("passaPreFiltro - regras de elegibilidade", () => {
  const baseErp: EntradaConciliacao = {
    id: "erp-1",
    origem: "ERP",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "TESTE",
  }

  const baseExt: EntradaConciliacao = {
    id: "ext-1",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "TESTE",
  }

  it("deve passar quando tipo, valor e data estão dentro dos limites", () => {
    expect(passaPreFiltro(baseErp, baseExt)).toBe(true)
  })

  it("deve rejeitar quando tipo é diferente", () => {
    const ext = { ...baseExt, tipo: "CREDITO" as const }
    expect(passaPreFiltro(baseErp, ext)).toBe(false)
  })

  it("deve rejeitar quando valor difere > 5%", () => {
    const ext = { ...baseExt, valor: 940 } // 6% de diferença
    expect(passaPreFiltro(baseErp, ext)).toBe(false)
  })

  it("deve aceitar quando valor difere ≤ 5%", () => {
    const ext = { ...baseExt, valor: 950 } // 5% de diferença
    expect(passaPreFiltro(baseErp, ext)).toBe(true)
  })

  it("deve rejeitar quando data difere > 7 dias", () => {
    const ext = { ...baseExt, data: new Date("2024-01-23") } // 8 dias
    expect(passaPreFiltro(baseErp, ext)).toBe(false)
  })

  it("deve aceitar quando data difere ≤ 7 dias", () => {
    const ext = { ...baseExt, data: new Date("2024-01-22") } // 7 dias
    expect(passaPreFiltro(baseErp, ext)).toBe(true)
  })
})

// ========== REGRAS DE NEGÓCIO: CONFIANÇA ==========
describe("calcularConfianca - regras de classificação", () => {
  it("deve retornar HIGH para score ≥ 90", () => {
    expect(calcularConfianca(90)).toBe("HIGH")
    expect(calcularConfianca(120)).toBe("HIGH")
  })

  it("deve retornar MEDIUM para score entre 70 e 89", () => {
    expect(calcularConfianca(70)).toBe("MEDIUM")
    expect(calcularConfianca(89)).toBe("MEDIUM")
  })

  it("deve retornar LOW para score < 70", () => {
    expect(calcularConfianca(69)).toBe("LOW")
    expect(calcularConfianca(20)).toBe("LOW")
  })
})

// ========== REGRAS DE NEGÓCIO: EXPLICAÇÕES ==========
describe("gerarExplicacoes - regras de mensagens", () => {
  it("deve gerar explicação de valor idêntico", () => {
    const exps = gerarExplicacoes({ valor: 50, tipo: 0, data: 0, descricao: 0, fornecedor: 0, banco: 0 })
    expect(exps).toContain("Valor idêntico")
  })

  it("deve gerar explicação de valor ≤ 0,5%", () => {
    const exps = gerarExplicacoes({ valor: 45, tipo: 0, data: 0, descricao: 0, fornecedor: 0, banco: 0 })
    expect(exps).toContain("Valor muito próximo (≤ 0,5%)")
  })

  it("deve gerar explicação de data próxima ≤ 3 dias", () => {
    const exps = gerarExplicacoes({ valor: 0, tipo: 0, data: 10, descricao: 0, fornecedor: 0, banco: 0 })
    expect(exps).toContain("Data próxima (≤ 3 dias)")
  })

  it("deve gerar explicação de banco idêntico", () => {
    const exps = gerarExplicacoes({ valor: 0, tipo: 0, data: 0, descricao: 0, fornecedor: 0, banco: 20 })
    expect(exps).toContain("Banco idêntico")
  })

  it("deve não gerar explicações para score zero", () => {
    const exps = gerarExplicacoes({ valor: 0, tipo: 0, data: 0, descricao: 0, fornecedor: 0, banco: 0 })
    expect(exps).toHaveLength(0)
  })
})

// ========== REGRAS DE NEGÓCIO: AUTO-CONFIRMAÇÃO ==========
describe("gerarSugestoes - auto-confirmação", () => {
  const erpBase: EntradaConciliacao = {
    id: "erp-auto",
    origem: "ERP",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PAGAMENTO FORNECEDOR XYZ LTDA",
    fornecedor: "XYZ LTDA",
    banco: "ITAU",
  }

  const extBase: EntradaConciliacao = {
    id: "ext-auto",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PAGAMENTO FORNECEDOR XYZ LTDA",
    banco: "ITAU",
  }

  it("deve auto-confirmar match perfeito com fornecedor e banco", () => {
    const resultado = gerarSugestoes([erpBase], [extBase])
    expect(resultado.itens[0].status).toBe("CONCILIADO")
    expect(resultado.itens[0].autoConfirmado).toBe(true)
    expect(resultado.itens[0].sugestoes[0].autoConfirmado).toBe(true)
  })

  it("NÃO deve auto-confirmar se fornecedor não está na descrição", () => {
    const erp = { ...erpBase, fornecedor: "ABC LTDA" }
    const resultado = gerarSugestoes([erp], [extBase])
    expect(resultado.itens[0].status).toBe("A_REVISAR")
    expect(resultado.itens[0].autoConfirmado).toBe(false)
  })

  it("NÃO deve auto-confirmar se banco é diferente", () => {
    const erp = { ...erpBase, banco: "BRADESCO" }
    const resultado = gerarSugestoes([erp], [extBase])
    expect(resultado.itens[0].status).toBe("A_REVISAR")
    expect(resultado.itens[0].autoConfirmado).toBe(false)
  })

  it("NÃO deve auto-confirmar se valor difere > 1%", () => {
    const ext = { ...extBase, valor: 980 } // 2% diferença
    const resultado = gerarSugestoes([erpBase], [ext])
    expect(resultado.itens[0].status).toBe("A_REVISAR")
    expect(resultado.itens[0].autoConfirmado).toBe(false)
  })

  it("deve auto-confirmar mesmo sem fornecedor se demais critérios atendem", () => {
    const erp = { ...erpBase, fornecedor: null }
    const resultado = gerarSugestoes([erp], [extBase])
    expect(resultado.itens[0].status).toBe("CONCILIADO")
    expect(resultado.itens[0].autoConfirmado).toBe(true)
  })

  it("deve auto-confirmar mesmo sem banco se demais critérios atendem", () => {
    const erp = { ...erpBase, banco: null }
    const resultado = gerarSugestoes([erp], [extBase])
    expect(resultado.itens[0].status).toBe("CONCILIADO")
    expect(resultado.itens[0].autoConfirmado).toBe(true)
  })
})

// ========== REGRAS DE NEGÓCIO: AMBIGUIDADE ==========
describe("gerarSugestoes - ambiguidade", () => {
  const extBase: EntradaConciliacao = {
    id: "ext-amb",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PGTO FORNECEDOR",
  }

  it("deve marcar como A_REVISAR quando top1 e top2 têm score ≥ 70 e diferença ≤ 5", () => {
    const erp1 = { ...extBase, id: "erp-a", descricao: "PGTO FORNECEDOR", fornecedor: "A" }
    const erp2 = { ...extBase, id: "erp-b", descricao: "PGTO FORNECEDOR", fornecedor: "B" }
    const resultado = gerarSugestoes([erp1, erp2], [extBase])
    expect(resultado.itens[0].status).toBe("A_REVISAR")
    expect(resultado.itens[0].requerDecisaoManual).toBe(true)
  })
})

// ========== REGRAS DE NEGÓCIO: CONSUMO ÚNICO DE ERP ==========
describe("gerarSugestoes - consumo único de ERP", () => {
  const ext1: EntradaConciliacao = {
    id: "ext-1",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PAGAMENTO",
  }

  const ext2: EntradaConciliacao = {
    id: "ext-2",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PAGAMENTO",
  }

  const erp: EntradaConciliacao = {
    id: "erp-unico",
    origem: "ERP",
    data: new Date("2024-01-15"),
    valor: 1000,
    tipo: "DEBITO",
    descricao: "PAGAMENTO",
  }

  it("deve consumir cada ERP apenas uma vez", () => {
    const resultado = gerarSugestoes([erp], [ext1, ext2])
    const matches = resultado.itens.filter(i => i.status === "CONCILIADO" || i.status === "A_REVISAR")
    expect(matches).toHaveLength(1)
    expect(resultado.erpsSobrando).toHaveLength(0)
  })
})

// ========== REGRAS DE NEGÓCIO: HASH DETERMINÍSTICO ==========
describe("gerarSugestoes - hash determinístico", () => {
  it("deve gerar hash idêntico para mesmos dados", () => {
    const erp: EntradaConciliacao = {
      id: "erp-hash",
      origem: "ERP",
      data: new Date("2024-01-15"),
      valor: 1000,
      tipo: "DEBITO",
      descricao: "TESTE",
    }
    const ext: EntradaConciliacao = {
      id: "ext-hash",
      origem: "EXTRATO",
      data: new Date("2024-01-15"),
      valor: 1000,
      tipo: "DEBITO",
      descricao: "TESTE",
    }
    const r1 = gerarSugestoes([erp], [ext])
    const r2 = gerarSugestoes([erp], [ext])
    expect(r1.hashConciliacao).toBe(r2.hashConciliacao)
  })

  it("deve gerar hash diferente para dados diferentes", () => {
    const erp1: EntradaConciliacao = {
      id: "erp-a",
      origem: "ERP",
      data: new Date("2024-01-15"),
      valor: 1000,
      tipo: "DEBITO",
      descricao: "TESTE",
    }
    const erp2: EntradaConciliacao = {
      id: "erp-b",
      origem: "ERP",
      data: new Date("2024-01-15"),
      valor: 1000,
      tipo: "DEBITO",
      descricao: "TESTE",
    }
    const ext: EntradaConciliacao = {
      id: "ext",
      origem: "EXTRATO",
      data: new Date("2024-01-15"),
      valor: 1000,
      tipo: "DEBITO",
      descricao: "TESTE",
    }
    const r1 = gerarSugestoes([erp1], [ext])
    const r2 = gerarSugestoes([erp2], [ext])
    expect(r1.hashConciliacao).not.toBe(r2.hashConciliacao)
  })
})

// ========== REGRAS DE NEGÓCIO: TOTAIS ==========
describe("gerarSugestoes - totais", () => {
  it("deve calcular total ERP corretamente (créditos - débitos)", () => {
    const erpCredito: EntradaConciliacao = {
      id: "erp-c",
      origem: "ERP",
      data: new Date("2024-01-15"),
      valor: 500,
      tipo: "CREDITO",
      descricao: "RECEBIMENTO",
    }
    const erpDebito: EntradaConciliacao = {
      id: "erp-d",
      origem: "ERP",
      data: new Date("2024-01-15"),
      valor: 300,
      tipo: "DEBITO",
      descricao: "PAGAMENTO",
    }
    const ext: EntradaConciliacao = {
      id: "ext",
      origem: "EXTRATO",
      data: new Date("2024-01-15"),
      valor: 200,
      tipo: "CREDITO",
      descricao: "RECEBIMENTO",
    }
    const resultado = gerarSugestoes([erpCredito, erpDebito], [ext])
    expect(resultado.totalErp).toBe(200) // 500 - 300
  })
})
