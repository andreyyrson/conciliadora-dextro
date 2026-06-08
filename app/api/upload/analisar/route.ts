/**
 * Endpoint para análise de arquivo ERP antes do upload
 * Detecta colunas, sugere mapeamento e retorna preview
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { detectarColunas } from "@/lib/normalizacao/detector-colunas"
import Papa from "papaparse"
import * as XLSX from "xlsx"

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
    const fileName = formData.get("fileName") as string

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

    // Ler o arquivo (agora é JSON com preview)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const content = buffer.toString("utf-8")

    let lancamentos: Record<string, unknown>[] = []

    // Se for JSON (preview do frontend)
    if (file.type === "application/json" || fileName === "preview.json") {
      lancamentos = JSON.parse(content) as Record<string, unknown>[]
    } else {
      // Fallback para formato original (CSV/XLSX)
      const fileType = file.type

      if (fileType === "text/csv" || fileName.endsWith(".csv")) {
        const result = Papa.parse(content, {
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
        lancamentos = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]
      } else {
        return NextResponse.json(
          { error: "Tipo de arquivo não suportado. Use CSV ou XLSX" },
          { status: 400 }
        )
      }
    }

    if (lancamentos.length === 0) {
      return NextResponse.json(
        { error: "Arquivo vazio ou sem dados válidos" },
        { status: 400 }
      )
    }

    // Detectar colunas
    const colunas = Object.keys(lancamentos[0])
    const resultado = detectarColunas(colunas, lancamentos)

    // Buscar mapeamento salvo (se existir)
    const uploadRecente = await prisma.uploadErp.findFirst({
      where: { empresaId },
      orderBy: { createdAt: "desc" }
    })

    let mapeamentoFinal = resultado.mapeamento
    if (uploadRecente?.mapeamentoColunas) {
      // Mesclar com mapeamento salvo
      const mapeamentoSalvo = uploadRecente.mapeamentoColunas as Record<string, string | null>
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
      totalLinhas: lancamentos.length,
      mapeamentoSalvo: !!uploadRecente?.mapeamentoColunas
    })

  } catch (error) {
    console.error("Erro ao analisar arquivo:", error)
    return NextResponse.json(
      { error: "Erro ao analisar arquivo" },
      { status: 500 }
    )
  }
}
