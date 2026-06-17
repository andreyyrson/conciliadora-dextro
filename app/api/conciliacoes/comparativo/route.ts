import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { fetchExtratos } from "@/lib/extrato/fetch-unificado"
import type { LinhaComparativa, ErpLancamento, ExtratoLancamento } from "@/lib/conciliacao/comparativo-types"
import { runDailyMatching } from "@/lib/conciliacao/daily-matching"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")
    const tipo = searchParams.get("tipo") || ""
    const statusFiltro = searchParams.get("status") || ""
    const search = searchParams.get("search")?.toLowerCase() || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const skip = (page - 1) * limit

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: "empresaId, dataInicio e dataFim são obrigatórios" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json({ error: "Empresa não encontrada ou não pertence ao usuário" }, { status: 403 })
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    const uploads = await prisma.uploadErp.findMany({ where: { empresaId }, select: { id: true } })
    const uploadIds = uploads.map(u => u.id)

    const [erpLanc, extratos] = await Promise.all([
      prisma.erpLancamento.findMany({ where: { uploadId: { in: uploadIds }, data: { gte: inicio, lte: fim } } }),
      fetchExtratos(empresaId, inicio, fim),
    ])

    // Preparar dias e rodar matching diário com regra 2-de-3 (implementada em gerarSugestoesComparativo)
    const diasSet = new Set<string>()
    erpLanc.forEach(l => diasSet.add(l.data.toISOString().split('T')[0]))
    extratos.forEach(e => diasSet.add(e.data.toISOString().split('T')[0]))
    const datasOrdenadas = Array.from(diasSet).sort()

    const toErpTx = (l: typeof erpLanc[number]) => ({ id: l.id, data: l.data, descricao: l.descricao, valor: Number(l.valor), tipo: l.tipo, documento: l.documento, fornecedor: l.fornecedor, banco: l.banco, categoria: l.categoria })

    // Indexar extratos por dia para permitir D+1 útil
    const dayOf = (d: Date) => d.toISOString().split('T')[0]
    function nextBusinessDayStr(key: string): string {
      const [y, m, d] = key.split('-').map(Number)
      const base = new Date(Date.UTC(y, (m - 1), d))
      let nb = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1))
      const wd = nb.getUTCDay()
      if (wd === 6) nb.setUTCDate(nb.getUTCDate() + 2)
      else if (wd === 0) nb.setUTCDate(nb.getUTCDate() + 1)
      return nb.toISOString().split('T')[0]
    }
    const extratosByDay = new Map<string, typeof extratos>()
    for (const e of extratos) {
      const k = dayOf(e.data)
      if (!extratosByDay.has(k)) extratosByDay.set(k, [])
      extratosByDay.get(k)!.push(e)
    }

    const linhas: LinhaComparativa[] = []
    for (const dataKey of datasOrdenadas) {
      const erpDia = erpLanc.filter(l => l.data.toISOString().startsWith(dataKey)).map(toErpTx)
      const nextKey = nextBusinessDayStr(dataKey)
      const extDia = [
        ...(extratosByDay.get(dataKey) || []),
        ...(extratosByDay.get(nextKey) || []),
      ]
      const { matching } = runDailyMatching(erpDia as any, extDia as any)

      for (const it of matching.itens) {
        linhas.push({
          data: dataKey,
          erp: it.erp ? { id: it.erp.id, data: it.erp.data.toISOString(), descricao: it.erp.descricao, valor: it.erp.valor, tipo: it.erp.tipo, documento: it.erp.documento || null, fornecedor: it.erp.fornecedor || null, categoria: it.erp.categoria || null, centroCusto: null, banco: it.erp.banco || null, upload: undefined } : null,
          extrato: it.extrato ? { id: it.extrato.id, data: it.extrato.data.toISOString(), descricao: it.extrato.descricao, valor: it.extrato.valor, tipo: it.extrato.tipo, identificador: it.extrato.identificador || null, banco: it.extrato.banco || null, saldoApos: null, importacao: undefined } : null,
          status: it.status === 'CONCILIADO' ? 'match' : 'divergente',
        })
      }
      for (const sobra of matching.erpsSobrando) {
        linhas.push({ data: dataKey, erp: { id: sobra.id, data: sobra.data.toISOString(), descricao: sobra.descricao, valor: sobra.valor, tipo: sobra.tipo, documento: sobra.documento || null, fornecedor: sobra.fornecedor || null, categoria: sobra.categoria || null, centroCusto: null, banco: sobra.banco || null, upload: undefined }, extrato: null, status: 'sobra_erp' })
      }
      for (const sobra of matching.extratosSobrando) {
        linhas.push({ data: dataKey, erp: null, extrato: { id: sobra.id, data: sobra.data.toISOString(), descricao: sobra.descricao, valor: sobra.valor, tipo: sobra.tipo, identificador: sobra.identificador || null, banco: sobra.banco || null, saldoApos: null, importacao: undefined }, status: 'sobra_extrato' })
      }
    }

    // Filtros
    const filtradas = linhas.filter(l => {
      const okTipo = tipo ? (l.erp?.tipo === tipo || l.extrato?.tipo === tipo) : true
      const okStatus = statusFiltro ? l.status === statusFiltro : true
      const okSearch = search ? (
        (l.erp?.descricao?.toLowerCase().includes(search) || false) ||
        (l.extrato?.descricao?.toLowerCase().includes(search) || false) ||
        (l.erp?.documento?.toLowerCase().includes(search) || false) ||
        (l.erp?.fornecedor?.toLowerCase().includes(search) || false) ||
        (l.extrato?.identificador?.toLowerCase().includes(search) || false)
      ) : true
      return okTipo && okStatus && okSearch
    })

    const total = filtradas.length
    const paginated = filtradas.slice(skip, skip + limit)

    return NextResponse.json({
      linhas: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro no comparativo" }, { status: 500 })
  }
}
