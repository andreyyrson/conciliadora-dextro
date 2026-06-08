import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id },
      include: {
        itens: {
          include: {
            extrato: true,
            erp: true
          }
        },
        upload: true
      }
    })

    if (!conciliacao) {
      return NextResponse.json(
        { error: "Conciliação não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ conciliacao })
  } catch (error) {
    console.error("Erro ao buscar conciliação:", error)
    return NextResponse.json(
      { error: "Erro ao buscar conciliação" },
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

    // Buscar conciliação e verificar permissões
    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id }
    })

    if (!conciliacao) {
      return NextResponse.json(
        { error: "Conciliação não encontrada" },
        { status: 404 }
      )
    }

    if (conciliacao.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão para deletar esta conciliação" },
        { status: 403 }
      )
    }

    // Deletar itens da conciliação primeiro (cascade)
    await prisma.conciliacaoItem.deleteMany({
      where: { conciliacaoId: id }
    })

    // Deletar conciliação
    await prisma.conciliacao.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar conciliação:", error)
    return NextResponse.json(
      { error: "Erro ao deletar conciliação" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { itemId, status, observacao, resolvidoManualmente } = body

    // Atualizar item da conciliação
    const item = await prisma.conciliacaoItem.update({
      where: { id: itemId },
      data: {
        status,
        observacao,
        resolvidoManualmente,
        resolvidoEm: resolvidoManualmente ? new Date() : null,
        resolvidoPor: resolvidoManualmente ? body.userId : null
      }
    })

    // Recalcular totais da conciliação
    const itens = await prisma.conciliacaoItem.findMany({
      where: { conciliacaoId: id }
    })

    const qtdConciliados = itens.filter((i) => i.status === "AUTO_CONFIRMADO" || i.status === "CONFIRMADO_MANUAL").length
    const qtdDivergentes = itens.filter((i) => i.status === "REJEITADO").length
    const qtdFaltandoErp = itens.filter((i) => i.status === "SEM_MATCH").length
    const qtdFaltandoBanco = 0 // Calculado separadamente via ERPs sobrando

    await prisma.conciliacao.update({
      where: { id },
      data: {
        qtdConciliados,
        qtdDivergentes,
        qtdFaltandoErp,
        qtdFaltandoBanco,
        atualizadoEm: new Date()
      }
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error("Erro ao atualizar item:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar item" },
      { status: 500 }
    )
  }
}
