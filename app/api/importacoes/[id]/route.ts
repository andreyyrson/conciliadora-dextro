import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { banco } = body

    if (!banco || typeof banco !== "string") {
      return NextResponse.json(
        { error: "Campo 'banco' é obrigatório" },
        { status: 400 }
      )
    }

    const importacao = await prisma.importacaoExtrato.findUnique({
      where: { id },
      include: { empresa: true }
    })

    if (!importacao) {
      return NextResponse.json(
        { error: "Importação não encontrada" },
        { status: 404 }
      )
    }

    if (importacao.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão" },
        { status: 403 }
      )
    }

    const result = await prisma.extratoImportado.updateMany({
      where: { importacaoId: id },
      data: { banco }
    })

    return NextResponse.json({
      success: true,
      updated: result.count
    })
  } catch (error) {
    console.error("Erro ao atualizar banco da importação:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar banco" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    // Buscar importação e verificar permissões
    const importacao = await prisma.importacaoExtrato.findUnique({
      where: { id },
      include: { empresa: true }
    })

    if (!importacao) {
      return NextResponse.json(
        { error: "Importação não encontrada" },
        { status: 404 }
      )
    }

    if (importacao.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão para deletar esta importação" },
        { status: 403 }
      )
    }

    // Deletar lançamentos da importação primeiro (cascade)
    await prisma.extratoImportado.deleteMany({
      where: { importacaoId: id }
    })

    // Deletar importação
    await prisma.importacaoExtrato.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir importação:", error)
    return NextResponse.json(
      { error: "Erro ao excluir importação" },
      { status: 500 }
    )
  }
}
