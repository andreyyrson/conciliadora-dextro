import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: "empresaId, dataInicio e dataFim são obrigatórios" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Empresa não encontrada ou não pertence ao usuário" }, { status: 403 })
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    const p: any = prisma as any
    const itens = await p.aprovacaoDia.findMany({
      where: { empresaId, dataDia: { gte: inicio, lte: fim } },
      orderBy: { dataDia: "asc" },
    })

    const mapa: Record<string, { status: string; updatedAt: string; userId: string }> = {}
    for (const it of itens as any[]) {
      const key = (it.dataDia as Date).toISOString().split("T")[0]
      mapa[key] = { status: it.status, updatedAt: (it.updatedAt as Date).toISOString(), userId: it.userId }
    }

    const lancamentos = await (prisma as any).aprovacaoLancamento.findMany({
      where: { empresaId, dataDia: { gte: inicio, lte: fim } },
      orderBy: { createdAt: "asc" },
    })

    const mapaLancamentos: Record<string, Record<string, { status: string; updatedAt: string; userId: string }>> = {}
    for (const l of lancamentos as any[]) {
      const key = (l.dataDia as Date).toISOString().split("T")[0]
      if (!mapaLancamentos[key]) mapaLancamentos[key] = {}
      mapaLancamentos[key][l.extratoId] = { status: l.status, updatedAt: (l.updatedAt as Date).toISOString(), userId: l.userId }
    }

    return NextResponse.json({ aprovacoes: mapa, lancamentos: mapaLancamentos }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao consultar aprovações" }, { status: 500 })
  }
}
