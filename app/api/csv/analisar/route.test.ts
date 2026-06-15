import { describe, it, expect, vi } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn()
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    empresa: {
      findUnique: vi.fn()
    },
    importacaoExtrato: {
      findFirst: vi.fn()
    }
  }
}))

import { POST } from "./route"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

describe("POST /api/csv/analisar", () => {
  it("deve retornar 401 quando não autenticado", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const formData = new FormData()
    const res = await POST(new Request("http://localhost/api/csv/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Não autenticado")
  })

  it("deve retornar 400 quando file ou empresaId não fornecidos", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })

    const formData = new FormData()
    const res = await POST(new Request("http://localhost/api/csv/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("file e empresaId são obrigatórios")
  })

  it("deve retornar 403 quando empresa não pertence ao usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })
    vi.mocked(prisma.empresa.findUnique).mockResolvedValue({
      id: "emp1",
      userId: "user2"
    } as any)

    const formData = new FormData()
    const file = new File(["Data,Valor,Descricao\n01/01/2024,100,Teste"], "teste.csv", { type: "text/csv" })
    formData.append("file", file)
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/csv/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Empresa não encontrada ou não pertence ao usuário")
  })

  it("deve analisar CSV válido e retornar mapeamento", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })
    vi.mocked(prisma.empresa.findUnique).mockResolvedValue({
      id: "emp1",
      userId: "user1"
    } as any)
    vi.mocked(prisma.importacaoExtrato.findFirst).mockResolvedValue(null)

    const csvContent = "Data,Valor,Descricao,Tipo\n01/01/2024,100.00,Pagamento teste,DEBITO\n02/01/2024,200.00,Recebimento teste,CREDITO"
    const formData = new FormData()
    const file = new File([csvContent], "teste.csv", { type: "text/csv" })
    formData.append("file", file)
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/csv/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.colunas).toEqual(["Data", "Valor", "Descricao", "Tipo"])
    expect(json.totalLinhas).toBe(2)
    expect(json.mapeamento.data).toBe("Data")
    expect(json.mapeamento.valor).toBe("Valor")
    expect(json.mapeamento.descricao).toBe("Descricao")
    expect(json.preview).toHaveLength(2)
  })
})
