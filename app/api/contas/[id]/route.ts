import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Deletar conta e todos os lançamentos associados (cascade)
    await prisma.contaBancaria.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir conta:", error)
    return NextResponse.json(
      { error: "Erro ao excluir conta" },
      { status: 500 }
    )
  }
}
