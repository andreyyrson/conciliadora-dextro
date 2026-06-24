import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { reprovarLancamentoBody } from "@/lib/api-schemas"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const parsed = reprovarLancamentoBody.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { empresaId, dataDia, extratoId, justificativa } = parsed.data

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Empresa não encontrada ou não pertence ao usuário" }, { status: 403 })
    }

    const dia = new Date(`${dataDia}T00:00:00.000Z`)
    const userId = session.user.id

    const result = await prisma.aprovacaoLancamento.upsert({
      where: { empresaId_dataDia_extratoId: { empresaId, dataDia: dia, extratoId } },
      update: { status: "REPROVADO", justificativa: justificativa || null, userId },
      create: { empresaId, dataDia: dia, extratoId, status: "REPROVADO", justificativa: justificativa || null, userId },
    })

    return NextResponse.json({ status: result.status, dataDia, extratoId, updatedAt: result.updatedAt }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao reprovar lançamento" }, { status: 500 })
  }
}
