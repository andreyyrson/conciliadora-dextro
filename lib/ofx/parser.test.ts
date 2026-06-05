import { describe, it, expect } from "vitest"
import { parseOFX, validateOFX } from "./parser"

const sampleOFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>341</BANKID>
<ACCTID>12345</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BALAMT>5000.00</BALAMT>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240115120000</DTPOSTED>
<TRNAMT>-150.00</TRNAMT>
<FITID>TXN001</FITID>
<NAME>Pagamento fornecedor</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20240116120000</DTPOSTED>
<TRNAMT>2000.00</TRNAMT>
<FITID>TXN002</FITID>
<NAME>Recebimento cliente</NAME>
</STMTTRN>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

describe("parseOFX", () => {
  it("deve parsear arquivo OFX válido", () => {
    const result = parseOFX(sampleOFX)
    expect(result.accounts).toHaveLength(1)
  })

  it("deve extrair informações da conta", () => {
    const result = parseOFX(sampleOFX)
    const account = result.accounts[0]
    expect(account.bankId).toBe("341")
    expect(account.accountId).toBe("12345")
    expect(account.accountType).toBe("CHECKING")
    expect(account.balance).toBe(5000)
    expect(account.currency).toBe("BRL")
  })

  it("deve extrair transações", () => {
    const result = parseOFX(sampleOFX)
    const transactions = result.accounts[0].transactions
    expect(transactions).toHaveLength(2)
  })

  it("deve parsear transação DEBIT corretamente", () => {
    const result = parseOFX(sampleOFX)
    const txn = result.accounts[0].transactions[0]
    expect(txn.id).toBe("TXN001")
    expect(txn.type).toBe("DEBIT")
    expect(txn.amount).toBe(-150)
    expect(txn.description).toBe("Pagamento fornecedor")
    expect(txn.date.getFullYear()).toBe(2024)
    expect(txn.date.getMonth()).toBe(0) // Janeiro = 0
    expect(txn.date.getDate()).toBe(15)
  })

  it("deve parsear transação CREDIT corretamente", () => {
    const result = parseOFX(sampleOFX)
    const txn = result.accounts[0].transactions[1]
    expect(txn.id).toBe("TXN002")
    expect(txn.type).toBe("CREDIT")
    expect(txn.amount).toBe(2000)
    expect(txn.description).toBe("Recebimento cliente")
  })

  it("deve retornar array vazio para arquivo sem transações", () => {
    const emptyOFX = `<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>`
    const result = parseOFX(emptyOFX)
    expect(result.accounts).toHaveLength(0)
  })

  it("deve usar memo como descrição quando NAME não está presente", () => {
    const ofxWithMemo = sampleOFX.replace(
      "<NAME>Recebimento cliente</NAME>",
      "<MEMO>Recebimento via memo</MEMO>"
    )
    const result = parseOFX(ofxWithMemo)
    const txn = result.accounts[0].transactions[1]
    expect(txn.description).toBe("Recebimento via memo")
  })
})

describe("validateOFX", () => {
  it("deve validar arquivo OFX válido", () => {
    const result = validateOFX(sampleOFX)
    expect(result.valid).toBe(true)
  })

  it("deve rejeitar arquivo vazio", () => {
    const result = validateOFX("")
    expect(result.valid).toBe(false)
    expect(result.error).toBe("Arquivo vazio")
  })

  it("deve rejeitar arquivo não-OFX", () => {
    const result = validateOFX("conteúdo aleatório sem header OFX")
    expect(result.valid).toBe(false)
  })

  it("deve aceitar arquivo com tag OFX simples", () => {
    const result = validateOFX("<OFX></OFX>")
    expect(result.valid).toBe(true)
  })
})
