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
      select: { id: true }
    })
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

    // Buscar extratos bancários
    const extratoLancamentos = await prisma.extratoLancamento.findMany({
      where: {
        contaId: { in: contaIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar extratos importados
    const extratosImportados = await prisma.extratoImportado.findMany({
      where: {
        importacaoId: { in: importacaoIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Combinar todos em um único array para exportação
    const rows = [
      // ERP
      ...erpLancamentos.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Documento: l.documento || "",
        Fornecedor: l.fornecedor || "",
        Origem: "ERP",
        Identificador: "",
        Banco: l.banco || ""
      })),
      // Extrato Bancário (Open Finance)
      ...extratoLancamentos.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Documento: "",
        Fornecedor: "",
        Origem: "Extrato Bancário",
        Identificador: l.identificador || "",
        Banco: l.banco || ""
      })),
      // Extrato Importado (CSV/OFX)
      ...extratosImportados.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Documento: "",
        Fornecedor: "",
        Origem: "Extrato Importado",
        Identificador: l.identificador || "",
        Banco: l.banco || ""
      }))
    ]

    // Ordenar por data
    rows.sort((a, b) => {
      const parse = (d: string) => {
        const [dd, mm, yyyy] = d.split("/")
        return new Date(`${yyyy}-${mm}-${dd}`).getTime()
      }
      return parse(a.Data) - parse(b.Data)
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lançamentos")

    worksheet["!cols"] = [
      { wch: 12 },   // Data
      { wch: 45 },   // Descricao
      { wch: 10 },   // Tipo
      { wch: 12 },   // Valor
      { wch: 20 },   // Documento
      { wch: 25 },   // Fornecedor
      { wch: 18 },   // Origem
      { wch: 20 },   // Identificador
      { wch: 20 }    // Banco
    ]

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
