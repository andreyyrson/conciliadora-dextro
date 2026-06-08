import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma, ConciliacaoItemStatus, ConfiancaMatch } from "@prisma/client"

interface DecisaoConciliacao {
  status: string
  erpId?: string
  extratoId?: string
  scoreMatch?: number
  confiancaMatch?: string
  scoreDetalhado?: Record<string, number>
  explicacoes?: string[]
  candidatos?: unknown[]
  diferencaValor?: number
  observacao?: string
}

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
    const { decisoes, hashConciliacao, erpsSobrando } = body as { decisoes: DecisaoConciliacao[]; hashConciliacao?: string; erpsSobrando?: unknown[] }

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
    const itensParaCriar: Prisma.ConciliacaoItemCreateManyInput[] = decisoes.map((d) => {
      // Se não foi decidido manualmente e tem confiança >= 80%, aprovar automaticamente
      // EXCETO se for AMBIGUO (requer decisão manual)
      let statusFinal = d.status
      let resolvidoManualmente = d.status === "CONFIRMADO_MANUAL" || d.status === "REJEITADO"

      if (!resolvidoManualmente && d.status !== "AMBIGUO" && d.confiancaMatch === "HIGH" && (d.scoreMatch ?? 0) >= 80) {
        statusFinal = "AUTO_CONFIRMADO"
        resolvidoManualmente = false
      }

      return {
        conciliacaoId,
        status: statusFinal as ConciliacaoItemStatus,
        erpId: d.erpId || null,
        extratoId: isConta ? d.extratoId || null : null,
        extratoImportadoId: !isConta ? d.extratoId || null : null,
        scoreMatch: d.scoreMatch || null,
        confiancaMatch: (d.confiancaMatch as ConfiancaMatch) || null,
        scoreDetalhado: (d.scoreDetalhado as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        explicacoes: (d.explicacoes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        candidatos: (d.candidatos as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        hashConciliacao: hashConciliacao || null,
        diferencaValor: d.diferencaValor || null,
        observacao: d.observacao || null,
        resolvidoManualmente,
        resolvidoPor: session.user.id, // Definir para todos os itens
        resolvidoEm: new Date() // Definir para todos os itens
      }
    })

    await prisma.conciliacaoItem.createMany({
      data: itensParaCriar,
      skipDuplicates: true
    })

    // Recalcular totais (usar statusFinal que pode ter sido alterado pela auto-confirmação)
    const qtdConciliados = itensParaCriar.filter((d) =>
      d.status === "AUTO_CONFIRMADO" || d.status === "CONFIRMADO_MANUAL"
    ).length
    const qtdDivergentes = itensParaCriar.filter((d) => d.status === "REJEITADO").length
    const qtdFaltandoErp = itensParaCriar.filter((d) => d.status === "SEM_MATCH").length
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
