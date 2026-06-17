import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const bodySchema = z.object({
  empresaId: z.string().min(1),
  itens: z.array(
    z.object({
      erpId: z.string().optional(),
      extratoId: z.string().optional(),
      extratoImportadoId: z.string().optional(),
    })
  ).min(1),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { empresaId, itens } = parsed.data
    const userId = session.user.id

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== userId) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    await prisma.$transaction(async (tx) => {
      for (const item of itens) {
        await (tx as any).divergenciaAceita.create({
          data: {
            empresaId,
            erpId: item.erpId || null,
            extratoId: item.extratoId || null,
            extratoImportadoId: item.extratoImportadoId || null,
            userId,
          },
        })
      }
    })

    return NextResponse.json({ success: true, qtd: itens.length })
  } catch (e: any) {
    console.error("Erro ao aceitar divergências:", e)
    return NextResponse.json(
      { error: e.message || "Erro ao aceitar divergências" },
      { status: 500 }
    )
  }
}
