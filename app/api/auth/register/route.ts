import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { registerSchema } from "@/lib/schemas"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown"
    const { success, remaining, resetAt } = rateLimit(`register:${ip}`, 5, 60 * 1000)

    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos." },
        { status: 429, headers: getRateLimitHeaders(5, remaining, resetAt) }
      )
    }
    const body = await req.json()

    const validated = registerSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, name } = validated.data

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null
      }
    })

    return NextResponse.json(
      { 
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erro ao registrar usuário:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Erro ao criar usuário", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
