import { describe, it, expect, vi, beforeEach } from "vitest"

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

const { mockCreate, mockCreateMany } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockCreateMany: vi.fn()
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn()
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    empresa: {
      findUnique: vi.fn()
    },
    importacaoExtrato: {
      create: mockCreate
    },
    extratoImportado: {
      createMany: mockCreateMany
    }
  }
}))

import { POST } from "./route"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

describe("POST /api/ofx/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deve retornar 401 quando não autenticado", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const formData = new FormData()
    const res = await POST(new Request("http://localhost/api/ofx/upload", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Não autenticado")
  })

  it("deve retornar 400 quando arquivo não fornecido", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })

    const formData = new FormData()
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/ofx/upload", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Arquivo não fornecido")
  })

  it("deve salvar importação e transações com sucesso", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })
    vi.mocked(prisma.empresa.findUnique).mockResolvedValue({
      id: "emp1",
      userId: "user1"
    } as any)

    mockCreate.mockResolvedValue({
      id: "imp1",
      tipo: "OFX",
      nomeArquivo: "teste.ofx"
    })
    mockCreateMany.mockResolvedValue({ count: 2 })

    const formData = new FormData()
    const file = new File([sampleOFX], "teste.ofx", { type: "text/plain" })
    formData.append("file", file)
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/ofx/upload", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.importacao.id).toBe("imp1")
    expect(json.transactionsImported).toBe(2)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreateMany).toHaveBeenCalledTimes(1)
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          importacaoId: "imp1",
          descricao: "Pagamento fornecedor",
          valor: -150,
          tipo: "DEBITO"
        }),
        expect.objectContaining({
          importacaoId: "imp1",
          descricao: "Recebimento cliente",
          valor: 2000,
          tipo: "CREDITO"
        })
      ]),
      skipDuplicates: true
    })
  })
})
