-- Adiciona dimensão de banco às aprovações de dia
ALTER TABLE "AprovacaoDia" ADD COLUMN "banco" TEXT NOT NULL DEFAULT '';

-- Substitui a unicidade [empresaId, dataDia] por [empresaId, dataDia, banco]
DROP INDEX IF EXISTS "AprovacaoDia_empresaId_dataDia_key";

CREATE UNIQUE INDEX "AprovacaoDia_empresaId_dataDia_banco_key" ON "AprovacaoDia"("empresaId", "dataDia", "banco");
