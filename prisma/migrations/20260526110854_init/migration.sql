-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaBancaria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "agencia" TEXT,
    "conta" TEXT NOT NULL,
    "polpAccountId" TEXT,
    "polpIntegrationId" TEXT,
    "ultimaSincAt" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtratoLancamento" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "identificador" TEXT,
    "saldoApos" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtratoLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadErp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "totalLinhas" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadErp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpLancamento" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "documento" TEXT,
    "centroCusto" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErpLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conciliacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "totalExtrato" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalErp" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "qtdConciliados" INTEGER NOT NULL DEFAULT 0,
    "qtdDivergentes" INTEGER NOT NULL DEFAULT 0,
    "qtdFaltandoErp" INTEGER NOT NULL DEFAULT 0,
    "qtdFaltandoBanco" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conciliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciliacaoItem" (
    "id" TEXT NOT NULL,
    "conciliacaoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "extratoId" TEXT,
    "erpId" TEXT,
    "diferencaValor" DECIMAL(15,2),
    "scoreMatch" DOUBLE PRECISION,
    "observacao" TEXT,
    "resolvidoManualmente" BOOLEAN NOT NULL DEFAULT false,
    "resolvidoPor" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciliacaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ExtratoLancamento_contaId_data_idx" ON "ExtratoLancamento"("contaId", "data");

-- CreateIndex
CREATE INDEX "ErpLancamento_uploadId_data_idx" ON "ErpLancamento"("uploadId", "data");

-- CreateIndex
CREATE INDEX "ConciliacaoItem_conciliacaoId_status_idx" ON "ConciliacaoItem"("conciliacaoId", "status");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaBancaria" ADD CONSTRAINT "ContaBancaria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtratoLancamento" ADD CONSTRAINT "ExtratoLancamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadErp" ADD CONSTRAINT "UploadErp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpLancamento" ADD CONSTRAINT "ErpLancamento_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadErp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conciliacao" ADD CONSTRAINT "Conciliacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conciliacao" ADD CONSTRAINT "Conciliacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conciliacao" ADD CONSTRAINT "Conciliacao_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadErp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoItem" ADD CONSTRAINT "ConciliacaoItem_conciliacaoId_fkey" FOREIGN KEY ("conciliacaoId") REFERENCES "Conciliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoItem" ADD CONSTRAINT "ConciliacaoItem_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "ExtratoLancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoItem" ADD CONSTRAINT "ConciliacaoItem_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "ErpLancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
