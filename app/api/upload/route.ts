import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { executarPipeline } from "@/lib/normalizacao/pipeline"
import { MapeamentoColunas } from "@/lib/normalizacao/detector-colunas"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import Papa from "papaparse"
import * as XLSX from "xlsx"

export async function GET(req: Request) {
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

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const skip = (page - 1) * limit

    const [uploads, total] = await Promise.all([
      prisma.uploadErp.findMany({
        where: { empresaId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.uploadErp.count({ where: { empresaId } }),
    ])

    return NextResponse.json({
      uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar uploads:", error)
    return NextResponse.json(
      { error: "Erro ao buscar uploads" },
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

    const { success, remaining, resetAt } = rateLimit(`upload:${session.user.id}`, 10, 60 * 1000)
    if (!success) {
      return NextResponse.json(
        { error: "Muitos uploads. Tente novamente em alguns minutos." },
        { status: 429, headers: getRateLimitHeaders(10, remaining, resetAt) }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const empresaId = formData.get("empresaId") as string
    const dataReferencia = formData.get("periodo") as string
    const mapeamentoJson = formData.get("mapeamento") as string

    if (!file || !empresaId || !dataReferencia) {
      return NextResponse.json(
        { error: "file, empresaId e periodo são obrigatórios" },
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

    // Ler o arquivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determinar o tipo do arquivo
    const fileType = file.type
    const fileName = file.name

    // Processar o arquivo (CSV ou XLSX)
    let lancamentos: Record<string, unknown>[] = []

    if (fileType === "text/csv" || fileName.endsWith(".csv")) {
      const result = Papa.parse(buffer.toString("utf-8"), {
        header: true,
        skipEmptyLines: true
      })
      lancamentos = result.data as Record<string, unknown>[]
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fileName.endsWith(".xlsx")
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]
      lancamentos = jsonData
    } else {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use CSV ou XLSX" },
        { status: 400 }
      )
    }

    if (lancamentos.length === 0) {
      return NextResponse.json(
        { error: "Arquivo vazio ou sem dados válidos" },
        { status: 400 }
      )
    }

    // Parse mapeamento (usuário confirmou/editou)
    let mapeamento: MapeamentoColunas = {}
    if (mapeamentoJson) {
      try {
        mapeamento = JSON.parse(mapeamentoJson)
      } catch {
        return NextResponse.json(
          { error: "Mapeamento inválido" },
          { status: 400 }
        )
      }
    }

    // Verificar se mapeamento tem campos obrigatórios
    if (!mapeamento.data || !mapeamento.valor) {
      return NextResponse.json(
        { error: "Mapeamento deve incluir pelo menos 'data' e 'valor'" },
        { status: 400 }
      )
    }

    // Criar registro de upload
    const upload = await prisma.uploadErp.create({
      data: {
        empresaId,
        nomeArquivo: fileName,
        periodo: dataReferencia,
        totalLinhas: lancamentos.length,
        mapeamentoColunas: mapeamento as Prisma.InputJsonValue
      }
    })

    // Aplicar pipeline de normalização
    const dadosNormalizados = executarPipeline(lancamentos, mapeamento)

    // Preparar lançamentos para inserção
    const erpLancamentos = dadosNormalizados.map(dado => ({
      uploadId: upload.id,
      data: dado.data,
      descricao: dado.descricao,
      valor: dado.valor,
      tipo: dado.tipo,
      documento: dado.documento || null,
      centroCusto: dado.centroCusto || null,
      banco: dado.banco || null,
      fornecedor: dado.fornecedor || null,
      categoria: dado.categoria || null,
      rawData: dado.rawData as unknown as Prisma.InputJsonValue
    }))

    // Salvar lançamentos em lote
    const result = await prisma.erpLancamento.createMany({
      data: erpLancamentos,
      skipDuplicates: true
    })

    // Atualizar total de linhas processadas
    await prisma.uploadErp.update({
      where: { id: upload.id },
      data: { totalLinhas: result.count }
    })

    // Todos os lançamentos extraídos para exibição completa no frontend
    const previewExtraido = dadosNormalizados.map(d => ({
      data: d.data.toISOString().split("T")[0],
      valor: d.valor,
      tipo: d.tipo,
      descricao: d.descricao,
      fornecedor: d.fornecedor || null,
      banco: d.banco || null,
      categoria: d.categoria || null
    }))

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      totalLinhas: result.count,
      totalNormalizado: dadosNormalizados.length,
      preview: previewExtraido
    })
  } catch (error) {
    console.error("Erro ao processar upload:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack")
    return NextResponse.json(
      { error: "Erro ao processar upload", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
