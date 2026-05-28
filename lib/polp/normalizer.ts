import { POLPTransaction } from "./types"

export function normalizarTransacao(
  transaction: POLPTransaction,
  contaId: string
) {
  return {
    contaId,
    identificador: transaction.transactionId,
    data: new Date(transaction.transactionDate),
    descricao: `${transaction.transactionName}${transaction.partieName ? ` - ${transaction.partieName}` : ''}`,
    valor: parseFloat(transaction.amount),
    tipo: transaction.creditDebitType, // CREDITO | DEBITO
  }
}
