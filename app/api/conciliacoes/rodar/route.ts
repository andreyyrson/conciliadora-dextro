import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runDailyMatching } from "@/lib/conciliacao/daily-matching"
import { calculateStatus } from "@/lib/conciliacao/calculate-status"
import type { ErpTransaction, ExtratoTransaction, DiaConciliacao } from "@/lib/conciliacao/types"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { empresaId, dataInicio, dataFim } = body || {}

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "empresaId, dataInicio e dataFim são obrigatórios" },
        { status: 400 }
      )
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    // Coletar fontes
    const uploads = await prisma.uploadErp.findMany({ where: { empresaId }, select: { id: true } })
    const contas = await prisma.contaBancaria.findMany({ where: { empresaId }, select: { id: true } })
    const importacoes = await prisma.importacaoExtrato.findMany({ where: { empresaId }, select: { id: true } })

    const uploadIds = uploads.map(u => u.id)
    const contaIds = contas.map(c => c.id)
    const importacaoIds = importacoes.map(i => i.id)

    // Buscar lançamentos do período
    const [erpLanc, extLanc, impLanc] = await Promise.all([
      prisma.erpLancamento.findMany({ where: { uploadId: { in: uploadIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoLancamento.findMany({ where: { contaId: { in: contaIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoImportado.findMany({ where: { importacaoId: { in: importacaoIds }, data: { gte: inicio, lte: fim } } }),
    ])

    // Mapear para tipos do motor
    const erpTxs: ErpTransaction[] = erpLanc.map(l => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      valor: Number(l.valor),
      tipo: l.tipo,
      documento: l.documento,
      fornecedor: l.fornecedor,
      banco: l.banco,
      categoria: l.categoria,
    }))
    const extTxs: ExtratoTransaction[] = [
      ...extLanc.map(l => ({
        id: l.id,
        origem: "EXTRATO" as const,
        data: l.data,
        descricao: l.descricao,
        valor: Number(l.valor),
        tipo: l.tipo,
        saldoApos: l.saldoApos != null ? Number(l.saldoApos) : null,
        identificador: l.identificador,
        banco: l.banco,
      })),
      ...impLanc.map(l => ({
        id: l.id,
        origem: "EXTRATO_IMPORTADO" as const,
        data: l.data,
        descricao: l.descricao,
        valor: Number(l.valor),
        tipo: l.tipo,
        saldoApos: null,
        identificador: l.identificador,
        banco: l.banco,
      })),
    ]

    // Agrupar por dia (YYYY-MM-DD)
    const diasSet = new Set<string>()
    erpTxs.forEach(t => diasSet.add(t.data.toISOString().split("T")[0]))
    extTxs.forEach(t => diasSet.add(t.data.toISOString().split("T")[0]))
    const diasOrdenados = Array.from(diasSet).sort()

    const dias: DiaConciliacao[] = diasOrdenados.map(dataKey => {
      const erpDia = erpTxs.filter(t => t.data.toISOString().startsWith(dataKey))
      const extDia = extTxs.filter(t => t.data.toISOString().startsWith(dataKey))

      const { matching } = runDailyMatching(erpDia, extDia)

      const totalDebitoErp = erpDia.filter(e => e.tipo === "DEBITO").reduce((s, e) => s + Number(e.valor), 0)
      const totalCreditoErp = erpDia.filter(e => e.tipo === "CREDITO").reduce((s, e) => s + Number(e.valor), 0)
      const totalDebitoExtrato = extDia.filter(e => e.tipo === "DEBITO").reduce((s, e) => s + Number(e.valor), 0)
      const totalCreditoExtrato = extDia.filter(e => e.tipo === "CREDITO").reduce((s, e) => s + Number(e.valor), 0)

      const diferencaDebito = Math.abs(totalDebitoErp - totalDebitoExtrato)
      const diferencaCredito = Math.abs(totalCreditoErp - totalCreditoExtrato)

      const statusDia = calculateStatus({
        qtdErp: erpDia.length,
        qtdExtrato: extDia.length,
        matching,
        totalDebitoErp,
        totalCreditoErp,
        totalDebitoExtrato,
        totalCreditoExtrato,
        diferencaDebito,
        diferencaCredito,
      })

      return {
        data: dataKey,
        totalDebitoErp,
        totalCreditoErp,
        totalDebitoExtrato,
        totalCreditoExtrato,
        saldoFinalErp: totalCreditoErp - totalDebitoErp,
        saldoFinalExtrato: totalCreditoExtrato - totalDebitoExtrato,
        saldoAposBanco: null,
        transacoesErp: erpDia,
        transacoesExtrato: extDia,
        statusDia,
        qtdErp: erpDia.length,
        qtdExtrato: extDia.length,
        diferencaDebito,
        diferencaCredito,
        matches: {
          conciliados: matching.itens.filter(i => i.status === "CONCILIADO").length,
          aRevisar: matching.itens.filter(i => i.status === "A_REVISAR").length,
          naoConciliados: matching.erpsSobrando.length + matching.extratosSobrando.length,
          erpsSobrando: matching.erpsSobrando.length,
          detalhes: [],
          erpsSobrandoDetalhes: matching.erpsSobrando.map(e => ({
            id: e.id,
            descricao: e.descricao,
            valor: e.valor,
            tipo: e.tipo,
          })),
        }
      }
    })

    const resumo = {
      periodo: { inicio: dataInicio, fim: dataFim },
      totais: {
        erp: erpLanc.length,
        extrato_open_finance: extLanc.length,
        extrato_importado: impLanc.length,
      },
      dias,
    }

    return NextResponse.json({ message: "Conciliação concluída", resumo }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao rodar conciliação" }, { status: 500 })
  }
}
