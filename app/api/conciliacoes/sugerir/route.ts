import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { gerarSugestoes, EntradaConciliacao } from "@/lib/matching/engine"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { uploadId, contaId, importacaoId } = body

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId é obrigatório" }, { status: 400 })
    }
    if (!contaId && !importacaoId) {
      return NextResponse.json({ error: "contaId ou importacaoId é obrigatório" }, { status: 400 })
    }

    // Verificar upload
    const upload = await prisma.uploadErp.findUnique({
      where: { id: uploadId },
      include: { empresa: true }
    })
    if (!upload || upload.empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Upload não encontrado ou sem permissão" }, { status: 403 })
    }

    // Buscar lançamentos do extrato
    let extratoRows: any[] = []
    if (contaId) {
      const conta = await prisma.contaBancaria.findUnique({
        where: { id: contaId },
        include: { empresa: true }
      })
      if (!conta || conta.empresa.userId !== session.user.id) {
        return NextResponse.json({ error: "Conta não encontrada ou sem permissão" }, { status: 403 })
      }
      extratoRows = await prisma.extratoLancamento.findMany({ where: { contaId } })
    } else if (importacaoId) {
      const importacao = await prisma.importacaoExtrato.findUnique({
        where: { id: importacaoId },
        include: { empresa: true }
      })
      if (!importacao || importacao.empresa.userId !== session.user.id) {
        return NextResponse.json({ error: "Importação não encontrada ou sem permissão" }, { status: 403 })
      }
      extratoRows = await prisma.extratoImportado.findMany({ where: { importacaoId } })
    }

    // Buscar lançamentos do ERP
    const erpRows = await prisma.erpLancamento.findMany({ where: { uploadId } })

    // Converter para EntradaConciliacao
    const erpEntradas: EntradaConciliacao[] = erpRows.map((l: any) => ({
      id: l.id,
      origem: "ERP",
      data: new Date(l.data),
      valor: Number(l.valor),
      tipo: (l.tipo === "CREDITO" ? "CREDITO" : "DEBITO") as "CREDITO" | "DEBITO",
      descricao: l.descricao || "",
      documento: l.documento || null,
      fornecedor: l.fornecedor || null,
      categoria: l.categoria || null,
      identificador: null
    }))

    const extratoEntradas: EntradaConciliacao[] = extratoRows.map((l: any) => ({
      id: l.id,
      origem: "EXTRATO",
      data: new Date(l.data),
      valor: Number(l.valor),
      tipo: (l.tipo === "CREDITO" ? "CREDITO" : "DEBITO") as "CREDITO" | "DEBITO",
      descricao: l.descricao || "",
      documento: null,
      fornecedor: null,
      categoria: null,
      identificador: l.identificador || null
    }))

    // Executar engine de sugestões (stateless, pura)
    const resultado = gerarSugestoes(erpEntradas, extratoEntradas)

    return NextResponse.json({
      success: true,
      hashConciliacao: resultado.hashConciliacao,
      periodo: upload.periodo,
      totalErp: resultado.totalErp,
      totalExtrato: resultado.totalExtrato,
      itens: resultado.itens,
      erpsSobrando: resultado.erpsSobrando,
      erps: erpEntradas // Enviar dados completos dos ERPs para o frontend
    })
  } catch (error) {
    console.error("Erro ao gerar sugestões:", error)
    return NextResponse.json({ error: "Erro ao gerar sugestões" }, { status: 500 })
  }
}
