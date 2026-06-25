import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { TransferenciaSugestao } from "@/lib/conciliacao/transferencias"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const transferencias: TransferenciaSugestao[] = Array.isArray(body.transferencias)
      ? body.transferencias
      : []
    const empresaId: string | undefined = body.empresaId

    if (!empresaId) {
      return NextResponse.json({ error: "empresaId é obrigatório" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Empresa não encontrada ou sem permissão" }, { status: 403 })
    }

    if (transferencias.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const extratoIds = new Set<string>()
    const importadoIds = new Set<string>()
    const erpIds = new Set<string>()

    for (const t of transferencias) {
      if (t.origemTipo === "EXTRATO") extratoIds.add(t.origemId)
      if (t.destinoTipo === "EXTRATO") extratoIds.add(t.destinoId)
      if (t.origemTipo === "EXTRATO_IMPORTADO") importadoIds.add(t.origemId)
      if (t.destinoTipo === "EXTRATO_IMPORTADO") importadoIds.add(t.destinoId)
      if (t.origemTipo === "ERP") erpIds.add(t.origemId)
      if (t.destinoTipo === "ERP") erpIds.add(t.destinoId)
    }

    const operations: Prisma.PrismaPromise<any>[] = []
    if (extratoIds.size > 0) {
      operations.push(prisma.extratoLancamento.updateMany({
        where: { id: { in: Array.from(extratoIds) }, conta: { empresaId } },
        data: { transferenciaDetectada: true }
      }))
    }
    if (importadoIds.size > 0) {
      operations.push(prisma.extratoImportado.updateMany({
        where: { id: { in: Array.from(importadoIds) }, importacao: { empresaId } },
        data: { transferenciaDetectada: true }
      }))
    }
    if (erpIds.size > 0) {
      operations.push(prisma.erpLancamento.updateMany({
        where: { id: { in: Array.from(erpIds) }, upload: { empresaId } },
        data: { transferenciaDetectada: true }
      }))
    }

    const transferenciasCriar = transferencias.map(t => ({
      empresaId,
      data: new Date(t.dataOrigem),
      valor: new Prisma.Decimal(t.valor),
      origemTipo: t.origemTipo,
      origemId: t.origemId,
      destinoTipo: t.destinoTipo,
      destinoId: t.destinoId,
      status: "APROVADA"
    }))

    operations.push(prisma.transferenciaDetectada.createMany({ data: transferenciasCriar }))
    await prisma.$transaction(operations)

    return NextResponse.json({ success: true, updated: transferenciasCriar.length })
  } catch (error) {
    console.error("Erro ao aprovar transferências:", error)
    return NextResponse.json({ error: "Erro ao aprovar transferências" }, { status: 500 })
  }
}
