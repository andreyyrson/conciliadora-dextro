import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MatchesDetalhe } from "./matches-detalhe"
import type { MatchDia } from "./types"

const globalFetch = global.fetch as any
const originalConfirm = window.confirm

function buildMatches(): MatchDia {
  return {
    conciliados: 0,
    aRevisar: 1,
    naoConciliados: 0,
    erpsSobrando: 0,
    detalhes: [
      {
        extratoId: "x1",
        extratoDescricao: "PIX LOJA ABC",
        extratoValor: 123.45,
        status: "A_REVISAR",
        confianca: "MEDIUM",
        score: 70,
        erpPareado: { id: "e1", descricao: "", valor: NaN as any },
        explicacoes: ["Valor similar"],
      },
    ],
  }
}

describe("MatchesDetalhe — ações de completar", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as any
    window.confirm = vi.fn(() => true) as any
  })

  afterEach(() => {
    global.fetch = globalFetch
    window.confirm = originalConfirm
  })

  it("completa descrição quando vazia (sem pedir confirmação)", async () => {
    const matches = buildMatches()
    render(<MatchesDetalhe matches={matches} diaData="2024-05-10" />)

    const btn = screen.getByText("Completar Descrição")
    await fireEvent.click(btn)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/erp\/lancamentos\/e1/),
      expect.objectContaining({ method: "PATCH" })
    )
    const lastCall = (global.fetch as any).mock.calls.at(-1)
    const body = JSON.parse(lastCall[1].body)
    expect(body.descricao).toBe("PIX LOJA ABC")
  })

  it("pede confirmação para sobrescrever valor existente", async () => {
    const matches = buildMatches()
    matches.detalhes[0].erpPareado = { id: "e1", descricao: "Alguma", valor: 10 }

    render(<MatchesDetalhe matches={matches} diaData="2024-05-10" />)

    const btn = screen.getByText("Completar Valor")
    await fireEvent.click(btn)

    expect(window.confirm).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/erp\/lancamentos\/e1/),
      expect.objectContaining({ method: "PATCH" })
    )
  })

  it("completa data usando o diaData informado", async () => {
    const matches = buildMatches()
    matches.detalhes[0].erpPareado = { id: "e1", descricao: "", valor: 0 }

    render(<MatchesDetalhe matches={matches} diaData="2024-05-10" />)

    const btn = screen.getByText("Completar Data")
    await fireEvent.click(btn)

    const lastCall = (global.fetch as any).mock.calls.at(-1)
    const body = JSON.parse(lastCall[1].body)
    expect(body.data).toBe("2024-05-10")
  })
})
