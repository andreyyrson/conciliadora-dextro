import { describe, it, expect, vi, beforeEach } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  }
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    importacaoExtrato: { findUnique: mocks.findUnique },
    extratoImportado: { updateMany: mocks.updateMany },
  }
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve({ user: { id: "user1" } }))
}))

import { PATCH } from "./route"

describe("PATCH /api/importacoes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("atualiza banco com sucesso", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "imp1",
      empresa: { userId: "user1" }
    })
    mocks.updateMany.mockResolvedValue({ count: 50 })

    const req = new Request("http://localhost/api/importacoes/imp1", {
      method: "PATCH",
      body: JSON.stringify({ banco: "Itaú" })
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: "imp1" }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.updated).toBe(50)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { importacaoId: "imp1" },
      data: { banco: "Itaú" }
    })
  })

  it("retorna 400 quando banco não é fornecido", async () => {
    const req = new Request("http://localhost/api/importacoes/imp1", {
      method: "PATCH",
      body: JSON.stringify({})
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: "imp1" }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Campo 'banco' é obrigatório")
  })

  it("retorna 404 quando importação não existe", async () => {
    mocks.findUnique.mockResolvedValue(null)

    const req = new Request("http://localhost/api/importacoes/imp1", {
      method: "PATCH",
      body: JSON.stringify({ banco: "Itaú" })
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: "imp1" }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("Importação não encontrada")
  })

  it("retorna 403 quando importação não pertence ao usuário", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "imp1",
      empresa: { userId: "outro-user" }
    })

    const req = new Request("http://localhost/api/importacoes/imp1", {
      method: "PATCH",
      body: JSON.stringify({ banco: "Itaú" })
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: "imp1" }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe("Sem permissão")
  })
})
