import { prisma } from "@/lib/db"
import type { ErpTransaction, ExtratoTransaction } from "./types"

export interface FetchDataResult {
  erpLancamentos: ErpTransaction[]
  extratoLancamentos: ExtratoTransaction[]
}

export async function fetchConciliationData(
  empresaId: string,
  inicio: Date,
  fim: Date
): Promise<FetchDataResult> {
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
  const erpRows = await prisma.erpLancamento.findMany({
    where: {
      uploadId: { in: uploadIds },
      data: { gte: inicio, lte: fim }
    },
    orderBy: { data: "asc" }
  })

  // Buscar lançamentos de extrato bancário (contas conectadas)
  const extratoRows = await prisma.extratoLancamento.findMany({
    where: {
      contaId: { in: contaIds },
      data: { gte: inicio, lte: fim }
    },
    orderBy: { data: "asc" }
  })

  // Buscar lançamentos de extrato importado
  const importadoRows = await prisma.extratoImportado.findMany({
    where: {
      importacaoId: { in: importacaoIds },
      data: { gte: inicio, lte: fim }
    },
    orderBy: { data: "asc" }
  })

  const erpLancamentos: ErpTransaction[] = erpRows.map(e => ({
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

  const extratoLancamentos: ExtratoTransaction[] = [
    ...extratoRows.map(e => ({
      id: e.id,
      origem: "EXTRATO" as const,
      data: e.data,
      descricao: e.descricao,
      valor: Number(e.valor),
      tipo: e.tipo,
      saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
      identificador: e.identificador,
      banco: e.banco
    })),
    ...importadoRows.map(e => ({
      id: e.id,
      origem: "EXTRATO_IMPORTADO" as const,
      data: e.data,
      descricao: e.descricao,
      valor: Number(e.valor),
      tipo: e.tipo,
      saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
      identificador: e.identificador,
      banco: e.banco
    }))
  ]

  return { erpLancamentos, extratoLancamentos }
}
