import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { gerarSugestoes, EntradaConciliacao } from "@/lib/matching/engine"
import * as XLSX from "xlsx"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Buscar conciliação
    const conciliacao = await prisma.conciliacao.findUnique({
      where: { id }
    })

    if (!conciliacao || conciliacao.userId !== session.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar lançamentos
    const erpRows = await prisma.erpLancamento.findMany({
      where: { uploadId: conciliacao.uploadId }
    })

    let extratoRows: any[] = []
    if (conciliacao.contaId) {
      extratoRows = await prisma.extratoLancamento.findMany({
        where: { contaId: conciliacao.contaId }
      })
    } else if (conciliacao.importacaoId) {
      extratoRows = await prisma.extratoImportado.findMany({
        where: { importacaoId: conciliacao.importacaoId }
      })
    }

    // Converter para EntradaConciliacao
    const erpEntradas: EntradaConciliacao[] = erpRows.map((l: any) => ({
      id: l.id,
      origem: "ERP",
      data: new Date(l.data),
      valor: Number(l.valor),
      tipo: (l.tipo === "CREDITO" ? "CREDITO" : "DEBITO") as "CREDITO" | "DEBITO",
      descricao: l.descricao || "",
      documento: l.documento || null,
      fornecedor: l.fornecedor || null,
      categoria: l.categoria || null,
      identificador: null
    }))

    const extratoEntradas: EntradaConciliacao[] = extratoRows.map((l: any) => ({
      id: l.id,
      origem: "EXTRATO",
      data: new Date(l.data),
      valor: Number(l.valor),
      tipo: (l.tipo === "CREDITO" ? "CREDITO" : "DEBITO") as "CREDITO" | "DEBITO",
      descricao: l.descricao || "",
      documento: null,
      fornecedor: null,
      categoria: null,
      identificador: l.identificador || null
    }))

    // Gerar sugestões
    const resultado = gerarSugestoes(erpEntradas, extratoEntradas)

    // Filtrar apenas inconsistências (não auto-confirmados)
    const inconsistencias = resultado.itens.filter(
      i => i.status !== "AUTO_CONFIRMADO"
    )

    // Criar planilha
    const rows = inconsistencias.map((item, idx) => {
      const extrato = item.extrato
      const topSugestao = item.sugestoes[0]
      const erpSugerido = topSugestao ? erpEntradas.find(e => e.id === topSugestao.entradaOrigemId) : null

      return {
        "#": idx + 1,
        "Data Extrato": new Date(extrato.data).toLocaleDateString("pt-BR"),
        "Descrição Extrato": extrato.descricao,
        "Valor Extrato": extrato.valor,
        "Tipo Extrato": extrato.tipo,
        "Status": item.status,
        "Confiança": item.confianca,
        "Score": topSugestao?.score || 0,
        "Explicações": topSugestao?.explicacoes.join("; ") || "",
        "ERP Sugerido ID": erpSugerido?.id || "",
        "ERP Sugerido Descrição": erpSugerido?.descricao || "",
        "ERP Sugerido Valor": erpSugerido?.valor || 0,
        "ERP Sugerido Documento": erpSugerido?.documento || ""
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inconsistências")

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 5 },   // #
      { wch: 12 },  // Data Extrato
      { wch: 40 },  // Descrição Extrato
      { wch: 12 },  // Valor Extrato
      { wch: 10 },  // Tipo Extrato
      { wch: 15 },  // Status
      { wch: 10 },  // Confiança
      { wch: 8 },   // Score
      { wch: 50 },  // Explicações
      { wch: 30 },  // ERP Sugerido ID
      { wch: 40 },  // ERP Sugerido Descrição
      { wch: 12 },  // ERP Sugerido Valor
      { wch: 20 }   // ERP Sugerido Documento
    ]
    worksheet["!cols"] = colWidths

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inconsistencias-${conciliacao.periodo}.xlsx"`
      }
    })
  } catch (error) {
    console.error("Erro ao exportar:", error)
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 })
  }
}
