import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const importacao = await prisma.importacaoExtrato.findUnique({
      where: { id },
      include: { empresa: true }
    })

    if (!importacao) {
      return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 })
    }

    if (importacao.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const lancamentos = await prisma.extratoImportado.findMany({
      where: { importacaoId: id },
      orderBy: { data: "asc" },
    })

    const rows = lancamentos.map(l => ({
      Data: l.data.toISOString().split("T")[0],
      "Data/Hora": l.data.toISOString().replace("T", " ").slice(0, 19),
      Descrição: l.descricao,
      Valor: Number(l.valor),
      Tipo: l.tipo,
      Identificador: l.identificador || "",
      Banco: l.banco || "",
      "Saldo Após": l.saldoApos ? Number(l.saldoApos) : "",
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos")

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${importacao.nomeArquivo.replace(/\\.[^.]+$/, "")}_lancamentos.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Erro ao exportar lançamentos:", error)
    return NextResponse.json(
      { error: "Erro ao exportar lançamentos" },
      { status: 500 }
    )
  }
}
