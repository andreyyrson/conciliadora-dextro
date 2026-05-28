import { NextResponse } from "next/server"
import { pluggy } from "@/lib/pluggy/client"

export async function GET() {
  try {
    const connectors = await pluggy.getConnectors()
    return NextResponse.json({ connectors })
  } catch (error) {
    console.error("Erro ao buscar conectores:", error)
    return NextResponse.json(
      { error: "Erro ao buscar conectores" },
      { status: 500 }
    )
  }
}
