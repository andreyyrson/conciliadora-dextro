import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseOFX, validateOFX } from "@/lib/ofx/parser"
import { prisma } from "@/lib/db"

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

    // Validate OFX
    const validation = validateOFX(content)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Parse OFX
    const ofxData = parseOFX(content)

    if (ofxData.accounts.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma conta encontrada no arquivo OFX" },
        { status: 400 }
      )
    }

    // Criar ImportacaoExtrato
    const importacao = await prisma.importacaoExtrato.create({
      data: {
        empresaId,
        tipo: "OFX",
        nomeArquivo: file.name,
        totalLinhas: ofxData.accounts.reduce((acc, accData) => acc + accData.transactions.length, 0)
      }
    })

    // Preparar todos os lançamentos de todas as contas
    const allTransactions = []
    
    for (const account of ofxData.accounts) {
      for (const transaction of account.transactions) {
        allTransactions.push({
          importacaoId: importacao.id,
          data: transaction.date,
          descricao: transaction.description,
          valor: transaction.amount,
          tipo: transaction.type === 'CREDIT' ? 'CREDITO' : 'DEBITO',
          identificador: transaction.id,
          saldoApos: null
        })
      }
    }

    // Salvar lançamentos em lote usando createMany
    const result = await prisma.extratoImportado.createMany({
      data: allTransactions,
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
    console.error("Erro ao processar arquivo OFX:", error)
    return NextResponse.json(
      { error: "Erro ao processar arquivo OFX" },
      { status: 500 }
    )
  }
}
