import { NextResponse } from "next/server"
import { polp } from "@/lib/polp/client"

export async function GET() {
  try {
    const integrations = await polp.getIntegrations()
    return NextResponse.json({ 
      success: true, 
      data: integrations 
    })
  } catch (error) {
    console.error("Erro ao testar POLP:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      },
      { status: 500 }
    )
  }
}
