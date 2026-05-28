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

    const importacoes = await prisma.importacaoExtrato.findMany({
      where: { empresaId },
      orderBy: { createdAt: "desc" },
      include: {
        extratos: {
          take: 5,
          orderBy: { data: "desc" }
        }
      }
    })

    return NextResponse.json({ importacoes })
  } catch (error) {
    console.error("Erro ao buscar importações:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Erro ao buscar importações", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
