import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { rateLimit, getRateLimitHeaders } from "./rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("deve permitir a primeira requisição", () => {
    const result = rateLimit("user:1", 5, 60000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("deve decrementar remaining a cada requisição", () => {
    rateLimit("user:2", 5, 60000)
    rateLimit("user:2", 5, 60000)
    const result = rateLimit("user:2", 5, 60000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it("deve bloquear após atingir o limite", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("user:3", 5, 60000)
    }
    const result = rateLimit("user:3", 5, 60000)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("deve resetar após a janela de tempo", () => {
    rateLimit("user:4", 2, 60000)
    rateLimit("user:4", 2, 60000)
    vi.advanceTimersByTime(61000)
    const result = rateLimit("user:4", 2, 60000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it("deve usar limit e windowMs padrão", () => {
    const result = rateLimit("user:5")
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it("deve isolar diferentes identificadores", () => {
    rateLimit("user:A", 1, 60000)
    const result = rateLimit("user:B", 1, 60000)
    expect(result.success).toBe(true)
  })
})

describe("getRateLimitHeaders", () => {
  it("deve retornar headers formatados", () => {
    const headers = getRateLimitHeaders(10, 5, 1234567890000)
    expect(headers).toEqual({
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "5",
      "X-RateLimit-Reset": "1234567890",
    })
  })
})
