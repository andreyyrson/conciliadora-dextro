import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fetchConciliationData } from "@/lib/conciliacao"
import { detectTransferencias, diagnosticarTransferencias } from "@/lib/conciliacao/transferencias"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const inicioParam = searchParams.get("dataInicio")
    const fimParam = searchParams.get("dataFim")

    if (!empresaId || !inicioParam || !fimParam) {
      return NextResponse.json({ error: "empresaId, dataInicio e dataFim são obrigatórios" }, { status: 400 })
    }

    const inicio = new Date(inicioParam)
    const fim = new Date(fimParam)
    fim.setHours(23, 59, 59, 999)

    const { erpLancamentos, extratoLancamentos } = await fetchConciliationData(empresaId, inicio, fim)
    const transferencias = detectTransferencias(erpLancamentos, extratoLancamentos)
    const diagnostico = diagnosticarTransferencias(erpLancamentos, extratoLancamentos)

    return NextResponse.json({ transferencias, diagnostico }, { status: 200 })
  } catch (error) {
    console.error("Erro ao detectar transferências:", error)
    return NextResponse.json({ error: "Erro ao detectar transferências" }, { status: 500 })
  }
}
