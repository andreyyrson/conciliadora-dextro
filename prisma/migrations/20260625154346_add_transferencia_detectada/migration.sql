-- AlterTable
ALTER TABLE "ErpLancamento" ADD COLUMN "transferenciaDetectada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExtratoImportado" ADD COLUMN "transferenciaDetectada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExtratoLancamento" ADD COLUMN "transferenciaDetectada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TransferenciaDetectada" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "origemTipo" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "destinoTipo" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferenciaDetectada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferenciaDetectada_empresaId_status_idx" ON "TransferenciaDetectada"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransferenciaDetectada_origemTipo_origemId_destinoTipo_destinoId_key" ON "TransferenciaDetectada"("origemTipo", "origemId", "destinoTipo", "destinoId");
