import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const uploadId = searchParams.get("uploadId")
    const search = searchParams.get("search") || ""
    const tipo = searchParams.get("tipo") || ""
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const skip = (page - 1) * limit

    if (!empresaId) {
      return NextResponse.json({ error: "empresaId é obrigatório" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const where: any = {
      upload: { empresaId }
    }

    if (uploadId) {
      where.uploadId = uploadId
    }

    if (search) {
      where.OR = [
        { descricao: { contains: search, mode: "insensitive" } },
        { documento: { contains: search, mode: "insensitive" } },
        { fornecedor: { contains: search, mode: "insensitive" } },
        { banco: { contains: search, mode: "insensitive" } },
      ]
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(dataInicio)
      if (dataFim) {
        const fim = new Date(dataFim)
        fim.setHours(23, 59, 59, 999)
        where.data.lte = fim
      }
    }

    const [lancamentos, total] = await Promise.all([
      prisma.erpLancamento.findMany({
        where,
        orderBy: { data: "desc" },
        include: {
          upload: {
            select: { nomeArquivo: true, periodo: true }
          }
        },
        skip,
        take: limit,
      }),
      prisma.erpLancamento.count({ where }),
    ])

    return NextResponse.json({
      lancamentos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Erro ao buscar lançamentos ERP:", error)
    return NextResponse.json(
      { error: "Erro ao buscar lançamentos ERP" },
      { status: 500 }
    )
  }
}
