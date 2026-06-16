import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useComparativo } from "./use-comparativo"

const globalFetch = global.fetch as any

describe("useComparativo", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/erp/lancamentos")) {
        if (init?.method === "PATCH") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 })
        }
        if (init?.method === "DELETE") {
          return new Response(null, { status: 204 })
        }
        return new Response(JSON.stringify({
          data: [{ id: "erp1", data: new Date().toISOString(), descricao: "ERP desc", valor: 100, tipo: "DEBITO" }],
          pagination: { page: 1, totalPages: 1 }
        }), { status: 200 })
      }
      if (url.startsWith("/api/importacoes/lancamentos")) {
        if (init?.method === "DELETE") {
          return new Response(null, { status: 204 })
        }
        return new Response(JSON.stringify({
          data: [{ id: "ext1", data: new Date().toISOString(), descricao: "EXT desc", valor: 100, tipo: "DEBITO" }],
          pagination: { page: 1, totalPages: 1 }
        }), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    }) as any
  })

  afterEach(() => {
    global.fetch = globalFetch
  })

  it("carrega ERP e extrato e permite editar ERP e deletar extrato", async () => {
    const { result } = renderHook(() => useComparativo({ empresaId: "emp1" }))

    // carregar
    await act(async () => {
      await result.current.fetchDados()
    })

    // editar ERP
    await act(async () => {
      await result.current.onSalvarErp("erp1", { descricao: "Nova" })
    })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/erp\/lancamentos\/erp1/),
      expect.objectContaining({ method: "PATCH" })
    )

    // deletar extrato
    await act(async () => {
      await result.current.onDeletarExtrato("ext1")
    })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/importacoes\/lancamentos\/ext1/),
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
