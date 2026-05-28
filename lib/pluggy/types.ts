// ── Tipos Pluggy ───────────────────────────────────

export interface PluggyAccount {
  id: string
  type: "BANK" | "CREDIT"
  subtype: "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD"
  number: string
  name: string
  marketingName?: string
  balance: number
  itemId: string
  taxNumber?: string
  owner?: string
  currencyCode: string
  bankData?: {
    transferNumber?: string
    closingBalance?: number
    automaticallyInvestedBalance?: number
    overdraftContractedLimit?: number
    overdraftUsedLimit?: number
    unarrangedOverdraftAmount?: number
  }
  creditData?: {
    minimumPayment?: number
    balanceForeignCurrency?: number
    availableCreditLimit?: number
    creditLimit?: number
    isLimitFlexible?: boolean
    balanceDueDate?: string
    balanceCloseDate?: string
    level?: string
    brand?: string
    status?: string
    holderType?: string
  }
}

export interface PluggyTransaction {
  id: string
  description: string
  descriptionRaw?: string
  currencyCode: string
  amount: number
  date: string
  balance?: number
  category?: string
  categoryId?: string
  accountId: string
  providerCode?: string
  type: "DEBIT" | "CREDIT"
  status: "PENDING" | "POSTED"
  paymentData?: any
  operationCategory?: string
  creditCardMetadata?: {
    installmentNumber?: number
    totalInstallments?: number
    totalAmount?: number
    payeeMCC?: number
    cardNumber?: string
    billId?: string
  }
  merchant?: {
    name?: string
    businessName?: string
    cnpj?: string
    cnae?: string
    category?: string
  }
  providerId?: string
}

export interface PluggyItem {
  id: string
  connectorId: number
  status: "OUTDATED" | "UPDATED" | "LOGIN_ERROR" | "UPDATING" | "WAITING_USER_INPUT"
  executionStatus?: string
  lastExecutedAt?: string
  parameters?: any
  createdAt: string
  updatedAt: string
}

export interface PluggyConnector {
  id: number
  name: string
  country: string
  logo?: string
  primaryColor?: string
  backgroundColor?: string
  supportsPaymentInitiation?: boolean
  products: string[]
  parameters: any[]
}

export interface PluggyCreateItemResponse {
  id: string
  connectorId: number
  status: string
  executionStatus?: string
  parameters?: any
  createdAt: string
}
