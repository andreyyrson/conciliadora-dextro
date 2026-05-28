import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { polp } from "@/lib/polp/client"

export async function GET(
  req: Request,
  { params }: { params: { consentId: string } }
) {
  try {
    const { consentId } = params

    // Verificar status no POLP
    const consentData = await polp.getConsentStatus(consentId)

    return NextResponse.json({
      status: consentData.status,
      accounts: consentData.accounts
    })
  } catch (error) {
    console.error("Erro ao verificar status:", error)
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    )
  }
}
