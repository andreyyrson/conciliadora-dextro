/**
 * Endpoint para análise de arquivo CSV de extrato antes do upload
 * Detecta colunas, sugere mapeamento e retorna preview
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { detectarColunas } from "@/lib/normalizacao/detector-colunas"

export async function POST(req: Request) {
  try {
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

    if (!file || !empresaId) {
      return NextResponse.json(
        { error: "file e empresaId são obrigatórios" },
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

    // Parse CSV
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

    // Detectar colunas
    const colunas = Object.keys(rows[0])
    const resultado = detectarColunas(colunas, rows)

    // Buscar mapeamento salvo (se existir)
    const importacaoRecente = await prisma.importacaoExtrato.findFirst({
      where: { empresaId },
      orderBy: { createdAt: "desc" }
    }) as any

    let mapeamentoFinal = resultado.mapeamento
    if (importacaoRecente?.mapeamentoColunas) {
      const mapeamentoSalvo = importacaoRecente.mapeamentoColunas as Record<string, string | null>
      mapeamentoFinal = { ...mapeamentoFinal }
      for (const [campo, coluna] of Object.entries(mapeamentoSalvo)) {
        if (!mapeamentoFinal[campo] && coluna && colunas.includes(coluna)) {
          mapeamentoFinal[campo] = coluna
        }
      }
    }

    return NextResponse.json({
      success: true,
      colunas,
      mapeamento: mapeamentoFinal,
      preview: resultado.preview,
      colunasNaoMapeadas: resultado.colunasNaoMapeadas,
      confianca: resultado.confianca,
      totalLinhas: rows.length,
      mapeamentoSalvo: !!importacaoRecente?.mapeamentoColunas
    })

  } catch (error) {
    console.error("Erro ao analisar arquivo CSV:", error)
    return NextResponse.json(
      { error: "Erro ao analisar arquivo CSV" },
      { status: 500 }
    )
  }
}
