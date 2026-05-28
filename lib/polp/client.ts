import { POLPIntegration, POLPAccount, POLPTransaction, POLPBalance, POLPIntegrationCreate } from "./types"

const POLP_BASE_URL = process.env.POLP_BASE_URL || "https://dev.polp.com.br/api/v1"
const POLP_CLIENT_ID = process.env.POLP_CLIENT_ID
const POLP_CLIENT_SECRET = process.env.POLP_CLIENT_SECRET

if (!POLP_CLIENT_ID || !POLP_CLIENT_SECRET) {
  throw new Error("POLP_CLIENT_ID e POLP_CLIENT_SECRET são obrigatórios")
}

const headers = {
  "x-api-client": POLP_CLIENT_ID,
  "x-api-secret": POLP_CLIENT_SECRET,
  "Content-Type": "application/json"
}

export const polp = {
  // ── Criar Integração ───────────────────────────────────
  async createIntegration(institutionId: number, cpf?: string, cnpj?: string): Promise<POLPIntegrationCreate> {
    const body: any = { institution_id: institutionId }
    if (cpf) body.cpf = cpf
    if (cnpj) body.cnpj = cnpj

    console.log("POLP Request:", JSON.stringify(body, null, 2))

    const response = await fetch(`${POLP_BASE_URL}/integrations`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    })

    console.log("POLP Response Status:", response.status)
    const data = await response.json()
    console.log("POLP Response Body:", JSON.stringify(data, null, 2))

    if (!response.ok) {
      throw new Error(data.message || `Erro POLP: ${response.status}`)
    }

    return data.data
  },

  async getIntegrationStatus(integrationId: number): Promise<POLPIntegrationCreate> {
    const response = await fetch(`${POLP_BASE_URL}/integrations/${integrationId}`, {
      headers
    })
    const data = await response.json()
    return data.data
  },

  // ── Integrações ────────────────────────────────────────
  async getIntegrations(): Promise<POLPIntegration[]> {
    const response = await fetch(`${POLP_BASE_URL}/integrations`, {
      headers
    })
    const data = await response.json()
    return data.data || data
  },

  // ── Contas ─────────────────────────────────────────────
  async getAccounts(): Promise<POLPAccount[]> {
    const response = await fetch(`${POLP_BASE_URL}/accounts`, {
      headers
    })
    const data = await response.json()
    return data.data || data
  },

  // ── Transações (Extrato) ────────────────────────────────
  async getTransactions(
    accountId: string,
    from: Date,
    to: Date
  ): Promise<POLPTransaction[]> {
    const params = new URLSearchParams({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    })
    const response = await fetch(
      `${POLP_BASE_URL}/transactions?${params}`,
      { headers }
    )
    const data = await response.json()
    return data.data || data
  },

  // ── Saldos ─────────────────────────────────────────────
  async getBalances(accountId: string): Promise<POLPBalance[]> {
    const response = await fetch(
      `${POLP_BASE_URL}/balances?accountId=${accountId}`,
      { headers }
    )
    const data = await response.json()
    return data.data || data
  }
}
