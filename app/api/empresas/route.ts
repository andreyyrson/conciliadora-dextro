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

    console.log("Buscando empresas para userId:", session.user.id)

    const empresas = await prisma.empresa.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" }
    })

    console.log("Empresas encontradas:", empresas.length)

    return NextResponse.json({ empresas })
  } catch (error) {
    console.error("Erro ao buscar empresas:", error)
    console.error("Detalhes do erro:", JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: "Erro ao buscar empresas", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

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
    const { nome, cnpj } = body

    if (!nome) {
      return NextResponse.json(
        { error: "Nome da empresa é obrigatório" },
        { status: 400 }
      )
    }

    const empresa = await prisma.empresa.create({
      data: {
        nome,
        cnpj: cnpj || null,
        userId: session.user.id
      }
    })

    return NextResponse.json({ empresa }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar empresa:", error)
    return NextResponse.json(
      { error: "Erro ao criar empresa" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
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

    // Deletar em cascada usando transação
    await prisma.$transaction(async (tx) => {
      // Deletar itens de conciliação primeiro
      await tx.conciliacaoItem.deleteMany({
        where: {
          conciliacao: {
            empresaId
          }
        }
      })

      // Deletar conciliações
      await tx.conciliacao.deleteMany({
        where: { empresaId }
      })

      // Deletar lançamentos ERP
      await tx.erpLancamento.deleteMany({
        where: {
          upload: {
            empresaId
          }
        }
      })

      // Deletar uploads ERP
      await tx.uploadErp.deleteMany({
        where: { empresaId }
      })

      // Deletar itens de extrato importado
      await tx.conciliacaoItem.deleteMany({
        where: {
          extratoImportado: {
            importacao: {
              empresaId
            }
          }
        }
      })

      // Deletar extratos importados
      await tx.extratoImportado.deleteMany({
        where: {
          importacao: {
            empresaId
          }
        }
      })

      // Deletar importações de extrato
      await tx.importacaoExtrato.deleteMany({
        where: { empresaId }
      })

      // Deletar extratos de contas bancárias
      await tx.extratoLancamento.deleteMany({
        where: {
          conta: {
            empresaId
          }
        }
      })

      // Deletar contas bancárias
      await tx.contaBancaria.deleteMany({
        where: { empresaId }
      })

      // Deletar a empresa
      await tx.empresa.delete({
        where: { id: empresaId }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar empresa:", error)
    return NextResponse.json(
      { error: "Erro ao deletar empresa" },
      { status: 500 }
    )
  }
}
