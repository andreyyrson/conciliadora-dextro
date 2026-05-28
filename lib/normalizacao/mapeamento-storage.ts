/**
 * Armazenamento e recuperação de mapeamentos de colunas por empresa
 * Usa o Prisma para persistir configurações de upload
 */

import { prisma } from "@/lib/db"
import { MapeamentoColunas } from "./detector-colunas"

export interface MapeamentoEmpresa {
  id: string
  empresaId: string
  tipoArquivo: "ERP" | "EXTRATO"
  mapeamento: MapeamentoColunas
  nomeArquivoExemplo: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Busca o mapeamento salvo para uma empresa e tipo de arquivo
 */
export async function buscarMapeamento(
  empresaId: string,
  tipoArquivo: "ERP" | "EXTRATO"
): Promise<MapeamentoColunas | null> {
  // Verificar se existe mapeamento salvo na tabela de configurações
  // Como não temos uma tabela dedicada, vamos usar uma abordagem simples:
  // Buscar o último upload da empresa para inferir o mapeamento

  if (tipoArquivo === "ERP") {
    const ultimoUpload = await prisma.uploadErp.findFirst({
      where: { empresaId },
      orderBy: { createdAt: "desc" }
    })

    if (ultimoUpload && (ultimoUpload as any).mapeamentoColunas) {
      return (ultimoUpload as any).mapeamentoColunas as MapeamentoColunas
    }
  } else {
    const ultimaImportacao = await prisma.importacaoExtrato.findFirst({
      where: { empresaId },
      orderBy: { createdAt: "desc" }
    })

    if (ultimaImportacao && (ultimaImportacao as any).mapeamentoColunas) {
      return (ultimaImportacao as any).mapeamentoColunas as MapeamentoColunas
    }
  }

  return null
}

/**
 * Salva o mapeamento para uma empresa
 * Atualiza o último upload/importação com o mapeamento
 */
export async function salvarMapeamento(
  empresaId: string,
  tipoArquivo: "ERP" | "EXTRATO",
  mapeamento: MapeamentoColunas,
  referenciaId: string  // uploadId ou importacaoId
): Promise<void> {
  // Armazenar como JSON no registro do upload/importação
  // Usamos raw query para atualizar o campo JSONB

  if (tipoArquivo === "ERP") {
    await prisma.$executeRaw`
      UPDATE "UploadErp"
      SET "mapeamentoColunas" = ${JSON.stringify(mapeamento)}::jsonb
      WHERE id = ${referenciaId}
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "ImportacaoExtrato"
      SET "mapeamentoColunas" = ${JSON.stringify(mapeamento)}::jsonb
      WHERE id = ${referenciaId}
    `
  }
}

/**
 * Aplica mapeamento salvo (se existir) ou retorna mapeamento automático
 */
export async function obterMapeamentoComFallback(
  empresaId: string,
  tipoArquivo: "ERP" | "EXTRATO",
  mapeamentoAutomatico: MapeamentoColunas
): Promise<MapeamentoColunas> {
  const mapeamentoSalvo = await buscarMapeamento(empresaId, tipoArquivo)

  if (mapeamentoSalvo) {
    // Mesclar: campos não mapeados automaticamente usam o salvo
    const resultado: MapeamentoColunas = { ...mapeamentoAutomatico }

    for (const [campo, coluna] of Object.entries(mapeamentoSalvo)) {
      if (!resultado[campo] && coluna) {
        resultado[campo] = coluna
      }
    }

    return resultado
  }

  return mapeamentoAutomatico
}
