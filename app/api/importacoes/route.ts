import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

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


    if (!empresaId) {
      return NextResponse.json(
        { error: "empresaId é obrigatório" },
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

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const skip = (page - 1) * limit

    const [importacoes, total] = await Promise.all([
      prisma.importacaoExtrato.findMany({
        where: { empresaId },
        orderBy: { createdAt: "desc" },
        include: {
          extratos: {
            take: 5,
            orderBy: { data: "desc" }
          }
        },
        skip,
        take: limit,
      }),
      prisma.importacaoExtrato.count({ where: { empresaId } }),
    ])

    return NextResponse.json({
      importacoes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar importações:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Erro ao buscar importações", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
