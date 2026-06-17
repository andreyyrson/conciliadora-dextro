import { prisma } from "@/lib/db"
import { fetchExtratos } from "@/lib/extrato/fetch-unificado"
import type { ErpTransaction, ExtratoTransaction } from "./types"

export interface FetchDataResult {
  erpLancamentos: ErpTransaction[]
  extratoLancamentos: ExtratoTransaction[]
}

export async function fetchConciliationData(
  empresaId: string,
  inicio: Date,
  fim: Date,
  tipo?: "RECEITAS" | "DESPESAS"
): Promise<FetchDataResult> {
  const filtroTipo = tipo === "RECEITAS" ? "CREDITO" : tipo === "DESPESAS" ? "DEBITO" : undefined

  // Buscar uploads da empresa para filtrar ERP lançamentos
  const uploads = await prisma.uploadErp.findMany({
    where: { empresaId },
    select: { id: true }
  })
  const uploadIds = uploads.map(u => u.id)

  // Buscar lançamentos ERP
  const erpRows = await prisma.erpLancamento.findMany({
    where: {
      uploadId: { in: uploadIds },
      data: { gte: inicio, lte: fim }
    },
    orderBy: { data: "asc" }
  })

  let erpLancamentos: ErpTransaction[] = erpRows.map(e => ({
    id: e.id,
    data: e.data,
    descricao: e.descricao,
    valor: Number(e.valor),
    tipo: e.tipo,
    documento: e.documento,
    fornecedor: e.fornecedor,
    banco: e.banco,
    categoria: e.categoria
  }))
  if (filtroTipo) erpLancamentos = erpLancamentos.filter(e => e.tipo === filtroTipo)

  // Buscar extratos de todas as fontes (unificado)
  const extratoLancamentos = await fetchExtratos(
    empresaId,
    inicio,
    fim,
    filtroTipo
  )

  return { erpLancamentos, extratoLancamentos }
}
