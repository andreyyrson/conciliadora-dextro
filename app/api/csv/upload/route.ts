import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
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

    const content = await file.text()

    // Parse CSV usando PapaParse
    const Papa = require("papaparse")
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true
    })

    const rows = parseResult.data as any[]

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Arquivo CSV vazio" },
        { status: 400 }
      )
    }

    // Parse mapeamento (usuário confirmou/editou)
    const mapeamentoJson = formData.get("mapeamento") as string
    let mapeamento: any = {}
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
    if (!mapeamento.data || !mapeamento.valor) {
      return NextResponse.json(
        { error: "Mapeamento deve incluir pelo menos 'data' e 'valor'" },
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
        mapeamentoColunas: mapeamento
      } as any
    })

    // Importar pipeline de normalização
    const { executarPipeline } = require("@/lib/normalizacao/pipeline")

    // Aplicar pipeline de normalização
    const dadosNormalizados = executarPipeline(rows, mapeamento)

    // Preparar lançamentos para inserção
    const transactions = dadosNormalizados.map((dado: any) => ({
      importacaoId: importacao.id,
      data: dado.data,
      descricao: dado.descricao,
      valor: dado.valor,
      tipo: dado.tipo,
      identificador: dado.identificador || dado.documento || dado.numero || null,
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
