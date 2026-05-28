import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    // Buscar upload e verificar permissões
    const upload = await prisma.uploadErp.findUnique({
      where: { id },
      include: { empresa: true }
    })

    if (!upload) {
      return NextResponse.json(
        { error: "Upload não encontrado" },
        { status: 404 }
      )
    }

    if (upload.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Sem permissão para deletar este upload" },
        { status: 403 }
      )
    }

    // Deletar itens das conciliações relacionadas ao upload
    const conciliacoes = await prisma.conciliacao.findMany({
      where: { uploadId: id },
      select: { id: true }
    })
    for (const c of conciliacoes) {
      await prisma.conciliacaoItem.deleteMany({
        where: { conciliacaoId: c.id }
      })
    }

    // Deletar conciliações relacionadas ao upload
    await prisma.conciliacao.deleteMany({
      where: { uploadId: id }
    })

    // Deletar lançamentos do upload
    await prisma.erpLancamento.deleteMany({
      where: { uploadId: id }
    })

    // Deletar upload
    await prisma.uploadErp.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar upload:", error)
    return NextResponse.json(
      { error: "Erro ao deletar upload" },
      { status: 500 }
    )
  }
}
