-- AlterTable
ALTER TABLE "ConciliacaoItem" ADD COLUMN     "extratoImportadoId" TEXT;

-- AlterTable
ALTER TABLE "ContaBancaria" ADD COLUMN     "pluggyItemId" TEXT;

-- CreateTable
CREATE TABLE "ImportacaoExtrato" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "periodo" TEXT,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtratoImportado" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "identificador" TEXT,
    "saldoApos" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtratoImportado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportacaoExtrato_empresaId_tipo_idx" ON "ImportacaoExtrato"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "ExtratoImportado_importacaoId_data_idx" ON "ExtratoImportado"("importacaoId", "data");

-- AddForeignKey
ALTER TABLE "ImportacaoExtrato" ADD CONSTRAINT "ImportacaoExtrato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtratoImportado" ADD CONSTRAINT "ExtratoImportado_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoItem" ADD CONSTRAINT "ConciliacaoItem_extratoImportadoId_fkey" FOREIGN KEY ("extratoImportadoId") REFERENCES "ExtratoImportado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
