import { describe, it, expect } from "vitest"
import { gerarSugestoes, EntradaConciliacao, normalizarDocumento } from "./engine"

describe("normalizarDocumento", () => {
  it("deve remover caracteres especiais", () => {
    expect(normalizarDocumento("12.345.678/0001-90")).toBe("12345678000190")
  })

  it("deve converter para maiúsculas", () => {
    expect(normalizarDocumento("abc")).toBe("ABC")
  })
})

describe("gerarSugestoes", () => {
  const baseErp: EntradaConciliacao = {
    id: "erp-1",
    origem: "ERP",
    data: new Date("2024-01-15"),
    valor: 1000.0,
    tipo: "DEBITO",
    descricao: "PAGAMENTO FORNECEDOR XYZ LTDA",
    documento: "NF-123",
    fornecedor: "XYZ LTDA",
    banco: "ITAU",
  }

  const baseExtrato: EntradaConciliacao = {
    id: "ext-1",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000.0,
    tipo: "DEBITO",
    descricao: "PAGAMENTO FORNECEDOR XYZ LTDA",
    banco: "ITAU",
  }

  it("deve auto-confirmar match perfeito", () => {
    const resultado = gerarSugestoes([baseErp], [baseExtrato])
    expect(resultado.itens).toHaveLength(1)
    expect(resultado.itens[0].status).toBe("AUTO_CONFIRMADO")
    expect(resultado.itens[0].confianca).toBe("HIGH")
    expect(resultado.itens[0].erpPareado).toBeDefined()
    expect(resultado.itens[0].erpPareado!.id).toBe("erp-1")
  })

  it("deve sugerir match parcial", () => {
    const erp = { ...baseErp, id: "erp-2" }
    const ext = {
      ...baseExtrato,
      id: "ext-2",
      valor: 990.0, // 1% de diferença
      descricao: "PAGAMENTO FORNECEDOR ABC", // descrição diferente
    }
    const resultado = gerarSugestoes([erp], [ext])
    expect(resultado.itens).toHaveLength(1)
    expect(resultado.itens[0].status).toBe("SUGERIDO")
    expect(resultado.itens[0].sugestoes.length).toBeGreaterThan(0)
  })

  it("deve retornar SEM_MATCH quando não há correspondência", () => {
    const erp = { ...baseErp, id: "erp-3", valor: 50000 }
    const ext = { ...baseExtrato, id: "ext-3", valor: 10 }
    const resultado = gerarSugestoes([erp], [ext])
    expect(resultado.itens).toHaveLength(1)
    expect(resultado.itens[0].status).toBe("SEM_MATCH")
    expect(resultado.itens[0].sugestoes).toHaveLength(0)
  })

  it("deve detectar ambiguidade quando há múltiplos candidatos bons", () => {
    // Estratégia: valor 1% dif (sv = 40), descrição idêntica (25), data igual (10),
    // fornecedor presente mas NÃO na descrição (sforn = 0), sem banco.
    // Score = 40 + 10 + 25 + 0 + 0 = 75 >= 70
    // Auto-confirmado falha: temFornecedor=true mas sforn=0 < 10
    const ext = { ...baseExtrato, id: "ext-ambiguo", descricao: "PGTO FORNECEDOR" }
    const erp1 = {
      ...baseErp,
      id: "erp-a",
      valor: 990.0, // 1% diferença → sv = 40
      descricao: "PGTO FORNECEDOR",
      fornecedor: "XYZ LTDA", // não está na descrição do extrato
      banco: null,
    }
    const erp2 = {
      ...baseErp,
      id: "erp-b",
      valor: 990.0,
      descricao: "PGTO FORNECEDOR",
      fornecedor: "ABC LTDA", // diferente mas também não na descrição
      banco: null,
    }
    const resultado = gerarSugestoes([erp1, erp2], [ext])
    expect(resultado.itens).toHaveLength(1)
    expect(resultado.itens[0].status).toBe("AMBIGUO")
  })

  it("deve retornar ERPs sobrando quando não há match", () => {
    const erp = { ...baseErp, id: "erp-sobrando" }
    const ext = { ...baseExtrato, id: "ext-match", valor: 99999 }
    const resultado = gerarSugestoes([erp], [ext])
    expect(resultado.erpsSobrando).toHaveLength(1)
    expect(resultado.erpsSobrando[0].erp.id).toBe("erp-sobrando")
    expect(resultado.erpsSobrando[0].status).toBe("FALTANDO_BANCO")
  })

  it("não deve fazer match quando tipo é diferente", () => {
    const erp = { ...baseErp, id: "erp-tipo", tipo: "CREDITO" as const }
    const ext = { ...baseExtrato, id: "ext-tipo", tipo: "DEBITO" as const }
    const resultado = gerarSugestoes([erp], [ext])
    expect(resultado.itens[0].status).toBe("SEM_MATCH")
  })

  it("não deve fazer match quando data difere mais de 7 dias", () => {
    const erp = { ...baseErp, id: "erp-data", data: new Date("2024-01-01") }
    const ext = { ...baseExtrato, id: "ext-data", data: new Date("2024-01-15") }
    const resultado = gerarSugestoes([erp], [ext])
    // 14 dias de diferença deve ser rejeitado pelo pré-filtro
    expect(resultado.itens[0].status).toBe("SEM_MATCH")
  })

  it("deve calcular totais corretamente", () => {
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
    const extCredito: EntradaConciliacao = {
      id: "ext-c",
      origem: "EXTRATO",
      data: new Date("2024-01-15"),
      valor: 500,
      tipo: "CREDITO",
      descricao: "RECEBIMENTO",
    }
    const extDebito: EntradaConciliacao = {
      id: "ext-d",
      origem: "EXTRATO",
      data: new Date("2024-01-15"),
      valor: 300,
      tipo: "DEBITO",
      descricao: "PAGAMENTO",
    }
    const resultado = gerarSugestoes([erpCredito, erpDebito], [extCredito, extDebito])
    expect(resultado.totalErp).toBe(200) // 500 - 300
    expect(resultado.totalExtrato).toBe(200)
  })

  it("deve gerar hash determinístico", () => {
    const r1 = gerarSugestoes([baseErp], [baseExtrato])
    const r2 = gerarSugestoes([baseErp], [baseExtrato])
    expect(r1.hashConciliacao).toBe(r2.hashConciliacao)
  })

  it("deve limitar sugestões a top 3", () => {
    const erps = Array.from({ length: 5 }, (_, i) => ({
      ...baseErp,
      id: `erp-${i}`,
      valor: 1000 + i,
    }))
    const ext = { ...baseExtrato, id: "ext-multi" }
    const resultado = gerarSugestoes(erps, [ext])
    expect(resultado.itens[0].sugestoes.length).toBeLessThanOrEqual(3)
  })
})
