import { describe, it, expect } from "vitest"
import { empresaSchema, registerSchema, conciliacaoSchema, uploadSchema } from "./schemas"

describe("empresaSchema", () => {
  it("deve validar empresa com nome", () => {
    const result = empresaSchema.safeParse({ nome: "Empresa Teste" })
    expect(result.success).toBe(true)
  })

  it("deve rejeitar empresa sem nome", () => {
    const result = empresaSchema.safeParse({ nome: "" })
    expect(result.success).toBe(false)
  })

  it("deve permitir CNPJ opcional", () => {
    const result = empresaSchema.safeParse({ nome: "Empresa", cnpj: null })
    expect(result.success).toBe(true)
  })
})

describe("registerSchema", () => {
  it("deve validar registro com dados corretos", () => {
    const result = registerSchema.safeParse({
      email: "teste@email.com",
      password: "123456",
    })
    expect(result.success).toBe(true)
  })

  it("deve rejeitar email inválido", () => {
    const result = registerSchema.safeParse({
      email: "email-invalido",
      password: "123456",
    })
    expect(result.success).toBe(false)
  })

  it("deve rejeitar senha curta", () => {
    const result = registerSchema.safeParse({
      email: "teste@email.com",
      password: "12345",
    })
    expect(result.success).toBe(false)
  })
})

describe("conciliacaoSchema", () => {
  it("deve validar com uploadId e empresaId", () => {
    const result = conciliacaoSchema.safeParse({
      uploadId: "abc123",
      empresaId: "emp456",
    })
    expect(result.success).toBe(true)
  })

  it("deve rejeitar sem uploadId", () => {
    const result = conciliacaoSchema.safeParse({
      empresaId: "emp456",
    })
    expect(result.success).toBe(false)
  })
})

describe("uploadSchema", () => {
  it("deve validar com empresaId", () => {
    const result = uploadSchema.safeParse({ empresaId: "abc123" })
    expect(result.success).toBe(true)
  })

  it("deve rejeitar sem empresaId", () => {
    const result = uploadSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
