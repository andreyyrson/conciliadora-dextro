import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Usar Connection Pooler do Supabase (DIRECT_URL) ou DATABASE_URL com pgbouncer
const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || ""

// Garantir pgbouncer=true para prepared statements compatíveis
const dbUrl = rawUrl.includes("pgbouncer=true")
  ? rawUrl
  : rawUrl.includes("?")
    ? `${rawUrl}&pgbouncer=true`
    : `${rawUrl}?pgbouncer=true`

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

globalForPrisma.prisma = prisma
