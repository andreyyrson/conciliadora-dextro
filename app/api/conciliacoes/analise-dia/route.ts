import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { gerarSugestoes, EntradaConciliacao } from "@/lib/matching/engine"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "empresaId, dataInicio e dataFim são obrigatórios" },
        { status: 400 }
      )
    }

    // Verificar se a empresa pertence ao usuário
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    })

    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    // Buscar uploads da empresa para filtrar ERP lançamentos
    const uploads = await prisma.uploadErp.findMany({
      where: { empresaId },
      select: { id: true }
    })
    const uploadIds = uploads.map(u => u.id)

    // Buscar contas bancárias da empresa para filtrar extratos
    const contas = await prisma.contaBancaria.findMany({
      where: { empresaId },
      select: { id: true }
    })
    const contaIds = contas.map(c => c.id)

    // Buscar importações da empresa para filtrar extratos importados
    const importacoes = await prisma.importacaoExtrato.findMany({
      where: { empresaId },
      select: { id: true }
    })
    const importacaoIds = importacoes.map(i => i.id)

    // Buscar lançamentos ERP
    const erpLancamentos = await prisma.erpLancamento.findMany({
      where: {
        uploadId: { in: uploadIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar lançamentos de extrato bancário
    const extratoLancamentos = await prisma.extratoLancamento.findMany({
      where: {
        contaId: { in: contaIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar lançamentos de extrato importado
    const extratosImportados = await prisma.extratoImportado.findMany({
      where: {
        importacaoId: { in: importacaoIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Combinar todos os extratos
    const todosExtratos = [
      ...extratoLancamentos.map(e => ({
        id: e.id,
        origem: "EXTRATO" as const,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
        identificador: e.identificador,
        banco: e.banco,
      })),
      ...extratosImportados.map(e => ({
        id: e.id,
        origem: "EXTRATO_IMPORTADO" as const,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
        identificador: e.identificador,
        banco: e.banco,
      }))
    ]

    // Agrupar ERP por dia
    const erpPorDia = new Map<string, typeof erpLancamentos>()
    for (const l of erpLancamentos) {
      const key = l.data.toISOString().split("T")[0]
      if (!erpPorDia.has(key)) erpPorDia.set(key, [])
      erpPorDia.get(key)!.push(l)
    }

    // Agrupar extrato por dia
    const extratoPorDia = new Map<string, typeof todosExtratos>()
    for (const e of todosExtratos) {
      const key = e.data.toISOString().split("T")[0]
      if (!extratoPorDia.has(key)) extratoPorDia.set(key, [])
      extratoPorDia.get(key)!.push(e)
    }

    // Gerar todos os dias do período
    const dias: string[] = []
    const atual = new Date(inicio)
    while (atual <= fim) {
      dias.push(atual.toISOString().split("T")[0])
      atual.setDate(atual.getDate() + 1)
    }

    const resultado = dias.map(dataKey => {
      const erpsDoDia = erpPorDia.get(dataKey) || []
      const extratosDoDia = extratoPorDia.get(dataKey) || []

      const totalDebitoErp = erpsDoDia
        .filter(e => e.tipo === "DEBITO")
        .reduce((s, e) => s + Number(e.valor), 0)
      const totalCreditoErp = erpsDoDia
        .filter(e => e.tipo === "CREDITO")
        .reduce((s, e) => s + Number(e.valor), 0)

      const totalDebitoExtrato = extratosDoDia
        .filter(e => e.tipo === "DEBITO")
        .reduce((s, e) => s + e.valor, 0)
      const totalCreditoExtrato = extratosDoDia
        .filter(e => e.tipo === "CREDITO")
        .reduce((s, e) => s + e.valor, 0)

      const saldoFinalErp = totalCreditoErp - totalDebitoErp
      const saldoFinalExtratoDia = totalCreditoExtrato - totalDebitoExtrato

      // Saldo final do banco (último saldoApos do dia, se disponível)
      const saldoAposBanco = extratosDoDia.length > 0
        ? extratosDoDia[extratosDoDia.length - 1].saldoApos
        : null

      // Matching por dia
      const erpEntradas: EntradaConciliacao[] = erpsDoDia.map(e => ({
        id: e.id,
        origem: "ERP",
        data: e.data,
        valor: Number(e.valor),
        tipo: e.tipo as "CREDITO" | "DEBITO",
        descricao: e.descricao,
        documento: e.documento,
        fornecedor: e.fornecedor,
        categoria: e.categoria,
        banco: e.banco,
      }))

      const extratoEntradas: EntradaConciliacao[] = extratosDoDia.map(e => ({
        id: e.id,
        origem: "EXTRATO",
        data: e.data,
        valor: e.valor,
        tipo: e.tipo as "CREDITO" | "DEBITO",
        descricao: e.descricao,
        identificador: e.identificador,
        banco: e.banco,
      }))

      const matching = gerarSugestoes(erpEntradas, extratoEntradas)

      const diferencaDebito = Math.abs(totalDebitoErp - totalDebitoExtrato)
      const diferencaCredito = Math.abs(totalCreditoErp - totalCreditoExtrato)
      const tolerancia = 0.01

      let statusDia: "CONCILIADO" | "DIVERGENTE" | "PARCIAL" | "SEM_DADOS" | "SUGERIDO"
      if (erpsDoDia.length === 0 && extratosDoDia.length === 0) {
        statusDia = "SEM_DADOS"
      } else if (matching.itens.some(i => i.status === "AUTO_CONFIRMADO")) {
        statusDia = "CONCILIADO"
      } else if (matching.itens.some(i => i.status === "SUGERIDO" || i.status === "AMBIGUO")) {
        statusDia = "SUGERIDO"
      } else if (diferencaDebito <= tolerancia && diferencaCredito <= tolerancia) {
        statusDia = "CONCILIADO"
      } else if ((totalDebitoErp > 0 || totalCreditoErp > 0) && (totalDebitoExtrato > 0 || totalCreditoExtrato > 0)) {
        statusDia = "PARCIAL"
      } else {
        statusDia = "DIVERGENTE"
      }

      return {
        data: dataKey,
        totalDebitoErp,
        totalCreditoErp,
        totalDebitoExtrato,
        totalCreditoExtrato,
        saldoFinalErp,
        saldoFinalExtrato: saldoFinalExtratoDia,
        saldoAposBanco,
        transacoesErp: erpsDoDia.map(e => ({
          id: e.id,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          documento: e.documento,
          fornecedor: e.fornecedor,
        })),
        transacoesExtrato: extratosDoDia.map(e => ({
          id: e.id,
          descricao: e.descricao,
          valor: e.valor,
          tipo: e.tipo,
          identificador: e.identificador,
          banco: e.banco,
        })),
        statusDia,
        qtdErp: erpsDoDia.length,
        qtdExtrato: extratosDoDia.length,
        matches: {
          autoConfirmados: matching.itens.filter(i => i.status === "AUTO_CONFIRMADO").length,
          sugeridos: matching.itens.filter(i => i.status === "SUGERIDO").length,
          ambiguos: matching.itens.filter(i => i.status === "AMBIGUO").length,
          semMatch: matching.itens.filter(i => i.status === "SEM_MATCH").length,
          erpsSobrando: matching.erpsSobrando.length,
          detalhes: matching.itens.map(i => ({
            extratoId: i.extrato.id,
            extratoDescricao: i.extrato.descricao,
            extratoValor: i.extrato.valor,
            status: i.status,
            confianca: i.confianca,
            score: i.sugestoes[0]?.score || 0,
            erpPareado: i.erpPareado ? {
              id: i.erpPareado.id,
              descricao: i.erpPareado.descricao,
              valor: i.erpPareado.valor,
            } : null,
            diferencaValor: i.diferencaValor,
            explicacoes: i.sugestoes[0]?.explicacoes || [],
          })),
        }
      }
    })

    return NextResponse.json({ dias: resultado })
  } catch (error) {
    console.error("Erro ao gerar análise por dia:", error)
    return NextResponse.json(
      { error: "Erro ao gerar análise por dia" },
      { status: 500 }
    )
  }
}
