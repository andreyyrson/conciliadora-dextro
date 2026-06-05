import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn (className merge)", () => {
  it("deve mesclar classes simples", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("deve remover classes duplicadas do Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("deve ignorar valores falsy", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz")
  })

  it("deve lidar com objetos de condição", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active")
  })

  it("deve retornar string vazia para nenhum input", () => {
    expect(cn()).toBe("")
  })
})
