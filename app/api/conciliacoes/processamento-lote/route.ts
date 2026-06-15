import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { gerarSugestoes } from "@/lib/matching/engine"

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
    const { uploadIds, contaIds, importacaoIds, periodo } = body

    if (!uploadIds || uploadIds.length === 0) {
      return NextResponse.json(
        { error: "uploadIds é obrigatório" },
        { status: 400 }
      )
    }

    if (!contaIds && !importacaoIds) {
      return NextResponse.json(
        { error: "contaIds ou importacaoIds é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar uploads e verificar permissões
    const uploads = await prisma.uploadErp.findMany({
      where: { id: { in: uploadIds } },
      include: { empresa: true }
    })

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "Nenhum upload encontrado" },
        { status: 404 }
      )
    }

    // Verificar se todos os uploads pertencem ao usuário
    const uploadsInvalidos = uploads.filter(u => u.empresa.userId !== session.user.id)
    if (uploadsInvalidos.length > 0) {
      return NextResponse.json(
        { error: "Uploads não pertencem ao usuário" },
        { status: 403 }
      )
    }

    // Buscar contas bancárias (se fornecidas)
    let contasBancarias: Prisma.ContaBancariaGetPayload<{ include: { empresa: true } }>[] = []
    if (contaIds && contaIds.length > 0) {
      contasBancarias = await prisma.contaBancaria.findMany({
        where: { id: { in: contaIds } },
        include: { empresa: true }
      })

      const contasInvalidas = contasBancarias.filter(c => c.empresa.userId !== session.user.id)
      if (contasInvalidas.length > 0) {
        return NextResponse.json(
          { error: "Contas não pertencem ao usuário" },
          { status: 403 }
        )
      }
    }

    // Buscar importações de extrato (se fornecidas)
    let importacoes: Prisma.ImportacaoExtratoGetPayload<{ include: { empresa: true } }>[] = []
    if (importacaoIds && importacaoIds.length > 0) {
      importacoes = await prisma.importacaoExtrato.findMany({
        where: { id: { in: importacaoIds } },
        include: { empresa: true }
      })

      const importacoesInvalidas = importacoes.filter(i => i.empresa.userId !== session.user.id)
      if (importacoesInvalidas.length > 0) {
        return NextResponse.json(
          { error: "Importações não pertencem ao usuário" },
          { status: 403 }
        )
      }
    }

    // Buscar todos os lançamentos do ERP dos uploads selecionados
    const erpLancamentos = await prisma.erpLancamento.findMany({
      where: { uploadId: { in: uploadIds } }
    })

    // Buscar todos os lançamentos do extrato das contas e importações
    const extratoLancamentos: (Prisma.ExtratoLancamentoGetPayload<object> | Prisma.ExtratoImportadoGetPayload<object>)[] = []

    // Conjunto de ids que vêm de ExtratoImportado (importações OFX/CSV),
    // usado para rotear a FK correta ao persistir ConciliacaoItem.
    const importadoIds = new Set<string>()

    // Extratos de contas bancárias
    if (contaIds && contaIds.length > 0) {
      const extratosContas = await prisma.extratoLancamento.findMany({
        where: { contaId: { in: contaIds } }
      })
      extratoLancamentos.push(...extratosContas)
    }

    // Extratos importados
    if (importacaoIds && importacaoIds.length > 0) {
      const extratosImportados = await prisma.extratoImportado.findMany({
        where: { importacaoId: { in: importacaoIds } }
      })
      extratosImportados.forEach(e => importadoIds.add(e.id))
      extratoLancamentos.push(...extratosImportados)
    }

    // Converter para formato do engine de matching
    const erpEntradas = erpLancamentos.map(l => ({
      id: l.id,
      origem: "ERP" as const,
      data: l.data,
      valor: Number(l.valor),
      tipo: l.tipo as "CREDITO" | "DEBITO",
      descricao: l.descricao,
      documento: l.documento,
      fornecedor: l.fornecedor,
      categoria: l.categoria,
      identificador: l.documento,
      banco: l.banco
    }))

    const extratoEntradas = extratoLancamentos.map(l => ({
      id: l.id,
      origem: "EXTRATO" as const,
      data: l.data,
      valor: Number(l.valor),
      tipo: l.tipo as "CREDITO" | "DEBITO",
      descricao: l.descricao,
      documento: l.identificador,
      identificador: l.identificador,
      banco: l.banco
    }))

    // Executar matching
    const resultadoMatching = gerarSugestoes(erpEntradas, extratoEntradas)

    // Calcular totais
    const totalErp = erpEntradas.reduce((s, e) => s + (e.tipo === "CREDITO" ? e.valor : -e.valor), 0)
    const totalExtrato = extratoEntradas.reduce((s, e) => s + (e.tipo === "CREDITO" ? e.valor : -e.valor), 0)

    // Criar conciliação única com todos os itens
    const conciliacao = await prisma.conciliacao.create({
      data: {
        empresaId: uploads[0].empresaId,
        userId: session.user.id,
        uploadId: uploads[0].id, // Usar o primeiro upload como principal
        contaId: contaIds?.[0] || null,
        importacaoId: importacaoIds?.[0] || null,
        periodo: periodo || uploads[0].periodo,
        status: "PENDENTE_REVISAO",
        totalErp,
        totalExtrato,
        qtdConciliados: resultadoMatching.itens.filter(i => i.status === "CONCILIADO" && i.autoConfirmado).length,
        qtdDivergentes: resultadoMatching.itens.filter(i => i.status === "A_REVISAR").length,
        qtdFaltandoErp: resultadoMatching.erpsSobrando.length,
        qtdFaltandoBanco: resultadoMatching.itens.filter(i => i.status === "NAO_CONCILIADO").length
      }
    })

    // Criar itens de conciliação
    const itensParaCriar = resultadoMatching.itens.map(item => {
      const match = item.sugestoes[0]
      
      // Mapear status unificado do engine para status do banco
      let statusBanco: "AUTO_CONFIRMADO" | "CONFIRMADO_MANUAL" | "REJEITADO" | "SEM_MATCH"
      if (item.status === "CONCILIADO" && item.autoConfirmado) {
        statusBanco = "AUTO_CONFIRMADO"
      } else if (item.status === "NAO_CONCILIADO") {
        statusBanco = "SEM_MATCH"
      } else {
        // A_REVISAR (ex-SUGERIDO/AMBIGUO) viram CONFIRMADO_MANUAL (precisam de revisão)
        statusBanco = "CONFIRMADO_MANUAL"
      }

      // Rotear o id do extrato para a FK correta: extratos de contas vão em
      // extratoId (FK -> ExtratoLancamento); extratos de importações OFX/CSV
      // vão em extratoImportadoId (FK -> ExtratoImportado).
      const isImportado = importadoIds.has(item.extrato.id)

      return {
        conciliacaoId: conciliacao.id,
        status: statusBanco,
        extratoId: isImportado ? null : item.extrato.id,
        erpId: match?.entradaOrigemId || null,
        extratoImportadoId: isImportado ? item.extrato.id : null,
        diferencaValor: item.diferencaValor,
        scoreMatch: match?.score,
        confiancaMatch: match?.confianca,
        scoreDetalhado: match?.scoreDetalhado as unknown as Prisma.InputJsonValue,
        explicacoes: match?.explicacoes as unknown as Prisma.InputJsonValue,
        candidatos: item.sugestoes as unknown as Prisma.InputJsonValue,
        hashConciliacao: resultadoMatching.hashConciliacao
      }
    })

    await prisma.conciliacaoItem.createMany({
      data: itensParaCriar
    })

    return NextResponse.json({
      success: true,
      conciliacaoId: conciliacao.id,
      status: "PENDENTE_REVISAO",
      totalItens: resultadoMatching.itens.length,
      autoConfirmados: resultadoMatching.itens.filter(i => i.status === "CONCILIADO" && i.autoConfirmado).length
    })
  } catch (error) {
    console.error("Erro ao processar lote:", error)
    return NextResponse.json(
      { error: "Erro ao processar lote" },
      { status: 500 }
    )
  }
}
