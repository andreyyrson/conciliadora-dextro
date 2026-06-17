import { prisma } from "@/lib/db"
import type { ExtratoTransaction } from "@/lib/conciliacao/types"

/**
 * Busca extratos de todas as fontes (ExtratoLancamento + ExtratoImportado)
 * e retorna um array unificado no formato ExtratoTransaction.
 *
 * @deprecated ExtratoLancamento será unificado com ExtratoImportado futuramente.
 *             Por enquanto, esta função consulta ambas as tabelas.
 */
export async function fetchExtratos(
  empresaId: string,
  inicio: Date,
  fim: Date,
  tipo?: "CREDITO" | "DEBITO"
): Promise<ExtratoTransaction[]> {
  const contas = await prisma.contaBancaria.findMany({
    where: { empresaId },
    select: { id: true }
  })
  const contaIds = contas.map(c => c.id)

  const importacoes = await prisma.importacaoExtrato.findMany({
    where: { empresaId },
    select: { id: true }
  })
  const importacaoIds = importacoes.map(i => i.id)

  const [extratoRows, importadoRows] = await Promise.all([
    // Extrato de contas cadastradas (legado / Open Finance teórico)
    prisma.extratoLancamento.findMany({
      where: {
        contaId: { in: contaIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    }),
    // Extrato de uploads CSV/OFX (fluxo principal atual)
    prisma.extratoImportado.findMany({
      where: {
        importacaoId: { in: importacaoIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })
  ])

  let extratos: ExtratoTransaction[] = [
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

  if (tipo) extratos = extratos.filter(e => e.tipo === tipo)

  return extratos
}
