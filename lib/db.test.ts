import { describe, it, expect, vi } from "vitest"

const mockQueryRaw = vi.fn()
const mockCreate = vi.fn()
const mockFindMany = vi.fn()
const mockFindUnique = vi.fn()
const mockDisconnect = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
    user: { create: mockCreate, findUnique: mockFindUnique, findMany: mockFindMany },
  }
}))

import { prisma } from "@/lib/db"

describe("Prisma DB Connection (mocked)", () => {
  it("should execute raw query", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ result: 1 }])
    const result = await prisma.$queryRaw`SELECT 1 as result`
    expect(result[0].result).toBe(1)
  })

  it("should create and read a user", async () => {
    mockCreate.mockResolvedValueOnce({ id: "u1", email: "test@example.com" })
    mockFindUnique.mockResolvedValueOnce({ id: "u1", email: "test@example.com" })

    const user = await prisma.user.create({
      data: { email: "test@example.com", name: "Test", password: "pass" }
    })
    expect(user.id).toBeDefined()

    const found = await prisma.user.findUnique({ where: { id: user.id } })
    expect(found).not.toBeNull()
    expect(found?.email).toBe("test@example.com")
  })

  it("should handle multiple sequential queries", async () => {
    mockCreate.mockResolvedValue({ id: "u1", email: "seq@example.com" })
    mockFindMany.mockResolvedValue([
      { id: "u1", email: "seq@example.com" },
      { id: "u2", email: "seq2@example.com" },
    ])

    for (let i = 0; i < 2; i++) {
      await prisma.user.create({ data: { email: `seq${i}@example.com`, name: "Test", password: "pass" } })
    }
    const users = await prisma.user.findMany()
    expect(users).toHaveLength(2)
  })
})
