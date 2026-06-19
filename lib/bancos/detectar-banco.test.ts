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

  it("detecta PicPay", () => {
    expect(detectarBanco("picpay_extrato.csv")).toBe("PicPay")
    expect(detectarBanco("pic_pay_junho.csv")).toBe("PicPay")
  })

  it("detecta BTG Pactual", () => {
    expect(detectarBanco("btg_extrato.csv")).toBe("BTG Pactual")
    expect(detectarBanco("btg_pactual_2024.csv")).toBe("BTG Pactual")
  })

  it("detecta XP Investimentos", () => {
    expect(detectarBanco("xp_extrato.csv")).toBe("XP Investimentos")
    expect(detectarBanco("xp_investimentos.csv")).toBe("XP Investimentos")
  })

  it("detecta PagBank", () => {
    expect(detectarBanco("pagbank.csv")).toBe("PagBank")
    expect(detectarBanco("pagseguro.csv")).toBe("PagBank")
  })

  it("detecta Banrisul", () => {
    expect(detectarBanco("banrisul_extrato.csv")).toBe("Banrisul")
  })

  it("detecta Mercado Pago", () => {
    expect(detectarBanco("mercado_pago.csv")).toBe("Mercado Pago")
    expect(detectarBanco("mercadopago.csv")).toBe("Mercado Pago")
  })

  it("detecta Sicoob", () => {
    expect(detectarBanco("sicoob_extrato.csv")).toBe("Sicoob")
  })

  it("detecta Sicredi", () => {
    expect(detectarBanco("sicredi_extrato.csv")).toBe("Sicredi")
  })

  it("detecta Banco do Nordeste", () => {
    expect(detectarBanco("bnb_extrato.csv")).toBe("Banco do Nordeste")
    expect(detectarBanco("banco_do_nordeste.csv")).toBe("Banco do Nordeste")
  })

  it("detecta Banco PAN", () => {
    expect(detectarBanco("pan_extrato.csv")).toBe("Banco PAN")
  })

  it("detecta Mercantil", () => {
    expect(detectarBanco("mercantil_extrato.csv")).toBe("Banco Mercantil")
  })

  it("detecta Daycoval", () => {
    expect(detectarBanco("daycoval.csv")).toBe("Banco Daycoval")
  })

  it("detecta Banco Volkswagen", () => {
    expect(detectarBanco("vw_extrato.csv")).toBe("Banco Volkswagen")
    expect(detectarBanco("volkswagen.csv")).toBe("Banco Volkswagen")
  })

  it("detecta Modal", () => {
    expect(detectarBanco("modal.csv")).toBe("Modal")
  })

  it("detecta Agibank", () => {
    expect(detectarBanco("agibank.csv")).toBe("Agibank")
  })

  it("detecta Banco da Amazônia", () => {
    expect(detectarBanco("banco_da_amazonia.csv")).toBe("Banco da Amazônia")
    expect(detectarBanco("basa.csv")).toBe("Banco da Amazônia")
  })

  it("retorna null quando não encontra banco", () => {
    expect(detectarBanco("movimentacao.csv")).toBeNull()
    expect(detectarBanco("extrato.csv")).toBeNull()
    expect(detectarBanco("relatorio.csv")).toBeNull()
    expect(detectarBanco("")).toBeNull()
    expect(detectarBanco("planilha.csv")).toBeNull()
  })
})
