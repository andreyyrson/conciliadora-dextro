import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { LinhaComparativa, ErpLancamento, ExtratoLancamento } from "@/app/(app)/conciliacoes/comparativo/use-comparativo"

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
    const contas = await prisma.contaBancaria.findMany({ where: { empresaId }, select: { id: true } })
    const importacoes = await prisma.importacaoExtrato.findMany({ where: { empresaId }, select: { id: true } })

    const uploadIds = uploads.map(u => u.id)
    const contaIds = contas.map(c => c.id)
    const importacaoIds = importacoes.map(i => i.id)

    const [erpLanc, extLanc, impLanc] = await Promise.all([
      prisma.erpLancamento.findMany({ where: { uploadId: { in: uploadIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoLancamento.findMany({ where: { contaId: { in: contaIds }, data: { gte: inicio, lte: fim } } }),
      prisma.extratoImportado.findMany({ where: { importacaoId: { in: importacaoIds }, data: { gte: inicio, lte: fim } } }),
    ])

    // Juntar extratos abertos e importados numa só lista normalizada
    const extsAll = [
      ...extLanc.map(l => ({ id: l.id, data: l.data.toISOString(), descricao: l.descricao, valor: Number(l.valor), tipo: l.tipo, identificador: l.identificador || null, banco: l.banco || null, saldoApos: l.saldoApos != null ? Number(l.saldoApos) : null })),
      ...impLanc.map(l => ({ id: l.id, data: l.data.toISOString(), descricao: l.descricao, valor: Number(l.valor), tipo: l.tipo, identificador: l.identificador || null, banco: l.banco || null, saldoApos: l.saldoApos != null ? Number(l.saldoApos) : null })),
    ] as unknown as ExtratoLancamento[]

    const erpsAll = erpLanc.map(l => ({ id: l.id, data: l.data.toISOString(), descricao: l.descricao, valor: Number(l.valor), tipo: l.tipo, documento: l.documento || null, fornecedor: l.fornecedor || null, categoria: l.categoria || null, centroCusto: null, banco: l.banco || null, upload: undefined })) as unknown as ErpLancamento[]

    const mapa = new Map<string, { erps: ErpLancamento[]; exts: ExtratoLancamento[] }>()
    for (const e of erpsAll) {
      const key = (e.data as string).split('T')[0]
      if (!mapa.has(key)) mapa.set(key, { erps: [], exts: [] })
      mapa.get(key)!.erps.push(e)
    }
    for (const e of extsAll) {
      const key = (e.data as string).split('T')[0]
      if (!mapa.has(key)) mapa.set(key, { erps: [], exts: [] })
      mapa.get(key)!.exts.push(e)
    }

    const linhas: LinhaComparativa[] = []
    const datasOrdenadas = Array.from(mapa.keys()).sort()
    for (const dataKey of datasOrdenadas) {
      const { erps, exts } = mapa.get(dataKey)!
      const maxLen = Math.max(erps.length, exts.length)
      for (let i = 0; i < maxLen; i++) {
        const erpItem = erps[i] || null
        const extItem = exts[i] || null
        let status: LinhaComparativa['status'] = 'match'
        if (!erpItem) status = 'sobra_extrato'
        else if (!extItem) status = 'sobra_erp'
        else if (Math.abs((erpItem as any).valor - (extItem as any).valor) > 0.01 || (erpItem as any).tipo !== (extItem as any).tipo) status = 'divergente'
        linhas.push({ data: dataKey, erp: erpItem as any, extrato: extItem as any, status })
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

    return NextResponse.json({ linhas: filtradas }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro no comparativo" }, { status: 500 })
  }
}
