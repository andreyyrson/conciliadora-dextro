import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { data, descricao, valor, tipo, documento, fornecedor, categoria, centroCusto, banco } = body

    const lancamento = await prisma.erpLancamento.findUnique({
      where: { id },
      include: { upload: { include: { empresa: true } } }
    })

    if (!lancamento) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 })
    }

    if (lancamento.upload.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const updateData: any = {}
    if (data !== undefined) updateData.data = new Date(data)
    if (descricao !== undefined) updateData.descricao = descricao
    if (valor !== undefined) updateData.valor = valor
    if (tipo !== undefined) updateData.tipo = tipo
    if (documento !== undefined) updateData.documento = documento || null
    if (fornecedor !== undefined) updateData.fornecedor = fornecedor || null
    if (categoria !== undefined) updateData.categoria = categoria || null
    if (centroCusto !== undefined) updateData.centroCusto = centroCusto || null
    if (banco !== undefined) updateData.banco = banco || null

    const atualizado = await prisma.erpLancamento.update({
      where: { id },
      data: updateData,
      include: {
        upload: { select: { nomeArquivo: true, periodo: true } }
      }
    })

    return NextResponse.json({ lancamento: atualizado })
  } catch (error) {
    console.error("Erro ao atualizar lançamento ERP:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar lançamento" },
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
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const lancamento = await prisma.erpLancamento.findUnique({
      where: { id },
      include: { upload: { include: { empresa: true } } }
    })

    if (!lancamento) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 })
    }

    if (lancamento.upload.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    await prisma.erpLancamento.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar lançamento ERP:", error)
    return NextResponse.json(
      { error: "Erro ao deletar lançamento" },
      { status: 500 }
    )
  }
}
