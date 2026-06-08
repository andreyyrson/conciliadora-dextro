// ── Parser OFX ───────────────────────────────────

export interface OFXTransaction {
  id: string
  date: Date
  amount: number
  description: string
  type: "DEBIT" | "CREDIT"
  balance?: number
  checkNumber?: string
  memo?: string
}

export interface OFXAccount {
  bankId: string
  accountId: string
  accountType: "CHECKING" | "SAVINGS" | "CREDITCARD" | "INVESTMENT"
  balance: number
  currency: string
  transactions: OFXTransaction[]
}

export interface OFXData {
  accounts: OFXAccount[]
  startDate?: Date
  endDate?: Date
}

/**
 * Parse OFX file content
 */
export function parseOFX(content: string): OFXData {
  const lines = content.split(/\r?\n/)
  const data: OFXData = { accounts: [] }
  
  let currentAccount: Partial<OFXAccount> | null = null
  let currentTransactions: OFXTransaction[] = []
  let inTransaction = false
  let currentTransaction: Partial<OFXTransaction> | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines and comments
    if (!line || line.startsWith('<!')) continue
    
    // Remove tags and parse
    // Handle both: <TAG>value</TAG>  and  <TAG>value  formats
    const tagMatch = line.match(/^<([^>\/]+)>([^<]*)<\/[^>]+>$/) || line.match(/^<([^>]+)>(.*)$/)
    if (!tagMatch) continue
    
    const tag = tagMatch[1]
    const value = tagMatch[2] || ''
    
    // Account information
    if (tag === 'BANKID' && currentAccount) {
      currentAccount.bankId = value
    } else if (tag === 'ACCTID' && currentAccount) {
      currentAccount.accountId = value
    } else if (tag === 'ACCTTYPE' && currentAccount) {
      currentAccount.accountType = value as OFXAccount["accountType"]
    } else if (tag === 'BALAMT' && currentAccount) {
      currentAccount.balance = parseFloat(value)
    } else if (tag === 'CURDEF' && currentAccount) {
      currentAccount.currency = value
    }
    
    // Transaction start
    if (tag === 'STMTTRN') {
      inTransaction = true
      currentTransaction = {}
    }
    
    // Transaction fields
    if (inTransaction && currentTransaction) {
      if (tag === 'TRNTYPE') {
        currentTransaction.type = value === 'DEBIT' ? 'DEBIT' : 'CREDIT'
      } else if (tag === 'DTPOSTED') {
        currentTransaction.date = parseOFXDate(value)
      } else if (tag === 'TRNAMT') {
        currentTransaction.amount = parseFloat(value)
      } else if (tag === 'FITID') {
        currentTransaction.id = value
      } else if (tag === 'NAME') {
        currentTransaction.description = value
      } else if (tag === 'MEMO') {
        currentTransaction.memo = value
      } else if (tag === 'CHECKNUM') {
        currentTransaction.checkNumber = value
      }
    }
    
    // Transaction end
    if (tag === '/STMTTRN' && currentTransaction) {
      if (currentTransaction.id && currentTransaction.date && currentTransaction.amount !== undefined) {
        currentTransactions.push({
          id: currentTransaction.id,
          date: currentTransaction.date,
          amount: currentTransaction.amount,
          description: currentTransaction.description || currentTransaction.memo || '',
          type: currentTransaction.type || (currentTransaction.amount < 0 ? 'DEBIT' : 'CREDIT'),
          memo: currentTransaction.memo,
          checkNumber: currentTransaction.checkNumber
        })
      }
      currentTransaction = null
      inTransaction = false
    }
    
    // Account end (only clear current account, don't save yet)
    if (tag === '/BANKACCTFROM' || tag === '/CCACCTFROM') {
      // Account info complete, but wait for transactions
      // Account will be saved at </STMTRS>
    }
    
    // Statement end - save account with all transactions
    if (tag === '/STMTRS') {
      if (currentAccount && currentAccount.accountId) {
        data.accounts.push({
          bankId: currentAccount.bankId || '',
          accountId: currentAccount.accountId,
          accountType: currentAccount.accountType || 'CHECKING',
          balance: currentAccount.balance || 0,
          currency: currentAccount.currency || 'BRL',
          transactions: [...currentTransactions]
        })
      }
      currentAccount = null
      currentTransactions = []
    }
    
    // Account start
    if (tag === 'BANKACCTFROM' || tag === 'CCACCTFROM') {
      currentAccount = {}
      currentTransactions = []
    }
  }
  
  return data
}

/**
 * Parse OFX date format (YYYYMMDDHHMMSS)
 */
function parseOFXDate(dateStr: string): Date {
  // OFX dates can be in various formats
  // Common format: YYYYMMDDHHMMSS[.sss]
  const cleanDate = dateStr.replace(/\[.*\]/, '').replace(/\..*$/, '')
  
  if (cleanDate.length >= 8) {
    const year = parseInt(cleanDate.substring(0, 4))
    const month = parseInt(cleanDate.substring(4, 6)) - 1
    const day = parseInt(cleanDate.substring(6, 8))
    const hour = cleanDate.length >= 10 ? parseInt(cleanDate.substring(8, 10)) : 0
    const minute = cleanDate.length >= 12 ? parseInt(cleanDate.substring(10, 12)) : 0
    const second = cleanDate.length >= 14 ? parseInt(cleanDate.substring(12, 14)) : 0
    
    return new Date(year, month, day, hour, minute, second)
  }
  
  return new Date()
}

/**
 * Validate OFX file
 */
export function validateOFX(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Arquivo vazio' }
  }
  
  // Check for OFX header
  const hasOFXHeader = content.includes('OFXHEADER') || 
                      content.includes('<OFX>') ||
                      content.includes('BANKMSGSRSV1') ||
                      content.includes('CREDITCARDMSGSRSV1')
  
  if (!hasOFXHeader) {
    return { valid: false, error: 'Arquivo não parece ser um arquivo OFX válido' }
  }
  
  return { valid: true }
}
