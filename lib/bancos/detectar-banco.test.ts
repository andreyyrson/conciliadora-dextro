import { describe, it, expect } from "vitest"
import { detectarBanco } from "./detectar-banco"

describe("detectarBanco", () => {
  it("detecta Itaú em vários formatos de nome", () => {
    expect(detectarBanco("extrato_itau_junho.csv")).toBe("Itaú")
    expect(detectarBanco("itau.csv")).toBe("Itaú")
    expect(detectarBanco("ITAU_2024.csv")).toBe("Itaú")
    expect(detectarBanco("banco_itau_extrato.csv")).toBe("Itaú")
    expect(detectarBanco("extrato.itau.csv")).toBe("Itaú")
    expect(detectarBanco("extrato-itau.csv")).toBe("Itaú")
  })

  it("detecta Bradesco", () => {
    expect(detectarBanco("bradesco_2024_01.csv")).toBe("Bradesco")
    expect(detectarBanco("extrato-bradesco.csv")).toBe("Bradesco")
    expect(detectarBanco("banco.bradesco.ofx")).toBe("Bradesco")
  })

  it("detecta Santander", () => {
    expect(detectarBanco("santander_extrato.csv")).toBe("Santander")
    expect(detectarBanco("extrato.santander.csv")).toBe("Santander")
  })

  it("detecta Banco do Brasil", () => {
    expect(detectarBanco("relatorio_bb.csv")).toBe("Banco do Brasil")
    expect(detectarBanco("banco_do_brasil.csv")).toBe("Banco do Brasil")
    expect(detectarBanco("bb_2024.csv")).toBe("Banco do Brasil")
  })

  it("detecta Caixa Econômica Federal", () => {
    expect(detectarBanco("caixa_extrato.csv")).toBe("Caixa Econômica Federal")
    expect(detectarBanco("cef_2024.csv")).toBe("Caixa Econômica Federal")
    expect(detectarBanco("caixa.economica.csv")).toBe("Caixa Econômica Federal")
  })

  it("detecta Nubank", () => {
    expect(detectarBanco("nubank_extrato.csv")).toBe("Nubank")
    expect(detectarBanco("nu_bank.csv")).toBe("Nubank")
  })

  it("detecta Inter", () => {
    expect(detectarBanco("inter_extrato.csv")).toBe("Inter")
    expect(detectarBanco("banco_inter.csv")).toBe("Inter")
  })

  it("detecta Safra", () => {
    expect(detectarBanco("safra_extrato.csv")).toBe("Safra")
  })

  it("detecta Original", () => {
    expect(detectarBanco("original_extrato.csv")).toBe("Original")
  })

  it("detecta C6 Bank", () => {
    expect(detectarBanco("c6_extrato.csv")).toBe("C6 Bank")
    expect(detectarBanco("c6_bank.csv")).toBe("C6 Bank")
  })

  it("detecta Neon", () => {
    expect(detectarBanco("neon_extrato.csv")).toBe("Neon")
  })

  it("retorna null quando não encontra banco", () => {
    expect(detectarBanco("movimentacao.csv")).toBeNull()
    expect(detectarBanco("extrato.csv")).toBeNull()
    expect(detectarBanco("relatorio.csv")).toBeNull()
    expect(detectarBanco("")).toBeNull()
  })
})
