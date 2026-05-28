-- CreateEnum
CREATE TYPE "ConciliacaoStatus" AS ENUM ('PENDENTE_REVISAO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "ConciliacaoItemStatus" AS ENUM ('AUTO_CONFIRMADO', 'CONFIRMADO_MANUAL', 'REJEITADO', 'SEM_MATCH');

-- CreateEnum
CREATE TYPE "ConfiancaMatch" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Conciliacao" ALTER COLUMN "status" TYPE "ConciliacaoStatus" USING ("status"::text::"ConciliacaoStatus");

-- AlterTable
ALTER TABLE "ConciliacaoItem" ALTER COLUMN "status" TYPE "ConciliacaoItemStatus" USING ("status"::text::"ConciliacaoItemStatus");

-- AlterTable
ALTER TABLE "ConciliacaoItem" ALTER COLUMN "confiancaMatch" TYPE "ConfiancaMatch" USING ("confiancaMatch"::text::"ConfiancaMatch");
