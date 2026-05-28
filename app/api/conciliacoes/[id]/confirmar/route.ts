import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { id: conciliacaoId } = await params
    const body = await req.json()
    const { decisoes, hashConciliacao, erpsSobrando } = body

    if (!Array.isArray(decisoes)) {
      return NextResponse.json({ error: "decisoes deve ser um array" }, { status: 400 })
    }

    // Verificar permissão
    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id: conciliacaoId }
    })
    if (!conciliacao || conciliacao.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Validar hash (se fornecido)
    if (hashConciliacao && conciliacao.status !== "PENDENTE_REVISAO") {
      // Se hash fornecido e já foi processado antes, verificar consistência
      // Na prática, se status já é CONCLUIDA, rejeitamos
      if (conciliacao.status === "CONCLUIDA") {
        return NextResponse.json({ error: "Conciliação já concluída" }, { status: 409 })
      }
    }

    // Buscar tipo de extrato (contaId vs importacaoId)
    const isConta = !!conciliacao.contaId

    // Deletar itens anteriores (se houver) para reprocessamento
    await prisma.conciliacaoItem.deleteMany({
      where: { conciliacaoId }
    })

    // Criar novos itens
    const itensParaCriar = decisoes.map((d: any) => ({
      conciliacaoId,
      status: d.status,
      erpId: d.erpId || null,
      extratoId: isConta ? d.extratoId || null : null,
      extratoImportadoId: !isConta ? d.extratoId || null : null,
      scoreMatch: d.scoreMatch || null,
      confiancaMatch: d.confiancaMatch || null,
      scoreDetalhado: d.scoreDetalhado || null,
      explicacoes: d.explicacoes || null,
      candidatos: d.candidatos || null,
      hashConciliacao: hashConciliacao || null,
      diferencaValor: d.diferencaValor || null,
      observacao: d.observacao || null,
      resolvidoManualmente: d.status === "CONFIRMADO_MANUAL" || d.status === "REJEITADO",
      resolvidoPor: d.status === "CONFIRMADO_MANUAL" || d.status === "REJEITADO" ? session.user.id : null,
      resolvidoEm: d.status === "CONFIRMADO_MANUAL" || d.status === "REJEITADO" ? new Date() : null
    }))

    await prisma.conciliacaoItem.createMany({
      data: itensParaCriar,
      skipDuplicates: true
    })

    // Recalcular totais
    const qtdConciliados = decisoes.filter((d: any) =>
      d.status === "AUTO_CONFIRMADO" || d.status === "CONFIRMADO_MANUAL"
    ).length
    const qtdDivergentes = decisoes.filter((d: any) => d.status === "REJEITADO").length
    const qtdFaltandoErp = decisoes.filter((d: any) => d.status === "SEM_MATCH").length
    const qtdFaltandoBanco = Array.isArray(erpsSobrando) ? erpsSobrando.length : 0

    // Atualizar conciliação
    await prisma.conciliacao.update({
      where: { id: conciliacaoId },
      data: {
        status: "CONCLUIDA",
        qtdConciliados,
        qtdDivergentes,
        qtdFaltandoErp,
        qtdFaltandoBanco
      }
    })

    return NextResponse.json({
      success: true,
      resumo: { qtdConciliados, qtdDivergentes, qtdFaltandoErp, qtdFaltandoBanco }
    })
  } catch (error) {
    console.error("Erro ao confirmar conciliação:", error)
    return NextResponse.json({ error: "Erro ao confirmar" }, { status: 500 })
  }
}
