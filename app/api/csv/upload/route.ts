import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import Papa from "papaparse"
import { executarPipeline } from "@/lib/normalizacao/pipeline"
import { MapeamentoColunas } from "@/lib/normalizacao/detector-colunas"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown"
    const { success, remaining, resetAt } = rateLimit(`csv-upload:${ip}`, 20, 60 * 1000)

    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos." },
        { status: 429, headers: getRateLimitHeaders(20, remaining, resetAt) }
      )
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const empresaId = formData.get("empresaId") as string

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      )
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa não fornecida" },
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

    const content = await file.text()

    // Parse CSV usando PapaParse
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true
    })

    const rows = parseResult.data as Record<string, unknown>[]

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Arquivo CSV vazio" },
        { status: 400 }
      )
    }

    // Parse mapeamento (usuário confirmou/editou)
    const mapeamentoJson = formData.get("mapeamento") as string
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

    // Verificar campos obrigatórios
    const camposFaltando = []
    if (!mapeamento.data) camposFaltando.push("data")
    if (!mapeamento.valor) camposFaltando.push("valor")
    if (camposFaltando.length > 0) {
      return NextResponse.json(
        { error: `Mapeamento incompleto. Campos obrigatórios faltando: ${camposFaltando.join(", ")}` },
        { status: 400 }
      )
    }

    // Criar ImportacaoExtrato
    const importacao = await prisma.importacaoExtrato.create({
      data: {
        empresaId,
        tipo: "CSV",
        nomeArquivo: file.name,
        totalLinhas: rows.length,
        mapeamentoColunas: mapeamento as Prisma.InputJsonValue
      }
    })

    // Aplicar pipeline de normalização
    const dadosNormalizados = executarPipeline(rows, mapeamento)

    // Preparar lançamentos para inserção
    const transactions = dadosNormalizados.map((dado) => ({
      importacaoId: importacao.id,
      data: dado.data,
      descricao: dado.descricao,
      valor: dado.valor,
      tipo: dado.tipo,
      identificador: dado.identificador || dado.documento || dado.numero || null,
      banco: dado.banco || null,
      saldoApos: dado.saldoApos || null
    }))

    // Salvar lançamentos em lote usando createMany
    const result = await prisma.extratoImportado.createMany({
      data: transactions,
      skipDuplicates: true
    })

    return NextResponse.json({
      success: true,
      importacao: {
        id: importacao.id,
        tipo: importacao.tipo,
        nomeArquivo: importacao.nomeArquivo
      },
      transactionsImported: result.count
    })
  } catch (error) {
    console.error("Erro ao processar arquivo CSV:", error)
    return NextResponse.json(
      { error: "Erro ao processar arquivo CSV" },
      { status: 500 }
    )
  }
}
