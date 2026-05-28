import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const empresas = await prisma.empresa.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({ empresas })
  } catch (error) {
    console.error("Erro ao buscar empresas:", error)
    return NextResponse.json(
      { error: "Erro ao buscar empresas" },
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
    const { nome, cnpj } = body

    if (!nome) {
      return NextResponse.json(
        { error: "Nome da empresa é obrigatório" },
        { status: 400 }
      )
    }

    const empresa = await prisma.empresa.create({
      data: {
        nome,
        cnpj: cnpj || null,
        userId: session.user.id
      }
    })

    return NextResponse.json({ empresa }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar empresa:", error)
    return NextResponse.json(
      { error: "Erro ao criar empresa" },
      { status: 500 }
    )
  }
}
