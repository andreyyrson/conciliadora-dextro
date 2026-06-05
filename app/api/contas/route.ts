import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { useEmpresa } from "@/lib/use-empresa"

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

    const contas = await prisma.contaBancaria.findMany({
      where: { 
        empresaId,
        pluggyItemId: { not: null } // Apenas contas Open Finance
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({ contas })
  } catch (error) {
    console.error("Erro ao buscar contas:", error)
    return NextResponse.json(
      { error: "Erro ao buscar contas" },
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

    const body = await req.json()
    const { empresaId, banco, agencia, conta } = body

    if (!empresaId || !banco || !conta) {
      return NextResponse.json(
        { error: "empresaId, banco e conta são obrigatórios" },
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

    // Criar conta bancária (estrutura básica)
    const contaBancaria = await prisma.contaBancaria.create({
      data: {
        empresaId,
        banco,
        agencia: agencia || null,
        conta,
        ativa: true
      }
    })

    return NextResponse.json({ conta: contaBancaria }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar conta:", error)
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    )
  }
}
