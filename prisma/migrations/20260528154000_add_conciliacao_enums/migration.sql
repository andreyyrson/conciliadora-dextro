-- CreateEnum
CREATE TYPE "ConciliacaoStatus" AS ENUM ('PENDENTE_REVISAO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "ConciliacaoItemStatus" AS ENUM ('AUTO_CONFIRMADO', 'CONFIRMADO_MANUAL', 'REJEITADO', 'SEM_MATCH');

-- CreateEnum
CREATE TYPE "ConfiancaMatch" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable: Remover default primeiro
ALTER TABLE "Conciliacao" ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable: Converter tipo
ALTER TABLE "Conciliacao" ALTER COLUMN "status" TYPE "ConciliacaoStatus" USING ("status"::text::"ConciliacaoStatus");

-- AlterTable: Adicionar default de volta
ALTER TABLE "Conciliacao" ALTER COLUMN "status" SET DEFAULT 'PENDENTE_REVISAO'::"ConciliacaoStatus";

-- AlterTable: Converter status do ConciliacaoItem
ALTER TABLE "ConciliacaoItem" ALTER COLUMN "status" TYPE "ConciliacaoItemStatus" USING ("status"::text::"ConciliacaoItemStatus");

-- AlterTable: Converter confiancaMatch (pode ser null, então precisa de cuidado)
ALTER TABLE "ConciliacaoItem" ALTER COLUMN "confiancaMatch" TYPE "ConfiancaMatch" USING CASE WHEN "confiancaMatch" IS NULL THEN NULL ELSE "confiancaMatch"::text::"ConfiancaMatch" END;
