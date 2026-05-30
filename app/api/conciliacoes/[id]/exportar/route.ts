import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { gerarSugestoes, EntradaConciliacao } from "@/lib/matching/engine"
import * as XLSX from "xlsx"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const decisoesExtras = body.decisoes || null

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

    // Buscar itens da conciliação para obter status final e quem aprovou
    const conciliacaoItens = await prisma.conciliacaoItem.findMany({
      where: { conciliacaoId: id },
      include: {
        erp: true,
        extrato: true,
        extratoImportado: true
      }
    })

    // Criar mapa de decisões por extratoId
    const decisoesMap = new Map()
    const usuarioMap = new Map()

    // Buscar usuário atual para exportação
    let usuarioAtual = null
    if (session?.user?.id) {
      usuarioAtual = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true }
      })
      if (usuarioAtual) {
        usuarioMap.set(usuarioAtual.id, usuarioAtual.name || usuarioAtual.email)
      }
    }

    if (conciliacaoItens.length > 0) {
      // Se já existem itens (conciliação foi confirmada), usar dados do banco
      conciliacaoItens.forEach(item => {
        const extratoId = item.extratoId || item.extratoImportadoId
        if (extratoId) {
          decisoesMap.set(extratoId, {
            status: item.status,
            resolvidoPor: item.resolvidoPor,
            resolvidoEm: item.resolvidoEm
          })
        }
      })

      // Buscar nomes dos usuários que aprovaram
      const userIds = [...new Set(conciliacaoItens.map(i => i.resolvidoPor).filter(Boolean))]
      if (userIds.length > 0) {
        const usuarios = await prisma.user.findMany({
          where: { id: { in: userIds as string[] } },
          select: { id: true, name: true, email: true }
        })
        usuarios.forEach(u => {
          usuarioMap.set(u.id, u.name || u.email)
        })
      }
    }

    // Se foram fornecidas decisões extras (antes de confirmar), sobrescrever
    if (decisoesExtras) {
      Object.entries(decisoesExtras).forEach(([extratoId, d]: [string, any]) => {
        // Se não foi decidido manualmente e tem confiança >= 80%, aprovar automaticamente
        // EXCETO se for AMBIGUO (requer decisão manual)
        let statusFinal = d.status
        let resolvidoPor = null
        let resolvidoEm = null

        const resolvidoManualmente = d.status === "CONFIRMADO_MANUAL" || d.status === "REJEITADO"

        if (!resolvidoManualmente && d.status !== "AMBIGUO" && d.confianca === "HIGH" && d.score >= 80) {
          statusFinal = "AUTO_CONFIRMADO"
          // Não associar a usuário - aprovação automática do sistema
          resolvidoPor = null
          resolvidoEm = null
        } else if (resolvidoManualmente) {
          resolvidoPor = session.user.id
          resolvidoEm = new Date()
        }

        decisoesMap.set(extratoId, {
          status: statusFinal,
          resolvidoPor,
          resolvidoEm
        })
      })
    } else {
      // Se não há decisões extras, aplicar auto-confirmação nos itens originais do matching
      resultado.itens.forEach((item: any) => {
        // Se já é AUTO_CONFIRMADO, não associar a usuário - aprovação automática do sistema
        if (item.status === "AUTO_CONFIRMADO") {
          decisoesMap.set(item.extrato.id, {
            status: "AUTO_CONFIRMADO",
            resolvidoPor: null,
            resolvidoEm: null
          })
        }
        // Se não é AMBIGUO e tem confiança HIGH com score >= 80, aprovar automaticamente
        else if (item.status !== "AMBIGUO" && item.sugestoes[0]?.confianca === "HIGH" && item.sugestoes[0]?.score >= 80) {
          decisoesMap.set(item.extrato.id, {
            status: "AUTO_CONFIRMADO",
            resolvidoPor: null,
            resolvidoEm: null
          })
        }
      })
    }

    // Exportar TODOS os itens
    const rows = resultado.itens.map((item, idx) => {
      const extrato = item.extrato
      const topSugestao = item.sugestoes[0]
      const erpSugerido = topSugestao ? erpEntradas.find(e => e.id === topSugestao.entradaOrigemId) : null
      const decisao = decisoesMap.get(extrato.id)

      // Determinar status de aprovação
      const statusFinal = decisao?.status || item.status
      const statusAprovacao = statusFinal === "AUTO_CONFIRMADO" ? "APROVADO AUTOMATICAMENTE" :
                             statusFinal === "CONFIRMADO_MANUAL" ? "APROVADO MANUALMENTE" :
                             statusFinal === "REJEITADO" ? "REPROVADO" :
                             statusFinal === "AMBIGUO" ? "EM REVISÃO" : "PENDENTE"

      // Preencher quem aprovou e data
      let aprovadoPor = ""
      let dataAprovacao = ""

      if (statusFinal === "AUTO_CONFIRMADO") {
        aprovadoPor = "SISTEMA"
        dataAprovacao = "Auto-confirmado"
      } else if ((statusFinal === "CONFIRMADO_MANUAL" || statusFinal === "REJEITADO") && decisao?.resolvidoPor) {
        aprovadoPor = usuarioMap.get(decisao.resolvidoPor) || decisao.resolvidoPor
        dataAprovacao = decisao?.resolvidoEm ? new Date(decisao.resolvidoEm).toLocaleString("pt-BR") : ""
      }

      return {
        "#": idx + 1,
        "Status Final": statusFinal,
        "Aprovação": statusAprovacao,
        "Aprovado Por": aprovadoPor,
        "Data Aprovação": dataAprovacao,
        // Dados do Extrato
        "Data Extrato": new Date(extrato.data).toLocaleDateString("pt-BR"),
        "Descrição Extrato": extrato.descricao,
        "Valor Extrato": extrato.valor,
        "Tipo Extrato": extrato.tipo,
        "ID Extrato": extrato.identificador || "",
        // Dados do ERP
        "Data ERP": erpSugerido ? new Date(erpSugerido.data).toLocaleDateString("pt-BR") : "",
        "Descrição ERP": erpSugerido?.descricao || "",
        "Valor ERP": erpSugerido?.valor || 0,
        "Tipo ERP": erpSugerido?.tipo || "",
        "Documento ERP": erpSugerido?.documento || "",
        "Fornecedor ERP": erpSugerido?.fornecedor || "",
        "Categoria ERP": erpSugerido?.categoria || "",
        // Matching
        "Score": topSugestao?.score || 0,
        "Confiança": item.confianca,
        "Explicações": topSugestao?.explicacoes.join("; ") || ""
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Conciliação")

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 5 },   // #
      { wch: 20 },  // Status Final
      { wch: 15 },  // Aprovação
      { wch: 25 },  // Aprovado Por
      { wch: 20 },  // Data Aprovação
      { wch: 12 },  // Data Extrato
      { wch: 40 },  // Descrição Extrato
      { wch: 12 },  // Valor Extrato
      { wch: 10 },  // Tipo Extrato
      { wch: 15 },  // ID Extrato
      { wch: 12 },  // Data ERP
      { wch: 40 },  // Descrição ERP
      { wch: 12 },  // Valor ERP
      { wch: 10 },  // Tipo ERP
      { wch: 20 },  // Documento ERP
      { wch: 25 },  // Fornecedor ERP
      { wch: 20 },  // Categoria ERP
      { wch: 8 },   // Score
      { wch: 10 },  // Confiança
      { wch: 50 }   // Explicações
    ]
    worksheet["!cols"] = colWidths

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="conciliacao-${conciliacao.periodo}.xlsx"`
      }
    })
  } catch (error) {
    console.error("Erro ao exportar:", error)
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 })
  }
}
