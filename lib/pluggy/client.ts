// ── Cliente Pluggy ───────────────────────────────────

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET
const PLUGGY_BASE_URL = process.env.PLUGGY_BASE_URL || "https://api.pluggy.ai"

let apiKey: string | null = null

async function getApiKey(): Promise<string> {
  if (apiKey) return apiKey

  console.log("Requesting API Key from:", `${PLUGGY_BASE_URL}/auth`)

  const response = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    })
  })

  console.log("Auth response status:", response.status)
  const responseText = await response.text()
  console.log("Auth response body:", responseText)

  if (!response.ok) {
    const error = responseText ? JSON.parse(responseText) : {}
    throw new Error(error.message || "Erro ao obter API Key")
  }

  const data = JSON.parse(responseText)
  console.log("Parsed auth response:", JSON.stringify(data, null, 2))

  const key = data.apiKey || data.accessToken || data.token
  if (!key) {
    throw new Error("API Key não encontrada na resposta")
  }
  apiKey = key
  return key
}

async function getHeaders(): Promise<Record<string, string>> {
  const key = await getApiKey()
  return {
    "X-API-KEY": key,
    "Content-Type": "application/json"
  }
}

console.log("Pluggy Client initialized")
console.log("Client ID:", PLUGGY_CLIENT_ID ? `${PLUGGY_CLIENT_ID.substring(0, 8)}...` : "NOT SET")
console.log("Base URL:", PLUGGY_BASE_URL)

import type {
  PluggyAccount,
  PluggyTransaction,
  PluggyItem,
  PluggyConnector,
  PluggyCreateItemResponse
} from "./types"

export const pluggy = {
  // ── Criar Item (Conexão) ───────────────────────────────────
  async createItem(
    connectorId: number,
    parameters: any
  ): Promise<PluggyCreateItemResponse> {
    const body = {
      connectorId,
      parameters
    }

    const headers = await getHeaders()

    console.log("Pluggy Request:", {
      url: `${PLUGGY_BASE_URL}/items`,
      headers: {
        "X-API-KEY": headers["X-API-KEY"] ? `${headers["X-API-KEY"].substring(0, 20)}...` : "NOT SET",
        "Content-Type": "application/json"
      },
      body
    })

    const response = await fetch(`${PLUGGY_BASE_URL}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    })

    console.log("Pluggy Response Status:", response.status)
    const responseText = await response.text()
    console.log("Pluggy Response Body:", responseText)

    if (!response.ok) {
      const error = responseText ? JSON.parse(responseText) : {}
      throw new Error(error.message || `Erro Pluggy: ${response.status}`)
    }

    return JSON.parse(responseText)
  },

  // ── Obter Status do Item ───────────────────────────────────
  async getItem(itemId: string): Promise<PluggyItem> {
    const headers = await getHeaders()
    const response = await fetch(`${PLUGGY_BASE_URL}/items/${itemId}`, {
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Erro Pluggy: ${response.status}`)
    }

    return response.json()
  },

  // ── Listar Contas ───────────────────────────────────
  async getAccounts(itemId: string): Promise<PluggyAccount[]> {
    const headers = await getHeaders()
    const response = await fetch(`${PLUGGY_BASE_URL}/accounts?itemId=${itemId}`, {
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Erro Pluggy: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  },

  // ── Listar Transações ───────────────────────────────────
  async getTransactions(
    accountId: string,
    options?: { from?: string; to?: string; page?: number }
  ): Promise<{ results: PluggyTransaction[]; next?: string }> {
    const headers = await getHeaders()
    const params = new URLSearchParams({
      accountId,
      ...(options?.from && { from: options.from }),
      ...(options?.to && { to: options.to }),
      ...(options?.page && { page: options.page.toString() })
    })

    const response = await fetch(`${PLUGGY_BASE_URL}/transactions?${params}`, {
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Erro Pluggy: ${response.status}`)
    }

    return response.json()
  },

  // ── Listar Conectores ───────────────────────────────────
  async getConnectors(): Promise<PluggyConnector[]> {
    const headers = await getHeaders()
    const response = await fetch(`${PLUGGY_BASE_URL}/connectors`, {
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Erro Pluggy: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  }
}
