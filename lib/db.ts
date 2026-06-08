import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Forçar 1 conexão por instância para evitar esgotar o pool no serverless
const rawUrl = process.env.DATABASE_URL || ""
const dbUrl = rawUrl.includes("?")
  ? `${rawUrl}&connection_limit=1`
  : `${rawUrl}?connection_limit=1`

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

globalForPrisma.prisma = prisma
