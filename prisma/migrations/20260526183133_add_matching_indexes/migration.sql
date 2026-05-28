-- CreateIndex
CREATE INDEX "ErpLancamento_valor_data_tipo_idx" ON "ErpLancamento"("valor", "data", "tipo");

-- CreateIndex
CREATE INDEX "ExtratoImportado_valor_data_tipo_idx" ON "ExtratoImportado"("valor", "data", "tipo");
