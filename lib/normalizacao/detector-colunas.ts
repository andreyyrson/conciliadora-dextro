/**
 * Engine de detecção automática de colunas em arquivos CSV/XLSX
 * Mapeia nomes de colunas variáveis para campos padrão do sistema
 */

export type CampoPadrao =
  | "data"
  | "valor"
  | "descricao"
  | "tipo"
  | "documento"
  | "fornecedor"
  | "cnpj"
  | "centroCusto"
  | "conta"
  | "agencia"
  | "banco"
  | "observacao"
  | "lancamento"
  | "identificador"
  | "saldoApos"
  | "numero"
  | "referencia"
  | "status"
  | "categoria"
  | "projeto"
  | "natureza"

export interface MapeamentoColunas {
  [campo: string]: string | null  // campo padrão -> nome da coluna original
}

export interface PreviewLinha {
  [colunaOriginal: string]: string
}

export interface ResultadoDeteccao {
  mapeamento: MapeamentoColunas
  preview: PreviewLinha[]
  colunasNaoMapeadas: string[]
  confianca: { [campo: string]: number }  // 0-1, score de confiança
}

// Heurísticas de detecção: campo padrão -> array de possíveis nomes de coluna
const HEURISTICAS: Record<CampoPadrao, string[]> = {
  data: [
    "data", "data pagamento", "data pagto", "data pagto contábil",
    "data vencimento", "data entrada", "data emissão", "date",
    "dt", "dt pagto", "dt pagamento", "data lançamento", "data operação",
    "data compensação", "data compensacao", "data efetiva", "data movimento",
    "data transação", "data transacao", "data registro", "data arquivo",
    "data liquidacao", "data liquidação", "dt movimento", "dt operacao",
    "dt operação", "data origem", "data processamento", "processing date",
    "posting date", "transaction date", "effective date"
  ],
  valor: [
    "valor", "valor líquido", "valor liquido", "valor parcela", "valor documento",
    "valor (R$)", "valor(R$)", "value", "amount", "price", "vl", "vlr",
    "valor pago", "valor recebido", "montante", "r$", "vr", "val",
    "valor bruto", "valor líquido pago", "valor total", "vl total",
    "vr líquido", "vr liquido", "net amount", "gross amount",
    "total", "subtotal", "total líquido", "total liquido",
    "valor efetivo", "valor final", "valor principal",
    "valor da operação", "valor operação", "amount (R$)", "amount(R$)"
  ],
  descricao: [
    "descricao", "descrição", "razão", "razao", "histórico", "historico",
    "observacao", "observação", "detalhe", "detalhes", "texto",
    "descricao pagamento", "descrição pagamento", "descricao lancamento",
    "descricao lançamento", "descricao operacao", "descricao operação",
    "historico lancamento", "historico lançamento", "memo",
    "payment description", "transaction description", "desc"
  ],
  tipo: [
    "tipo", "tipo entrada", "tipo pagamento", "natureza",
    "dc", "d/c", "débito/crédito", "debito/credito", "tipo lançamento",
    "tipo operacao", "tipo operação", "tipo movimento", "tipo transacao",
    "tipo transação", "entrada/saída", "entrada/saida", "credit/debit",
    "c/d", "sinal", "direction", "flow", "fluxo", "movimentacao",
    "tipo cobranca", "tipo cobrança", "natureza operacao", "natureza operação"
  ],
  documento: [
    "documento", "n° documento", "n documento", "numero documento",
    "n doc", "nº doc", "doc", "n°", "num doc", "numero",
    "numero do documento", "número do documento", "doc no", "doc. no",
    "documento pagamento", "documento lancamento", "documento lançamento",
    "nº", "nº.", "no", "no.", "nro", "nro.", "nr", "nr.",
    "num", "num.", "numero boleto", "número boleto", "invoice",
    "invoice number", "ref", "reference number", "protocolo",
    "protocol", "ordem", "order", "pedido", "order number"
  ],
  fornecedor: [
    "fornecedor", "fornecedor/razão social", "razão social", "razao social",
    "nome", "beneficiario", "beneficiário", "favorecido", "cliente",
    "pagador", "recebedor", "fornecedor nome", "nome fornecedor",
    "beneficiario nome", "nome beneficiario", "nome beneficiário",
    "cliente nome", "nome cliente", "payee", "payer",
    "credor", "devedor", "terceiro", "third party",
    "empresa", "company", "parceiro", "partner",
    "sacado", "cedente", "tomador", "cedido"
  ],
  cnpj: [
    "cpf/cnpj", "cnpj", "cpf", "cnpj/cpf", "documento fiscal",
    "cgc", "inscricao", "identificador", "cnpj/cpf fornecedor",
    "cnpj fornecedor", "cpf fornecedor", "cnpj cliente", "cpf cliente",
    "cnpj/cpf cliente", "tax id", "taxid", "federal id",
    "documento identificacao", "documento identificação",
    "cnpj/cpf favorecido", "cnpj favorecido", "cpf favorecido"
  ],
  centroCusto: [
    "centro custo", "centro de custo", "c.custo", "cc", "centro custo",
    "loja", "filial", "unidade", "departamento", "cost center",
    "centro custo descricao", "centro de custo descrição",
    "ccusto", "c custo", "c.c", "cc descricao", "cc descrição",
    "local", "site", "regional", "setor", "segmento", "area",
    "business unit", "bu", "gerencia", "gerência", "diretoria"
  ],
  conta: [
    "conta", "n° conta", "numero conta", "conta corrente", "cc",
    "conta bancaria", "conta bancária", "account number", "account",
    "nro conta", "nr conta", "num conta", "conta no", "conta digito",
    "conta corrente digito", "checking account", "bank account"
  ],
  agencia: [
    "agencia", "agência", "ag.", "ag", "agencia/origem",
    "branch", "branch code", "branch number", "agencia banco",
    "agência banco", "ag banco", "branch office", "ag no",
    "nro agencia", "nr agencia", "num agencia"
  ],
  banco: [
    "banco", "nome banco", "banco nome", "instituicao", "instituição",
    "bank", "bank name", "nome do banco", "banco codigo", "banco código",
    "codigo banco", "código banco", "bank code", "instituição financeira",
    "instituicao financeira", "if", "banco/origem", "banco origem"
  ],
  observacao: [
    "observação", "observacao", "obs", "nota", "memo", "comentario",
    "comentário", "notas", "notes", "anotacao", "anotação",
    "observacao interna", "observação interna", "obs geral",
    "observacoes", "observações", "informacao complementar",
    "informação complementar", "additional info", "remarks"
  ],
  lancamento: [
    "lançamento", "lancamento", "movimento", "transacao", "transação",
    "operação", "operacao", "histórico", "transaction", "entry",
    "lancamento descricao", "lançamento descrição", "lancamento tipo",
    "lançamento tipo", "movimentacao", "movimentação", "item",
    "line item", "record", "registro"
  ],
  identificador: [
    "identificador", "id", "id transacao", "id transação", "transaction id",
    "trans id", "codigo", "código", "ref", "reference", "referencia",
    "referência", "protocolo", "protocol", "numero protocolo",
    "número protocolo", "seq", "sequence", "numero sequencial",
    "número sequencial", "id operacao", "id operação", "tx id",
    "transaction code", "trace id", "audit id", "audit trail",
    "numero unico", "número único", "nu", "nú", "unique id", "uid"
  ],
  saldoApos: [
    "saldo apos", "saldo após", "saldo", "saldo final", "saldo atual",
    "balance", "running balance", "current balance", "saldo conta",
    "saldo cc", "saldo corrente", "saldo disponivel", "saldo disponível",
    "saldo em conta", "saldo bancario", "saldo bancário",
    "available balance", "ending balance", "closing balance",
    "saldo final dia", "saldo do dia", "saldo periodo", "saldo período"
  ],
  numero: [
    "numero", "número", "num", "nº", "nro", "nr", "no",
    "seq", "sequencia", "sequência", "seq no", "line number",
    "row number", "item number", "item no", "ordem", "order",
    "numero ordem", "número ordem", "seq num", "n seq"
  ],
  referencia: [
    "referencia", "referência", "ref", "reference", "referencia pagamento",
    "referência pagamento", "referencia cliente", "referência cliente",
    "ref no", "ref number", "reference number", "your reference",
    "our reference", "ref externa", "ref externo", "referencia externa",
    "referência externa", "external ref", "campo livre", "free field",
    "info adicional", "informacao adicional", "informação adicional"
  ],
  status: [
    "status", "situacao", "situação", "estado", "condition",
    "payment status", "status pagamento", "status lancamento",
    "status lançamento", "status operacao", "status operação",
    "processed", "processado", "confirmado", "confirmed",
    "pending", "pendente", "cancelado", "cancelled", "rejected",
    "rejeitado", "approved", "aprovado", "completed", "completo"
  ],
  categoria: [
    "categoria", "category", "classificacao", "classificação",
    "grupo", "group", "tipo categoria", "tipo classificacao",
    "tipo classificação", "categoria despesa", "categoria receita",
    "expense category", "income category", "account category",
    "chart of accounts", "plano contas", "plano de contas",
    "conta contabil", "conta contábil", "codigo contabil", "código contábil"
  ],
  projeto: [
    "projeto", "project", "obra", "ordem servico", "ordem serviço",
    "os", "o.s.", "contrato", "contract", "job", "job number",
    "project code", "project id", "codigo projeto", "código projeto",
    "projeto nome", "nome projeto", "project name", "task",
    "tarefa", "atividade", "activity", "fase", "phase",
    "etapa", "stage", "release", "sprint", "epic"
  ],
  natureza: [
    "natureza", "nature", "natureza operacao", "natureza operação",
    "natureza lancamento", "natureza lançamento", "natureza pagamento",
    "natureza recebimento", "tipo natureza", "natureza despesa",
    "natureza receita", "expense nature", "income nature",
    "tipo operacional", "operational type", "business nature",
    "natureza juridica", "natureza jurídica"
  ]
}

/**
 * Calcula score de similaridade entre nome de coluna e heurísticas
 * Retorna score entre 0 e 1
 */
export function calcularScore(nomeColuna: string, campo: CampoPadrao): number {
  const nomeNormalizado = nomeColuna
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // Remove acentos
    .replace(/[^a-z0-9\s]/g, " ")     // Remove caracteres especiais, mantém espaço
    .trim()

  const heuristica = HEURISTICAS[campo]
  let melhorScore = 0

  for (const padrao of heuristica) {
    const padraoNormalizado = padrao
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()

    // Match exato
    if (nomeNormalizado === padraoNormalizado) {
      return 1.0
    }

    // Contém o padrão exato
    if (nomeNormalizado.includes(padraoNormalizado) || padraoNormalizado.includes(nomeNormalizado)) {
      melhorScore = Math.max(melhorScore, 0.85)
    }

    // Palavras individuais
    const palavrasNome = nomeNormalizado.split(/\s+/)
    const palavrasPadrao = padraoNormalizado.split(/\s+/)
    const palavrasComuns = palavrasNome.filter(p => palavrasPadrao.includes(p))

    if (palavrasComuns.length > 0) {
      const score = palavrasComuns.length / Math.max(palavrasNome.length, palavrasPadrao.length)
      melhorScore = Math.max(melhorScore, score * 0.7)
    }

    // Prefixo/sufixo
    if (nomeNormalizado.startsWith(padraoNormalizado) || nomeNormalizado.endsWith(padraoNormalizado)) {
      melhorScore = Math.max(melhorScore, 0.75)
    }
  }

  return melhorScore
}

/**
 * Detecta tipo de conteúdo das células para inferir o campo quando o nome da coluna não ajuda
 */
export function detectarPorConteudo(
  coluna: string,
  previewLinhas: Record<string, unknown>[]
): { campo: CampoPadrao | null; score: number } {
  const valores = previewLinhas
    .map(l => String(l[coluna] ?? "").trim())
    .filter(v => v.length > 0)

  if (valores.length === 0) return { campo: null, score: 0 }

  const amostra = valores.slice(0, 20)
  const total = amostra.length

  // === DATA ===
  const dataRegex = /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/
  const dataRegexCurta = /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})$/
  const dataISORegex = /^(\d{4})-(\d{2})-(\d{2})$/
  const datas = amostra.filter(v => dataRegex.test(v) || dataRegexCurta.test(v) || dataISORegex.test(v))
  if (datas.length / total >= 0.7) {
    return { campo: "data", score: 0.85 }
  }

  // === VALOR / SALDO ===
  // Detecta valores monetários: "1.050,23", "R$ 500,00", "-1.234,56", "1,234.56"
  const valoresMonetarios = amostra.filter(v => {
    const limpo = v.replace(/[R$\s]/g, "")
    return /^[\-+]?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}|\d+,\d{2}|\d+)$/.test(limpo)
  })
  if (valoresMonetarios.length / total >= 0.7) {
    // Diferenciar saldo (provavelmente nome contém "saldo" ou "balance") de valor
    const nomeLower = coluna.toLowerCase()
    if (/saldo|balance|dispon/i.test(nomeLower)) {
      return { campo: "saldoApos", score: 0.8 }
    }
    return { campo: "valor", score: 0.85 }
  }

  // === CNPJ ===
  const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/
  const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
  const cnpjs = amostra.filter(v => cnpjRegex.test(v) || cpfRegex.test(v))
  if (cnpjs.length / total >= 0.5) {
    return { campo: "cnpj", score: 0.9 }
  }

  // === TIPO (C/D, CREDITO/DEBITO) ===
  const tipoValores = ["c", "d", "crédito", "credito", "débito", "debito", "credit", "debit", "entrada", "saída", "saida", "in", "out", "+", "-", "recebimento", "pagamento"]
  const tipos = amostra.filter(v => tipoValores.includes(v.toLowerCase().trim()))
  if (tipos.length / total >= 0.6) {
    return { campo: "tipo", score: 0.8 }
  }

  // === STATUS ===
  const statusValores = ["pago", "pendente", "cancelado", "processado", "confirmado", "rejeitado", "aprovado", "completed", "cancelled", "pending", "approved", "rejected", "paid", "open", "closed", "liquidado", "estornado"]
  const status = amostra.filter(v => statusValores.includes(v.toLowerCase().trim()))
  if (status.length / total >= 0.5) {
    return { campo: "status", score: 0.75 }
  }

  // === DOCUMENTO / NÚMERO (valores pequenos numéricos, geralmente inteiros) ===
  const docRegex = /^\d{1,10}$/
  const docs = amostra.filter(v => docRegex.test(v))
  if (docs.length / total >= 0.7) {
    return { campo: "numero", score: 0.6 }
  }

  // === DESCRIÇÃO / FORNECEDOR (textos maiores, muitas palavras) ===
  const textosLongos = amostra.filter(v => v.split(/\s+/).length >= 2 && v.length > 5)
  if (textosLongos.length / total >= 0.8) {
    // Se o nome da coluna sugere fornecedor, prioriza
    const nomeLower = coluna.toLowerCase()
    if (/fornec|cliente|benefici|favorec|pagador|recebedor|nome|razao|social/.test(nomeLower)) {
      return { campo: "fornecedor", score: 0.65 }
    }
    return { campo: "descricao", score: 0.6 }
  }

  return { campo: null, score: 0 }
}

/**
 * Detecta e mapeia colunas de um arquivo para campos padrão do sistema
 * Usa heurísticas de nome + análise de conteúdo das células
 */
export function detectarColunas(
  colunas: string[],
  previewLinhas: Record<string, unknown>[]
): ResultadoDeteccao {
  const mapeamento: MapeamentoColunas = {}
  const confianca: { [campo: string]: number } = {}
  const colunasMapeadas = new Set<string>()
  const camposPadrao = Object.keys(HEURISTICAS) as CampoPadrao[]

  // === FASE 1: Detecção por nome de coluna ===
  for (const campo of camposPadrao) {
    let melhorColuna: string | null = null
    let melhorScore = 0.35  // Threshold mínimo para nome

    for (const coluna of colunas) {
      const score = calcularScore(coluna, campo)
      if (score > melhorScore && !colunasMapeadas.has(coluna)) {
        melhorScore = score
        melhorColuna = coluna
      }
    }

    if (melhorColuna) {
      mapeamento[campo] = melhorColuna
      confianca[campo] = melhorScore
      colunasMapeadas.add(melhorColuna)
    } else {
      mapeamento[campo] = null
      confianca[campo] = 0
    }
  }

  // === FASE 2: Detecção por conteúdo das células (fallback) ===
  // Para campos obrigatórios ainda não mapeados, tentar inferir pelo conteúdo
  const camposPrioritarios: CampoPadrao[] = ["data", "valor", "descricao", "tipo"]
  const colunasNaoMapeadas = colunas.filter(c => !colunasMapeadas.has(c))

  for (const campo of camposPrioritarios) {
    if (mapeamento[campo]) continue // Já mapeado por nome

    let melhorColuna: string | null = null
    let melhorScore = 0

    for (const coluna of colunasNaoMapeadas) {
      const { campo: campoDetectado, score } = detectarPorConteudo(coluna, previewLinhas)
      if (campoDetectado === campo && score > melhorScore) {
        melhorScore = score
        melhorColuna = coluna
      }
    }

    if (melhorColuna) {
      mapeamento[campo] = melhorColuna
      confianca[campo] = melhorScore * 0.85 // Penalidade por ser inferência de conteúdo
      colunasMapeadas.add(melhorColuna)
    }
  }

  // === FASE 3: Detecção por conteúdo para demais campos ===
  const colunasRestantes = colunas.filter(c => !colunasMapeadas.has(c))
  for (const coluna of colunasRestantes) {
    const { campo, score } = detectarPorConteudo(coluna, previewLinhas)
    if (campo && !mapeamento[campo] && score >= 0.75) {
      mapeamento[campo] = coluna
      confianca[campo] = score * 0.85
      colunasMapeadas.add(coluna)
    }
  }

  // Colunas que não foram mapeadas para nenhum campo
  const colunasNaoMapeadasFinais = colunas.filter(c => !colunasMapeadas.has(c))

  // Extrair preview (primeiras 50 linhas) para o consultor visualizar o arquivo
  const preview: PreviewLinha[] = previewLinhas.slice(0, 50).map(linha => {
    const linhaPreview: PreviewLinha = {}
    for (const coluna of colunas) {
      linhaPreview[coluna] = String(linha[coluna] ?? "")
    }
    return linhaPreview
  })

  return {
    mapeamento,
    preview,
    colunasNaoMapeadas: colunasNaoMapeadasFinais,
    confianca
  }
}

/**
 * Aplica um mapeamento manual (usuário confirmou/editou)
 */
export function aplicarMapeamento(
  mapeamentoUsuario: MapeamentoColunas,
  mapeamentoAuto: ResultadoDeteccao
): ResultadoDeteccao {
  // Mesclar: usuário sobrescreve detecção automática
  const mapeamentoFinal = { ...mapeamentoAuto.mapeamento }
  const confiancaFinal = { ...mapeamentoAuto.confianca }

  for (const [campo, coluna] of Object.entries(mapeamentoUsuario)) {
    if (coluna === null || coluna === undefined) {
      // Usuário desmarcou um campo
      mapeamentoFinal[campo] = null
      confiancaFinal[campo] = 0
    } else if (mapeamentoAuto.colunasNaoMapeadas.includes(coluna) ||
               Object.values(mapeamentoAuto.mapeamento).includes(coluna)) {
      // Usuário selecionou uma coluna válida
      mapeamentoFinal[campo] = coluna
      confiancaFinal[campo] = 1.0  // Usuário confirmou = confiança máxima
    }
  }

  return {
    ...mapeamentoAuto,
    mapeamento: mapeamentoFinal,
    confianca: confiancaFinal
  }
}
