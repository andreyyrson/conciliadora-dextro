import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"
import { runDailyMatching } from "@/lib/conciliacao"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
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

    // Buscar uploads da empresa
    const uploads = await prisma.uploadErp.findMany({
      where: { empresaId },
      select: { id: true }
    })
    const uploadIds = uploads.map(u => u.id)

    // Buscar contas bancárias
    const contas = await prisma.contaBancaria.findMany({
      where: { empresaId },
      select: { id: true, banco: true }
    })
    const contaMap = new Map(contas.map(c => [c.id, c.banco || ""]))
    const contaIds = contas.map(c => c.id)

    // Buscar importações
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

    // Buscar extratos bancários (Open Finance)
    const extratoLancamentos = await prisma.extratoLancamento.findMany({
      where: {
        contaId: { in: contaIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar extratos importados (CSV/OFX)
    const extratosImportados = await prisma.extratoImportado.findMany({
      where: {
        importacaoId: { in: importacaoIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar aprovações por dia no período
    const aprovacoesDia = await (prisma as any).aprovacaoDia.findMany({
      where: { empresaId, dataDia: { gte: inicio, lte: fim } }
    })
    const mapaDiaStatus: Record<string, string> = {}
    for (const a of aprovacoesDia as any[]) {
      const key = (a.dataDia as Date).toISOString().split("T")[0]
      mapaDiaStatus[key] = a.status
    }

    // Buscar aprovações por lançamento no período
    const aprovacoesLancamento = await (prisma as any).aprovacaoLancamento.findMany({
      where: { empresaId, dataDia: { gte: inicio, lte: fim } }
    })
    const mapaLancamentoStatus: Record<string, string> = {}
    for (const a of aprovacoesLancamento as any[]) {
      mapaLancamentoStatus[a.extratoId] = a.status
    }

    // === ABA 1: Extrato Bancário ===
    const extratoRows = [
      ...extratoLancamentos.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || contaMap.get(l.contaId) || ""
      })),
      ...extratosImportados.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || ""
      }))
    ]
    extratoRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // === ABA 2: ERP ===
    const erpRows = erpLancamentos.map(l => ({
      Data: new Date(l.data).toLocaleDateString("pt-BR"),
      Descricao: l.descricao,
      Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
      Valor: Number(l.valor),
      Documento: l.documento || "",
      Fornecedor: l.fornecedor || "",
      Banco: l.banco || "",
      Categoria: l.categoria || ""
    }))
    erpRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // === ABA 3: Resumo Diário ===
    const dias = new Set<string>()
    erpLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratoLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratosImportados.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))

    const diasOrdenados = Array.from(dias).sort()

    const resumoRows = diasOrdenados.map(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const entradasErp = erpDia.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasErp = erpDia.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)
      const entradasExtrato = [...extBancarioDia, ...extImportadoDia].filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasExtrato = [...extBancarioDia, ...extImportadoDia].filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)

      return {
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        "Entradas Extrato": entradasExtrato,
        "Saídas Extrato": saidasExtrato,
        "Saldo Extrato": entradasExtrato - saidasExtrato,
        "Entradas ERP": entradasErp,
        "Saídas ERP": saidasErp,
        "Saldo ERP": entradasErp - saidasErp,
        "Diferença Saldo": (entradasExtrato - saidasExtrato) - (entradasErp - saidasErp),
        "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
      }
    })

    // === ABA 4: Não Conciliados (extratos sem correspondência no ERP) ===
    const naoConciliadosRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const erpTxs = erpDia.map(e => ({
        id: e.id,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        documento: e.documento,
        fornecedor: e.fornecedor,
        banco: e.banco,
        categoria: e.categoria,
      }))

      const extTxs = [
        ...extBancarioDia.map(e => ({
          id: e.id,
          origem: "EXTRATO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco || contaMap.get(e.contaId) || null,
        })),
        ...extImportadoDia.map(e => ({
          id: e.id,
          origem: "EXTRATO_IMPORTADO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco,
        })),
      ]

      const { matching } = runDailyMatching(erpTxs, extTxs)

      return matching.extratosSobrando.map(ex => ({
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        Descricao: ex.descricao,
        Valor: ex.valor,
        Tipo: ex.tipo === "CREDITO" ? "Entrada" : "Saída",
        Origem: ex.origem === "EXTRATO" ? "Extrato Bancário" : "Extrato Importado",
        Banco: ex.banco || "",
        Identificador: ex.identificador || "",
        "Status Lançamento": mapaLancamentoStatus[ex.id] || "AGUARDANDO"
      }))
    })

    // === ABA 5: ERP Sobrando (ERP sem correspondência no extrato) ===
    const erpSobrandoRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const erpTxs = erpDia.map(e => ({
        id: e.id,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        documento: e.documento,
        fornecedor: e.fornecedor,
        banco: e.banco,
        categoria: e.categoria,
      }))

      const extTxs = [
        ...extBancarioDia.map(e => ({
          id: e.id,
          origem: "EXTRATO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco || contaMap.get(e.contaId) || null,
        })),
        ...extImportadoDia.map(e => ({
          id: e.id,
          origem: "EXTRATO_IMPORTADO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco,
        })),
      ]

      const { matching } = runDailyMatching(erpTxs, extTxs)

      return matching.erpsSobrando.map(erp => ({
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        Descricao: erp.descricao,
        Valor: erp.valor,
        Tipo: erp.tipo === "CREDITO" ? "Entrada" : "Saída",
        Documento: erp.documento || "",
        Fornecedor: erp.fornecedor || "",
        Banco: erp.banco || "",
        Categoria: erp.categoria || "",
      }))
    })

    const workbook = XLSX.utils.book_new()

    // Aba Extrato
    if (extratoRows.length > 0) {
      const wsExtrato = XLSX.utils.json_to_sheet(extratoRows)
      wsExtrato["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 25 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsExtrato, "Extrato Bancário")
    }

    // Aba ERP
    if (erpRows.length > 0) {
      const wsErp = XLSX.utils.json_to_sheet(erpRows)
      wsErp["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsErp, "ERP (Relatório)")
    }

    // Aba Resumo Diário
    if (resumoRows.length > 0) {
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows)
      wsResumo["!cols"] = [
        { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo Diário")
    }

    // Aba Não Conciliados
    if (naoConciliadosRows.length > 0) {
      const wsNao = XLSX.utils.json_to_sheet(naoConciliadosRows)
      wsNao["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsNao, "Não Conciliados")
    }

    // Aba ERP Sobrando
    if (erpSobrandoRows.length > 0) {
      const wsErpSob = XLSX.utils.json_to_sheet(erpSobrandoRows)
      wsErpSob["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsErpSob, "ERP Sobrando")
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="analise-dia-${dataInicio}-${dataFim}.xlsx"`
      }
    })
  } catch (error) {
    console.error("Erro ao exportar análise por dia:", error)
    return NextResponse.json(
      { error: "Erro ao exportar análise por dia" },
      { status: 500 }
    )
  }
}

function parseData(d: string): number {
  const [dd, mm, yyyy] = d.split("/")
  return new Date(`${yyyy}-${mm}-${dd}`).getTime()
}
