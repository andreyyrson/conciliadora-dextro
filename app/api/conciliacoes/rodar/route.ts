import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { empresaId, dataInicio, dataFim } = body || {}

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "empresaId, dataInicio e dataFim são obrigatórios" },
        { status: 400 }
      )
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    // Coletar fontes
    const uploads = await prisma.uploadErp.findMany({ where: { empresaId }, select: { id: true } })
    const contas = await prisma.contaBancaria.findMany({ where: { empresaId }, select: { id: true } })
    const importacoes = await prisma.importacaoExtrato.findMany({ where: { empresaId }, select: { id: true } })

    const uploadIds = uploads.map(u => u.id)
    const contaIds = contas.map(c => c.id)
    const importacaoIds = importacoes.map(i => i.id)

    // Buscar lançamentos do período
    const [erpLanc, extLanc, impLanc] = await Promise.all([
      prisma.erpLancamento.findMany({ where: { uploadId: { in: uploadIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoLancamento.findMany({ where: { contaId: { in: contaIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoImportado.findMany({ where: { importacaoId: { in: importacaoIds }, data: { gte: inicio, lte: fim } } }),
    ])

    // TODO: Integrar motor de matching por dia e persistir resultado (idempotente)
    const resumo = {
      periodo: { inicio: dataInicio, fim: dataFim },
      totais: {
        erp: erpLanc.length,
        extrato_open_finance: extLanc.length,
        extrato_importado: impLanc.length,
      },
    }

    return NextResponse.json({ message: "Conciliação iniciada", resumo }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao rodar conciliação" }, { status: 500 })
  }
}
