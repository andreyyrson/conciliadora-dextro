import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { empresaId, dataDia, justificativa } = await req.json().catch(() => ({}))
    if (!empresaId || !dataDia) {
      return NextResponse.json({ error: "empresaId e dataDia são obrigatórios" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Empresa não encontrada ou não pertence ao usuário" }, { status: 403 })
    }

    if (!justificativa || String(justificativa).trim() === "") {
      return NextResponse.json({ error: "Justificativa é obrigatória para reprovação" }, { status: 400 })
    }

    const dia = new Date(`${dataDia}T00:00:00.000Z`)
    const userId = session.user.id

    const result = await prisma.$transaction(async (tx) => {
      const p: any = tx as any
      const existente = await p.aprovacaoDia.findUnique({ where: { empresaId_dataDia: { empresaId, dataDia: dia } } }).catch(() => null)
      const deStatus = existente?.status || null

      const atual = await p.aprovacaoDia.upsert({
        where: { empresaId_dataDia: { empresaId, dataDia: dia } },
        update: { status: "REPROVADO", justificativa, userId },
        create: { empresaId, dataDia: dia, status: "REPROVADO", justificativa, userId },
      })

      await p.aprovacaoDiaLog.create({ data: { aprovacaoDiaId: atual.id, deStatus, paraStatus: "REPROVADO", justificativa, userId } })
      return atual
    })

    return NextResponse.json({ status: result.status, dataDia, updatedAt: result.updatedAt }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao reprovar dia" }, { status: 500 })
  }
}
