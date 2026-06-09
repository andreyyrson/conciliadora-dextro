import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

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
        "Diferença Saldo": (entradasExtrato - saidasExtrato) - (entradasErp - saidasErp)
      }
    })

    // === ABA 4: Diferença por Banco ===
    const bancos = new Set<string>()
    erpLancamentos.forEach(l => bancos.add(l.banco || "Não Informado"))
    extratoLancamentos.forEach(l => bancos.add(contaMap.get(l.contaId) || l.banco || "Não Informado"))
    extratosImportados.forEach(l => bancos.add(l.banco || "Não Informado"))

    const bancosOrdenados = Array.from(bancos).sort()

    const diferencaBancoRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      return bancosOrdenados.map(banco => {
        const erpBanco = erpDia.filter(l => (l.banco || "Não Informado") === banco)
        const extBancarioBanco = extBancarioDia.filter(l => (contaMap.get(l.contaId) || l.banco || "Não Informado") === banco)
        const extImportadoBanco = extImportadoDia.filter(l => (l.banco || "Não Informado") === banco)

        const entradasErp = erpBanco.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
        const saidasErp = erpBanco.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)
        const entradasExtrato = [...extBancarioBanco, ...extImportadoBanco].filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
        const saidasExtrato = [...extBancarioBanco, ...extImportadoBanco].filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)

        const saldoErp = entradasErp - saidasErp
        const saldoExtrato = entradasExtrato - saidasExtrato

        // Só incluir linha se houver algum dado para este banco neste dia
        if (erpBanco.length === 0 && extBancarioBanco.length === 0 && extImportadoBanco.length === 0) return null

        return {
          Data: new Date(dataKey).toLocaleDateString("pt-BR"),
          Banco: banco,
          "Entradas ERP": entradasErp,
          "Saídas ERP": saidasErp,
          "Saldo ERP": saldoErp,
          "Entradas Extrato": entradasExtrato,
          "Saídas Extrato": saidasExtrato,
          "Saldo Extrato": saldoExtrato,
          "Diferença Saldo": saldoExtrato - saldoErp
        }
      }).filter(Boolean) as Record<string, string | number>[]
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
        { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo Diário")
    }

    // Aba Diferença por Banco
    if (diferencaBancoRows.length > 0) {
      const wsDif = XLSX.utils.json_to_sheet(diferencaBancoRows)
      wsDif["!cols"] = [
        { wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsDif, "Diferença por Banco")
    }

    // Se não houver nenhum dado no período, retornar erro amigável
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado encontrado no período selecionado." },
        { status: 404 }
      )
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
