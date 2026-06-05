import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { pluggy } from "@/lib/pluggy/client"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { empresaId, connectorId, parameters } = body

    if (!empresaId || !connectorId) {
      return NextResponse.json(
        { error: "empresaId e connectorId são obrigatórios" },
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

    // Criar item no Pluggy
    let item
    try {
      item = await pluggy.createItem(connectorId, parameters)
    } catch (error) {
      console.error("Erro ao criar item Pluggy:", error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erro ao criar item na Pluggy" },
        { status: 500 }
      )
    }


    if (!item || !item.id) {
      return NextResponse.json(
        { error: "Erro ao criar item: resposta inválida da Pluggy" },
        { status: 500 }
      )
    }

    // Salvar item temporariamente
    const contaTemp = await prisma.contaBancaria.create({
      data: {
        empresaId,
        banco: "Aguardando sincronização...",
        agencia: null,
        conta: item.id,
        pluggyItemId: item.id,
        ativa: false
      }
    })

    return NextResponse.json({
      itemId: item.id,
      status: item.status,
      contaId: contaTemp.id
    })
  } catch (error) {
    console.error("Erro ao criar item:", error)
    return NextResponse.json(
      { error: "Erro ao criar item", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
