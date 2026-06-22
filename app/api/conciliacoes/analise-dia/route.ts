import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { analisarPorDia } from "@/lib/conciliacao"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")
    const tipo = searchParams.get("tipo") || undefined
    const banco = searchParams.get("banco") || undefined
    const arquivoQuery = searchParams.get("arquivo") || undefined

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "empresaId, dataInicio e dataFim são obrigatórios" },
        { status: 400 }
      )
    }

    // Verificar se a empresa pertence ao usuário
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    })

    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    const dias = await analisarPorDia(empresaId, inicio, fim, tipo as "RECEITAS" | "DESPESAS" | undefined, banco, arquivoQuery || undefined)

    return NextResponse.json({ dias })
  } catch (error) {
    console.error("Erro ao gerar análise por dia:", error)
    return NextResponse.json(
      { error: "Erro ao gerar análise por dia" },
      { status: 500 }
    )
  }
}
