import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { extratoLancamentoPatch } from "@/lib/api-schemas"

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
    const parsed = extratoLancamentoPatch.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { data, descricao, valor, tipo, identificador, banco, saldoApos } = parsed.data

    const lancamento = await prisma.extratoImportado.findUnique({
      where: { id },
      include: { importacao: { include: { empresa: true } } }
    })

    if (!lancamento) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 })
    }

    if (lancamento.importacao.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const updateData: any = {}
    if (data !== undefined) updateData.data = new Date(data)
    if (descricao !== undefined) updateData.descricao = descricao
    if (valor !== undefined) updateData.valor = valor
    if (tipo !== undefined) updateData.tipo = tipo
    if (identificador !== undefined) updateData.identificador = identificador || null
    if (banco !== undefined) updateData.banco = banco || null
    if (saldoApos !== undefined) updateData.saldoApos = saldoApos

    const atualizado = await prisma.extratoImportado.update({
      where: { id },
      data: updateData,
      include: {
        importacao: { select: { nomeArquivo: true, tipo: true } }
      }
    })

    return NextResponse.json({ lancamento: atualizado })
  } catch (error) {
    console.error("Erro ao atualizar lançamento:", error)
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

    const lancamento = await prisma.extratoImportado.findUnique({
      where: { id },
      include: { importacao: { include: { empresa: true } } }
    })

    if (!lancamento) {
      return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 })
    }

    if (lancamento.importacao.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    await prisma.extratoImportado.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar lançamento:", error)
    return NextResponse.json(
      { error: "Erro ao deletar lançamento" },
      { status: 500 }
    )
  }
}
