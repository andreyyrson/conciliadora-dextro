import { describe, it, expect } from "vitest"
import { gerarSugestoes, EntradaConciliacao } from "./engine"

function makeErp(overrides: Partial<EntradaConciliacao> = {}): EntradaConciliacao {
  return {
    id: "erp-1",
    origem: "ERP",
    data: new Date("2024-01-15"),
    valor: 1000.0,
    tipo: "DEBITO",
    descricao: "Pagamento fornecedor ABC",
    documento: "NF-001",
    fornecedor: "ABC Ltda",
    banco: "Bradesco",
    ...overrides,
  }
}

function makeExtrato(overrides: Partial<EntradaConciliacao> = {}): EntradaConciliacao {
  return {
    id: "ext-1",
    origem: "EXTRATO",
    data: new Date("2024-01-15"),
    valor: 1000.0,
    tipo: "DEBITO",
    descricao: "ABC Ltda pagamento",
    identificador: "TXN-001",
    banco: "Bradesco",
    ...overrides,
  }
}

describe("gerarSugestoes", () => {
  it("deve retornar resultado vazio para listas vazias", () => {
    const result = gerarSugestoes([], [])
    expect(result.itens).toEqual([])
    expect(result.totalErp).toBe(0)
    expect(result.totalExtrato).toBe(0)
  })

  it("deve fazer match entre ERP e extrato com mesmo valor, data e banco", () => {
    const erp = makeErp()
    const extrato = makeExtrato()

    const result = gerarSugestoes([erp], [extrato])
    expect(result.itens).toHaveLength(1)

    const item = result.itens[0]
    expect(["AUTO_CONFIRMADO", "SUGERIDO"]).toContain(item.status)
    expect(item.sugestoes[0].entradaOrigemId).toBe("erp-1")
    expect(item.sugestoes[0].score).toBeGreaterThanOrEqual(50)
  })

  it("deve recusar match com tipo diferente (CREDITO vs DEBITO)", () => {
    const erp = makeErp({ tipo: "CREDITO" })
    const extrato = makeExtrato({ tipo: "DEBITO" })

    const result = gerarSugestoes([erp], [extrato])
    expect(result.itens[0].status).toBe("SEM_MATCH")
  })

  it("deve recusar match com valor muito diferente (>5%)", () => {
    const erp = makeErp({ valor: 1000 })
    const extrato = makeExtrato({ valor: 2000 })

    const result = gerarSugestoes([erp], [extrato])
    expect(result.itens[0].status).toBe("SEM_MATCH")
  })

  it("deve fazer match com valor próximo (≤5%)", () => {
    const erp = makeErp({ valor: 1000 })
    const extrato = makeExtrato({ valor: 1030 })

    const result = gerarSugestoes([erp], [extrato])
    expect(result.itens[0].status).not.toBe("SEM_MATCH")
  })

  it("deve marcar como SEM_MATCH quando data difere mais de 7 dias", () => {
    const erp = makeErp({ data: new Date("2024-01-01") })
    const extrato = makeExtrato({ data: new Date("2024-01-15") })

    const result = gerarSugestoes([erp], [extrato])
    expect(result.itens[0].status).toBe("SEM_MATCH")
  })

  it("deve gerar scoreDetalhado com campo banco", () => {
    const erp = makeErp({ banco: "ITAU" })
    const extrato = makeExtrato({ banco: "ITAU" })

    const result = gerarSugestoes([erp], [extrato])
    const sugestao = result.itens[0].sugestoes[0]
    expect(sugestao).toBeDefined()
    expect(sugestao.scoreDetalhado).toHaveProperty("banco")
    expect(sugestao.scoreDetalhado.banco).toBeGreaterThan(0)
  })

  it("deve normalizar abreviações de banco (BB = Banco do Brasil)", () => {
    const erp = makeErp({ banco: "BB" })
    const extrato = makeExtrato({ banco: "Banco do Brasil" })

    const result = gerarSugestoes([erp], [extrato])
    const sugestao = result.itens[0].sugestoes[0]
    expect(sugestao?.scoreDetalhado.banco).toBe(20)
  })

  it("deve retornar banco score 0 quando ambos não informados", () => {
    const erp = makeErp({ banco: null })
    const extrato = makeExtrato({ banco: null })

    const result = gerarSugestoes([erp], [extrato])
    const sugestao = result.itens[0].sugestoes[0]
    if (sugestao) {
      expect(sugestao.scoreDetalhado.banco).toBe(0)
    }
  })

  it("deve gerar hashConciliacao consistente para mesmos dados", () => {
    const erp = makeErp()
    const extrato = makeExtrato()

    const result1 = gerarSugestoes([erp], [extrato])
    const result2 = gerarSugestoes([erp], [extrato])
    expect(result1.hashConciliacao).toBe(result2.hashConciliacao)
  })

  it("deve diferenciar hashes para IDs diferentes", () => {
    const erp1 = makeErp({ id: "erp-1" })
    const erp2 = makeErp({ id: "erp-2" })
    const extrato = makeExtrato()

    const result1 = gerarSugestoes([erp1], [extrato])
    const result2 = gerarSugestoes([erp2], [extrato])
    expect(result1.hashConciliacao).not.toBe(result2.hashConciliacao)
  })
})
