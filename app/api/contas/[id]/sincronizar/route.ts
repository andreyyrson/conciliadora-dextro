import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { polp } from "@/lib/polp/client"
import { normalizarTransacao } from "@/lib/polp/normalizer"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const contaId = params.id

    // Buscar conta bancária
    const conta = await prisma.contaBancaria.findUnique({
      where: { id: contaId },
      include: { empresa: true }
    })

    if (!conta) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      )
    }

    // Verificar se a empresa pertence ao usuário
    if (conta.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão para acessar esta conta" },
        { status: 403 }
      )
    }

    // Buscar transações da POLP (últimos 30 dias)
    const hoje = new Date()
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(hoje.getDate() - 30)

    // Nota: Como a POLP requer accountId específico e não temos ainda
    // a integração completa, vamos simular o processo
    // Em produção, isso seria:
    // const transactions = await polp.getTransactions(conta.polpAccountId, trintaDiasAtras, hoje)

    // Por enquanto, vamos apenas atualizar a data de sincronização
    await prisma.contaBancaria.update({
      where: { id: contaId },
      data: {
        ultimaSincAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "Sincronização iniciada (integração POLP pendente de configuração completa)",
      ultimaSincAt: new Date()
    })
  } catch (error) {
    console.error("Erro ao sincronizar conta:", error)
    return NextResponse.json(
      { error: "Erro ao sincronizar conta" },
      { status: 500 }
    )
  }
}
