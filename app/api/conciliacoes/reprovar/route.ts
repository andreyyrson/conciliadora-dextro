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

    // TODO: Persistir reprovação por dia (schema AprovacaoDia). Placeholder por enquanto.
    return NextResponse.json({ status: "REPROVADO", dataDia, justificativa: justificativa || null }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao reprovar dia" }, { status: 500 })
  }
}
