import { NextResponse } from "next/server"
import { pluggy } from "@/lib/pluggy/client"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params

    // Verificar status do item no Pluggy
    const item = await pluggy.getItem(integrationId)

    return NextResponse.json({
      status: item.status
    })
  } catch (error) {
    console.error("Erro ao verificar status do item:", error)
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    )
  }
}
