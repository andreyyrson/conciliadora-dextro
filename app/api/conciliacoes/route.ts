import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { uploadId, contaId, importacaoId, empresaId } = body

    if (!uploadId) {
      return NextResponse.json(
        { error: "uploadId é obrigatório" },
        { status: 400 }
      )
    }

    if (!contaId && !importacaoId) {
      return NextResponse.json(
        { error: "contaId ou importacaoId é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar upload e verificar permissões
    const upload = await prisma.uploadErp.findUnique({
      where: { id: uploadId },
      include: { empresa: true }
    })

    if (!upload || upload.empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Upload não encontrado ou sem permissão" },
        { status: 403 }
      )
    }

    let extratoLancamentos: any[] = []

    if (contaId) {
      // Buscar conta e verificar permissões
      const conta = await prisma.contaBancaria.findUnique({
        where: { id: contaId },
        include: { empresa: true }
      })

      if (!conta || conta.empresa.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Conta não encontrada ou sem permissão" },
          { status: 403 }
        )
      }

      // Buscar lançamentos do extrato bancário (ContaBancaria)
      extratoLancamentos = await prisma.extratoLancamento.findMany({
        where: { contaId }
      })
    } else if (importacaoId) {
      // Buscar importação e verificar permissões
      const importacao = await prisma.importacaoExtrato.findUnique({
        where: { id: importacaoId },
        include: { empresa: true }
      })

      if (!importacao || importacao.empresa.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Importação não encontrada ou sem permissão" },
          { status: 403 }
        )
      }

      // Buscar lançamentos do extrato importado (CSV/OFX)
      extratoLancamentos = await prisma.extratoImportado.findMany({
        where: { importacaoId }
      })
    }

    // Buscar lançamentos do ERP
    const erpLancamentos = await prisma.erpLancamento.findMany({
      where: { uploadId }
    })

    // Calcular totais líquidos (CREDITO - DEBITO)
    const totalErp = erpLancamentos.reduce(
      (sum: number, l: any) => sum + (l.tipo === "CREDITO" ? 1 : -1) * Number(l.valor),
      0
    )
    const totalExtrato = extratoLancamentos.reduce(
      (sum: number, l: any) => sum + (l.tipo === "CREDITO" ? 1 : -1) * Number(l.valor),
      0
    )

    // Criar conciliação com status PENDENTE_REVISAO
    const conciliacao = await prisma.conciliacao.create({
      data: {
        empresaId: upload.empresaId,
        userId: session.user.id,
        uploadId,
        contaId: contaId || null,
        importacaoId: importacaoId || null,
        periodo: upload.periodo,
        status: "PENDENTE_REVISAO",
        totalErp,
        totalExtrato,
        qtdConciliados: 0,
        qtdDivergentes: 0,
        qtdFaltandoErp: 0,
        qtdFaltandoBanco: 0
      }
    })

    return NextResponse.json({
      success: true,
      conciliacaoId: conciliacao.id,
      status: "PENDENTE_REVISAO"
    })
  } catch (error) {
    console.error("Erro ao criar conciliação:", error)
    return NextResponse.json(
      { error: "Erro ao criar conciliação" },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")

    if (!empresaId) {
      return NextResponse.json(
        { error: "empresaId é obrigatório" },
        { status: 400 }
      )
    }

    // Verificar se a empresa pertence ao usuário
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    })

    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const conciliacoes = await prisma.conciliacao.findMany({
      where: { empresaId },
      include: {
        upload: true
      },
      orderBy: { criadoEm: "desc" }
    })

    return NextResponse.json({ conciliacoes })
  } catch (error) {
    console.error("Erro ao buscar conciliações:", error)
    return NextResponse.json(
      { error: "Erro ao buscar conciliações" },
      { status: 500 }
    )
  }
}
