import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const { id: contaId } = await params

    // Buscar conta bancária
    const conta = await prisma.contaBancaria.findUnique({
      where: { id: contaId },
      include: { empresa: true }
    })

    if (!conta) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      )
    }

    // Verificar se a empresa pertence ao usuário
    if (conta.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão para acessar esta conta" },
        { status: 403 }
      )
    }

    // Apenas atualizar a data de sincronização (integração desativada)
    await prisma.contaBancaria.update({
      where: { id: contaId },
      data: {
        ultimaSincAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "Sincronização desativada",
      ultimaSincAt: new Date()
    })
  } catch (error) {
    console.error("Erro ao sincronizar conta:", error)
    return NextResponse.json(
      { error: "Erro ao sincronizar conta" },
      { status: 500 }
    )
  }
}
