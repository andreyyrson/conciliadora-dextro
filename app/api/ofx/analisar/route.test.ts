import { describe, it, expect, vi } from "vitest"

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

vi.mock("next-auth", () => ({
  getServerSession: vi.fn()
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    empresa: {
      findUnique: vi.fn()
    }
  }
}))

import { POST } from "./route"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

describe("POST /api/ofx/analisar", () => {
  it("deve retornar 401 quando não autenticado", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const formData = new FormData()
    const res = await POST(new Request("http://localhost/api/ofx/analisar", {
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

    const res = await POST(new Request("http://localhost/api/ofx/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Arquivo não fornecido")
  })

  it("deve retornar 400 quando empresa não fornecida", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })

    const formData = new FormData()
    const file = new File([sampleOFX], "teste.ofx", { type: "text/plain" })
    formData.append("file", file)

    const res = await POST(new Request("http://localhost/api/ofx/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Empresa não fornecida")
  })

  it("deve retornar 403 quando empresa não pertence ao usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })
    vi.mocked(prisma.empresa.findUnique).mockResolvedValue({
      id: "emp1",
      userId: "user2"
    } as any)

    const formData = new FormData()
    const file = new File([sampleOFX], "teste.ofx", { type: "text/plain" })
    formData.append("file", file)
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/ofx/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Empresa não encontrada ou não pertence ao usuário")
  })

  it("deve retornar preview de OFX válido", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user1" } })
    vi.mocked(prisma.empresa.findUnique).mockResolvedValue({
      id: "emp1",
      userId: "user1"
    } as any)

    const formData = new FormData()
    const file = new File([sampleOFX], "teste.ofx", { type: "text/plain" })
    formData.append("file", file)
    formData.append("empresaId", "emp1")

    const res = await POST(new Request("http://localhost/api/ofx/analisar", {
      method: "POST",
      body: formData
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.nomeArquivo).toBe("teste.ofx")
    expect(json.totalContas).toBe(1)
    expect(json.totalTransacoes).toBe(2)
    expect(json.preview).toHaveLength(2)
    expect(json.contas).toHaveLength(1)
    expect(json.contas[0].banco).toBe("341")
    expect(json.contas[0].transacoes).toBe(2)
  })
})
