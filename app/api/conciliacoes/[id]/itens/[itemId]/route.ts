import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { id: conciliacaoId, itemId } = await params
    const body = await req.json()
    const { status, erpId, extratoId, extratoImportadoId, observacao } = body

    // Verificar permissão
    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id: conciliacaoId }
    })
    if (!conciliacao || conciliacao.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const item = await prisma.conciliacaoItem.findUnique({
      where: { id: itemId }
    })
    if (!item || item.conciliacaoId !== conciliacaoId) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // Atualizar item
    const updateData: Prisma.ConciliacaoItemUncheckedUpdateInput = {
      resolvidoManualmente: true,
      resolvidoPor: session.user.id,
      resolvidoEm: new Date()
    }

    if (status) updateData.status = status
    if (observacao !== undefined) updateData.observacao = observacao
    if (erpId !== undefined) updateData.erpId = erpId || null
    if (extratoId !== undefined) updateData.extratoId = extratoId || null
    if (extratoImportadoId !== undefined) updateData.extratoImportadoId = extratoImportadoId || null

    const atualizado = await prisma.conciliacaoItem.update({
      where: { id: itemId },
      data: updateData
    })

    // Recalcular totais da conciliação
    const todosItens = await prisma.conciliacaoItem.findMany({
      where: { conciliacaoId }
    })

    const qtdConciliados = todosItens.filter(i => i.status === "AUTO_CONFIRMADO" || i.status === "CONFIRMADO_MANUAL").length
    const qtdDivergentes = todosItens.filter(i => i.status === "REJEITADO").length
    const qtdFaltandoErp = todosItens.filter(i => i.status === "SEM_MATCH").length
    const qtdFaltandoBanco = 0 // Calculado separadamente via ERPs sobrando

    await prisma.conciliacao.update({
      where: { id: conciliacaoId },
      data: {
        qtdConciliados,
        qtdDivergentes,
        qtdFaltandoErp,
        qtdFaltandoBanco
      }
    })

    return NextResponse.json({
      success: true,
      item: atualizado,
      resumo: { qtdConciliados, qtdDivergentes, qtdFaltandoErp, qtdFaltandoBanco }
    })
  } catch (error) {
    console.error("Erro ao atualizar item:", error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
