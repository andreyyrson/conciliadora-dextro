import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { parseOFX, validateOFX } from "@/lib/ofx/parser"

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

    const validation = validateOFX(content)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const ofxData = parseOFX(content)

    if (ofxData.accounts.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma conta encontrada no arquivo OFX" },
        { status: 400 }
      )
    }

    const totalTransacoes = ofxData.accounts.reduce(
      (acc, accData) => acc + accData.transactions.length, 0
    )

    // Preview: first 50 transactions across all accounts
    const preview: {
      data: string
      descricao: string
      valor: number
      tipo: string
      banco: string
      identificador: string
    }[] = []

    for (const account of ofxData.accounts) {
      for (const transaction of account.transactions.slice(0, 50)) {
        preview.push({
          data: transaction.date.toISOString().split("T")[0],
          descricao: transaction.description || transaction.memo || "",
          valor: Math.abs(transaction.amount),
          tipo: transaction.type === "CREDIT" ? "CREDITO" : "DEBITO",
          banco: account.bankId || "Não Informado",
          identificador: transaction.id || "",
        })
        if (preview.length >= 50) break
      }
      if (preview.length >= 50) break
    }

    return NextResponse.json({
      success: true,
      nomeArquivo: file.name,
      totalContas: ofxData.accounts.length,
      totalTransacoes,
      preview,
      contas: ofxData.accounts.map(a => ({
        banco: a.bankId || "Não Informado",
        conta: a.accountId,
        tipo: a.accountType,
        saldo: a.balance,
        transacoes: a.transactions.length,
        moeda: a.currency,
      })),
    })
  } catch (error) {
    console.error("Erro ao analisar arquivo OFX:", error)
    return NextResponse.json(
      { error: "Erro ao analisar arquivo OFX" },
      { status: 500 }
    )
  }
}
