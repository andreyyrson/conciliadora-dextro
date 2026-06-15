import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const skip = (page - 1) * limit

    const importacao = await prisma.importacaoExtrato.findUnique({
      where: { id },
      include: { empresa: true }
    })

    if (!importacao) {
      return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 })
    }

    if (importacao.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const [lancamentos, total] = await Promise.all([
      prisma.extratoImportado.findMany({
        where: { importacaoId: id },
        orderBy: { data: "desc" },
        skip,
        take: limit,
      }),
      prisma.extratoImportado.count({ where: { importacaoId: id } }),
    ])

    return NextResponse.json({
      lancamentos,
      importacao: {
        id: importacao.id,
        nomeArquivo: importacao.nomeArquivo,
        tipo: importacao.tipo,
        totalLinhas: importacao.totalLinhas,
        createdAt: importacao.createdAt,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Erro ao buscar lançamentos da importação:", error)
    return NextResponse.json(
      { error: "Erro ao buscar lançamentos" },
      { status: 500 }
    )
  }
}
