-- AlterTable
ALTER TABLE "ErpLancamento" ADD COLUMN     "banco" TEXT,
ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "fornecedor" TEXT;

-- CreateIndex
CREATE INDEX "ErpLancamento_fornecedor_idx" ON "ErpLancamento"("fornecedor");

-- CreateIndex
CREATE INDEX "ErpLancamento_categoria_idx" ON "ErpLancamento"("categoria");
