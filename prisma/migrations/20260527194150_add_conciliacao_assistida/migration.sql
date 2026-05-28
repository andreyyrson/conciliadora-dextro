-- AlterTable
ALTER TABLE "Conciliacao" ADD COLUMN     "contaId" TEXT,
ADD COLUMN     "importacaoId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDENTE_REVISAO';

-- AlterTable
ALTER TABLE "ConciliacaoItem" ADD COLUMN     "candidatos" JSONB,
ADD COLUMN     "confiancaMatch" TEXT,
ADD COLUMN     "explicacoes" JSONB,
ADD COLUMN     "hashConciliacao" TEXT,
ADD COLUMN     "scoreDetalhado" JSONB;
