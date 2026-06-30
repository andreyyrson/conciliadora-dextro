-- CreateTable
CREATE TABLE "AprovacaoDia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "dataDia" TIMESTAMP(3) NOT NULL,
    "banco" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "justificativa" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AprovacaoDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AprovacaoDiaLog" (
    "id" TEXT NOT NULL,
    "aprovacaoDiaId" TEXT NOT NULL,
    "deStatus" TEXT,
    "paraStatus" TEXT NOT NULL,
    "justificativa" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AprovacaoDiaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AprovacaoLancamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "dataDia" TIMESTAMP(3) NOT NULL,
    "extratoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "justificativa" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AprovacaoLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AprovacaoDia_empresaId_dataDia_banco_key" ON "AprovacaoDia"("empresaId", "dataDia", "banco");

-- CreateIndex
CREATE INDEX "AprovacaoDia_empresaId_dataDia_idx" ON "AprovacaoDia"("empresaId", "dataDia");

-- CreateIndex
CREATE INDEX "AprovacaoDiaLog_aprovacaoDiaId_idx" ON "AprovacaoDiaLog"("aprovacaoDiaId");

-- CreateIndex
CREATE UNIQUE INDEX "AprovacaoLancamento_empresaId_dataDia_extratoId_key" ON "AprovacaoLancamento"("empresaId", "dataDia", "extratoId");

-- CreateIndex
CREATE INDEX "AprovacaoLancamento_empresaId_dataDia_idx" ON "AprovacaoLancamento"("empresaId", "dataDia");

-- CreateIndex
CREATE INDEX "AprovacaoLancamento_extratoId_idx" ON "AprovacaoLancamento"("extratoId");

-- AddForeignKey
ALTER TABLE "AprovacaoDia" ADD CONSTRAINT "AprovacaoDia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprovacaoDia" ADD CONSTRAINT "AprovacaoDia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprovacaoDiaLog" ADD CONSTRAINT "AprovacaoDiaLog_aprovacaoDiaId_fkey" FOREIGN KEY ("aprovacaoDiaId") REFERENCES "AprovacaoDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprovacaoDiaLog" ADD CONSTRAINT "AprovacaoDiaLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprovacaoLancamento" ADD CONSTRAINT "AprovacaoLancamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprovacaoLancamento" ADD CONSTRAINT "AprovacaoLancamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
