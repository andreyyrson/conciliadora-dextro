import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { polp } from "@/lib/polp/client"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const consentId = searchParams.get("consentId")
    const status = searchParams.get("status")

    if (!consentId) {
      return NextResponse.json(
        { error: "consentId é obrigatório" },
        { status: 400 }
      )
    }

    // Encontrar a conta temporária pelo consentId
    const conta = await prisma.contaBancaria.findFirst({
      where: { polpIntegrationId: consentId }
    })

    if (!conta) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      )
    }

    if (status === "approved") {
      // Buscar status do consentimento no POLP
      const consentData = await polp.getConsentStatus(consentId)

      if (consentData.status === "approved" && consentData.accounts) {
        // Atualizar a conta com os dados retornados
        const account = consentData.accounts[0]
        await prisma.contaBancaria.update({
          where: { id: conta.id },
          data: {
            banco: account.bankName,
            agencia: account.branch,
            conta: account.accountNumber,
            polpAccountId: account.id,
            ativa: true
          }
        })
      }
    } else {
      // Rejeitado ou expirado - marcar como inativa
      await prisma.contaBancaria.update({
        where: { id: conta.id },
        data: {
          banco: "Consentimento rejeitado",
          agencia: null,
          conta: consentId,
          ativa: false
        }
      })
    }

    // Redirecionar para a página de contas
    return NextResponse.redirect(new URL("/contas", req.url))
  } catch (error) {
    console.error("Erro no callback POLP:", error)
    return NextResponse.redirect(new URL("/contas?error=callback", req.url))
  }
}
