/**
 * Pipeline de normalização de dados financeiros
 * Converte dados brutos do CSV/XLSX para formato padrão do sistema
 */

import { MapeamentoColunas } from "./detector-colunas"

export interface DadoNormalizado {
  data: Date
  valor: number
  descricao: string
  tipo: "CREDITO" | "DEBITO"
  fornecedor?: string
  documento?: string
  cnpj?: string
  centroCusto?: string
  banco?: string
  agencia?: string
  conta?: string
  observacao?: string
  identificador?: string
  saldoApos?: number
  numero?: string
  referencia?: string
  status?: string
  categoria?: string
  projeto?: string
  natureza?: string
  rawData: unknown  // Dados brutos originais para auditoria
}

/**
 * Normaliza um valor monetário brasileiro para número
 */
export function normalizarValor(valorRaw: unknown): number {
  if (valorRaw === null || valorRaw === undefined || valorRaw === "") {
    return 0
  }

  const valorStr = String(valorRaw).trim()

  // Detectar formato brasileiro (vírgula como decimal)
  // Ex: "1.050,23" -> 1050.23
  // Ex: "5,25" -> 5.25
  // Ex: "10.000,00" -> 10000.00

  // Remover símbolos monetários e espaços
  let limpo = valorStr
    .replace(/[R$\s]/g, "")
    .replace(/"/g, "")

  // Se tem vírgula e ponto: "1.050,23" (brasileiro completo)
  if (limpo.includes(",") && limpo.includes(".")) {
    // Verificar qual é o separador decimal (último caractere)
    const ultimoPonto = limpo.lastIndexOf(".")
    const ultimaVirgula = limpo.lastIndexOf(",")

    if (ultimaVirgula > ultimoPonto) {
      // Vírgula é decimal: "1.050,23"
      limpo = limpo.replace(/\./g, "").replace(",", ".")
    } else {
      // Ponto é decimal: "1,050.23" (formato americano)
      limpo = limpo.replace(/,/g, "")
    }
  }
  // Se só tem vírgula: "5,25" -> vírgula é decimal
  else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".")
  }
  // Se só tem ponto e é muito grande (provavelmente milhar): "1050.23"
  // Ponto já é decimal no JS, não precisa mudar

  const valor = parseFloat(limpo)
  return isNaN(valor) ? 0 : valor
}

/**
 * Normaliza uma data em formato brasileiro para Date
 */
export function normalizarData(dataRaw: unknown): Date {
  if (!dataRaw) return new Date()

  const dataStr = String(dataRaw).trim()

  // Remover dia da semana se tiver: "09/01/2026 - SEX"
  const dataSemDia = dataStr.split(" - ")[0].trim()

  // Tentar formatos brasileiros
  const formatos = [
    // DD/MM/YYYY
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, groups: [3, 2, 1] },
    // DD-MM-YYYY
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, groups: [3, 2, 1] },
    // YYYY-MM-DD (ISO)
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, groups: [1, 2, 3] },
    // DD/MM/YY
    { regex: /^(\d{2})\/(\d{2})\/(\d{2})$/, groups: [3, 2, 1] },
  ]

  for (const formato of formatos) {
    const match = dataSemDia.match(formato.regex)
    if (match) {
      const [ano, mes, dia] = formato.groups.map(i => match[i])
      const anoCompleto = ano.length === 2 ? `20${ano}` : ano
      const data = new Date(`${anoCompleto}-${mes}-${dia}`)
      if (!isNaN(data.getTime())) {
        return data
      }
    }
  }

  // Fallback: tentar parse nativo
  const dataNativa = new Date(dataSemDia)
  return isNaN(dataNativa.getTime()) ? new Date() : dataNativa
}

/**
 * Normaliza descrição (trim, uppercase, remove espaços duplos)
 */
export function normalizarDescricao(descRaw: unknown): string {
  if (!descRaw) return ""
  return String(descRaw)
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
}

/**
 * Normaliza CNPJ/CPF (remove pontos, traços, barras)
 */
export function normalizarCnpj(cnpjRaw: unknown): string {
  if (!cnpjRaw) return ""
  return String(cnpjRaw)
    .replace(/[^\d]/g, "")
    .trim()
}

/**
 * Detecta tipo (CREDITO/DEBITO) a partir do valor e coluna de tipo
 */
export function normalizarTipo(
  tipoRaw: unknown,
  valor: number
): "CREDITO" | "DEBITO" {
  if (!tipoRaw) {
    return valor < 0 ? "DEBITO" : "CREDITO"
  }

  const tipoStr = String(tipoRaw).toLowerCase().trim()

  // Palavras-chave de crédito
  const creditoKeywords = [
    "credito", "crédito", "recebido", "entrada", "c", "credit",
    "depósito", "deposito", "receita", "receitas", "income"
  ]

  // Palavras-chave de débito
  const debitoKeywords = [
    "debito", "débito", "pago", "pagamento", "saída", "saida",
    "d", "debit", "despesa", "despesas", "expense", "out"
  ]

  for (const keyword of creditoKeywords) {
    if (tipoStr.includes(keyword)) return "CREDITO"
  }

  for (const keyword of debitoKeywords) {
    if (tipoStr.includes(keyword)) return "DEBITO"
  }

  // Fallback: valor negativo = DEBITO
  return valor < 0 ? "DEBITO" : "CREDITO"
}

/**
 * Executa o pipeline completo de normalização em uma linha de dados
 */
export function normalizarLinha(
  linha: Record<string, unknown>,
  mapeamento: MapeamentoColunas
): DadoNormalizado {
  const m = mapeamento

  // Data
  const dataRaw = m.data ? linha[m.data] : null
  const data = normalizarData(dataRaw)

  // Valor
  const valorRaw = m.valor ? linha[m.valor] : null
  let valor = normalizarValor(valorRaw)

  // Tipo
  const tipoRaw = m.tipo ? linha[m.tipo] : null
  const tipo = normalizarTipo(tipoRaw, valor)

  // Se valor é negativo, tornar positivo (tipo indica direção)
  if (valor < 0) {
    valor = Math.abs(valor)
  }

  // Descrição
  let descricao = ""
  if (m.descricao && linha[m.descricao]) {
    descricao = normalizarDescricao(linha[m.descricao])
  } else if (m.lancamento && linha[m.lancamento]) {
    descricao = normalizarDescricao(linha[m.lancamento])
  } else if (m.fornecedor && linha[m.fornecedor]) {
    descricao = normalizarDescricao(linha[m.fornecedor])
  }

  // Saldo (para extratos)
  const saldoApos = m.saldoApos ? normalizarValor(linha[m.saldoApos]) : undefined

  return {
    data,
    valor,
    descricao,
    tipo,
    fornecedor: m.fornecedor ? normalizarDescricao(linha[m.fornecedor]) : undefined,
    documento: m.documento ? normalizarDescricao(linha[m.documento]) : undefined,
    cnpj: m.cnpj ? normalizarCnpj(linha[m.cnpj]) : undefined,
    centroCusto: m.centroCusto ? normalizarDescricao(linha[m.centroCusto]) : undefined,
    banco: m.banco ? normalizarDescricao(linha[m.banco]) : undefined,
    agencia: m.agencia ? normalizarDescricao(linha[m.agencia]) : undefined,
    conta: m.conta ? normalizarDescricao(linha[m.conta]) : undefined,
    observacao: m.observacao ? normalizarDescricao(linha[m.observacao]) : undefined,
    identificador: m.identificador ? normalizarDescricao(linha[m.identificador]) : undefined,
    saldoApos,
    numero: m.numero ? normalizarDescricao(linha[m.numero]) : undefined,
    referencia: m.referencia ? normalizarDescricao(linha[m.referencia]) : undefined,
    status: m.status ? normalizarDescricao(linha[m.status]) : undefined,
    categoria: m.categoria ? normalizarDescricao(linha[m.categoria]) : undefined,
    projeto: m.projeto ? normalizarDescricao(linha[m.projeto]) : undefined,
    natureza: m.natureza ? normalizarDescricao(linha[m.natureza]) : undefined,
    rawData: linha
  }
}

/**
 * Executa o pipeline completo em todas as linhas
 */
export function executarPipeline(
  linhas: Record<string, unknown>[],
  mapeamento: MapeamentoColunas
): DadoNormalizado[] {
  return linhas
    .map(linha => normalizarLinha(linha, mapeamento))
    .filter(dado => dado.valor !== 0)  // Filtrar linhas sem valor
}
