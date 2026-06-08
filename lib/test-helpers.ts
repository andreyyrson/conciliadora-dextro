import { PrismaClient } from "@prisma/client"

const dbUrl = process.env.DATABASE_URL || ""
const testDbUrl = dbUrl.includes("?")
  ? `${dbUrl}&connection_limit=1`
  : `${dbUrl}?connection_limit=1`

export const prismaTest = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

export async function createTestUser(email?: string) {
  return prismaTest.user.create({
    data: {
      email: email || `test-${Date.now()}@example.com`,
      name: "Test User",
      password: "hashedpassword123",
    },
  })
}

export async function createTestEmpresa(userId: string, nome?: string) {
  return prismaTest.empresa.create({
    data: {
      nome: nome || "Empresa Teste",
      userId,
    },
  })
}

export async function createTestUpload(empresaId: string) {
  return prismaTest.uploadErp.create({
    data: {
      empresaId,
      nomeArquivo: "test.csv",
      periodo: "2026-06",
      totalLinhas: 10,
    },
  })
}

export async function createTestErpLancamento(
  uploadId: string,
  data: Date,
  tipo: string = "CREDITO",
  valor: number = 100
) {
  return prismaTest.erpLancamento.create({
    data: {
      uploadId,
      data,
      descricao: "Lancamento Teste",
      valor,
      tipo,
    },
  })
}

export async function createTestContaBancaria(empresaId: string) {
  return prismaTest.contaBancaria.create({
    data: {
      empresaId,
      banco: "Banco Teste",
      conta: "12345-6",
      agencia: "0001",
    },
  })
}

export async function createTestExtratoLancamento(
  contaId: string,
  data: Date,
  tipo: string = "CREDITO",
  valor: number = 100
) {
  return prismaTest.extratoLancamento.create({
    data: {
      contaId,
      data,
      descricao: "Extrato Teste",
      valor,
      tipo,
    },
  })
}

export async function createTestImportacaoExtrato(empresaId: string) {
  return prismaTest.importacaoExtrato.create({
    data: {
      empresaId,
      tipo: "CSV",
      nomeArquivo: "extrato.csv",
      totalLinhas: 5,
    },
  })
}

export async function createTestExtratoImportado(
  importacaoId: string,
  data: Date,
  tipo: string = "CREDITO",
  valor: number = 100
) {
  return prismaTest.extratoImportado.create({
    data: {
      importacaoId,
      data,
      descricao: "Importado Teste",
      valor,
      tipo,
    },
  })
}

export async function cleanupTestData() {
  await prismaTest.conciliacaoItem.deleteMany({ where: {} })
  await prismaTest.conciliacao.deleteMany({ where: {} })
  await prismaTest.erpLancamento.deleteMany({ where: {} })
  await prismaTest.uploadErp.deleteMany({ where: {} })
  await prismaTest.extratoImportado.deleteMany({ where: {} })
  await prismaTest.importacaoExtrato.deleteMany({ where: {} })
  await prismaTest.extratoLancamento.deleteMany({ where: {} })
  await prismaTest.contaBancaria.deleteMany({ where: {} })
  await prismaTest.empresa.deleteMany({ where: {} })
  await prismaTest.user.deleteMany({ where: {} })
}
