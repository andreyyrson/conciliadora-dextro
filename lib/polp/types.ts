export interface POLPIntegration {
  id: string
  name: string
  logo?: string
  country: string
}

export interface POLPAccount {
  id: string
  bankName: string
  accountNumber: string
  branch: string
  accountType: string
}

export interface POLPTransaction {
  id: string
  transactionId: string
  amount: string
  currency: string
  transactionDate: string
  transactionName: string
  type: string
  creditDebitType: "CREDITO" | "DEBITO"
  partieName?: string
  completedAuthorisedPaymentType?: string
}

export interface POLPBalance {
  accountId: string
  availableAmount: string
  currentAmount: string
  currency: string
}

export interface POLPIntegrationCreate {
  id: number
  institution_id: number
  status: "UPDATING" | "WAITING_USER_INPUT" | "UPDATED" | "LOGIN_ERROR" | "OUTDATED"
  execution_status: string
  error: string | null
  user_action: string | null
  url_to_authenticate: string
  url_to_authenticate_expires_at: string
  last_updated_at: string | null
  next_auto_sync_at: string | null
  last_recurring_scan_at: string | null
  created_at: string
  updated_at: string
}
