import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma, ConciliacaoItemStatus } from "@prisma/client"

export async function GET(
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

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const status = searchParams.get("status")
    const orderBy = searchParams.get("orderBy") || "data"

    // Buscar conciliação e verificar permissões
    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id },
      include: {
        upload: true
      }
    })

    if (!conciliacao || conciliacao.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Conciliação não encontrada ou sem permissão" },
        { status: 403 }
      )
    }

    // Construir filtro
    const where: Prisma.ConciliacaoItemWhereInput = { conciliacaoId: id }
    if (status) {
      where.status = status as ConciliacaoItemStatus
    }

    // Contar total de itens
    const total = await prisma.conciliacaoItem.count({ where })

    // Buscar itens com paginação
    const itens = await prisma.conciliacaoItem.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: orderBy === "data" ? "asc" : "desc" },
      include: {
        erp: {
          select: {
            id: true,
            data: true,
            descricao: true,
            valor: true,
            tipo: true,
            documento: true
          }
        },
        extrato: {
          select: {
            id: true,
            data: true,
            descricao: true,
            valor: true,
            tipo: true
          }
        },
        extratoImportado: {
          select: {
            id: true,
            data: true,
            descricao: true,
            valor: true,
            tipo: true
          }
        }
      }
    })

    // Calcular resumo
    const resumo = {
      totalErp: conciliacao.totalErp,
      totalExtrato: conciliacao.totalExtrato,
      qtdConciliados: conciliacao.qtdConciliados,
      qtdDivergentes: conciliacao.qtdDivergentes,
      qtdFaltandoErp: conciliacao.qtdFaltandoErp,
      qtdFaltandoBanco: conciliacao.qtdFaltandoBanco
    }

    return NextResponse.json({
      conciliacao: {
        id: conciliacao.id,
        periodo: conciliacao.periodo,
        status: conciliacao.status,
        criadoEm: conciliacao.criadoEm,
        upload: conciliacao.upload
      },
      resumo,
      itens,
      paginacao: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Erro ao buscar detalhes da conciliação:", error)
    return NextResponse.json(
      { error: "Erro ao buscar detalhes da conciliação" },
      { status: 500 }
    )
  }
}
