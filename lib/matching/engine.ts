export interface EntradaConciliacao {
  id: string
  origem: "ERP" | "EXTRATO"
  data: Date
  valor: number
  tipo: "CREDITO" | "DEBITO"
  descricao: string
  documento?: string | null
  fornecedor?: string | null
  categoria?: string | null
  identificador?: string | null
}

export interface ScoreDetalhado {
  valor: number
  tipo: number
  data: number
  descricao: number
  documento: number
}

export interface MatchSugestao {
  entradaOrigemId: string     // ID do ERP
  entradaDestinoId: string    // ID do extrato
  score: number               // 0–100
  scoreDetalhado: ScoreDetalhado
  explicacoes: string[]
  confianca: "HIGH" | "MEDIUM" | "LOW"
  autoConfirmado: boolean
}

export interface ResultadoExtrato {
  extrato: EntradaConciliacao
  status: "AUTO_CONFIRMADO" | "SUGERIDO" | "AMBIGUO" | "SEM_MATCH"
  confianca: "HIGH" | "MEDIUM" | "LOW"
  sugestoes: MatchSugestao[]      // top 3 candidatos
  erpPareado?: EntradaConciliacao  // se auto-confirmado
  diferencaValor?: number         // diferença absoluta entre ERP e extrato
}

export interface ResultadoErpSobrando {
  erp: EntradaConciliacao
  status: "FALTANDO_BANCO"
}

export interface ResultadoMatching {
  itens: ResultadoExtrato[]
  erpsSobrando: ResultadoErpSobrando[]
  totalErp: number
  totalExtrato: number
  hashConciliacao: string
}

// ========== NORMALIZAÇÃO ==========

function norm(s: string): string {
  return s.toUpperCase().trim().replace(/\s+/g, " ")
}

/** Remove máscaras, símbolos, extrai números quando aplicável */
export function normalizarDocumento(doc: string): string {
  return doc.trim().toUpperCase().replace(/[^0-9A-Z]/g, "")
}

// ========== SIMILARIDADE HÍBRIDA ==========

/** Tokens comuns / máximo de tokens */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 2))
  const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 2))
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  const comum = [...tokensA].filter(t => tokensB.has(t)).length
  return comum / Math.max(tokensA.size, tokensB.size)
}

/** Trigram similarity: overlap de 3-grams */
function trigramSimilarity(a: string, b: string): number {
  const gramsA = new Set<string>()
  const gramsB = new Set<string>()
  const cleanA = a.replace(/\s+/g, "")
  const cleanB = b.replace(/\s+/g, "")
  if (cleanA.length < 3 || cleanB.length < 3) return 0
  for (let i = 0; i <= cleanA.length - 3; i++) gramsA.add(cleanA.slice(i, i + 3))
  for (let i = 0; i <= cleanB.length - 3; i++) gramsB.add(cleanB.slice(i, i + 3))
  const comum = [...gramsA].filter(g => gramsB.has(g)).length
  return comum / Math.max(gramsA.size, gramsB.size)
}

/** Levenshtein distance → similaridade 0-1 */
function levenshteinSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1

  const costs: number[] = []
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[shorter.length] = lastValue
  }
  return (longer.length - costs[shorter.length]) / longer.length
}

/** Similaridade híbrida: 40% token + 40% trigram + 20% Levenshtein */
function similaridadeHibrida(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  const t = tokenSimilarity(na, nb)
  const tri = trigramSimilarity(na, nb)
  const lev = levenshteinSimilarity(na, nb)
  return t * 0.4 + tri * 0.4 + lev * 0.2
}

// ========== SCORE INDIVIDUAL ==========

function scoreValor(v1: number, v2: number): number {
  const diff = Math.abs(v1 - v2)
  if (diff < 0.01) return 50
  const max = Math.max(v1, v2)
  const pct = max === 0 ? 1 : diff / max
  if (pct <= 0.01) return 40
  if (pct <= 0.05) return 20
  return 0
}

function scoreData(d1: Date, d2: Date): number {
  const diffMs = Math.abs(d1.getTime() - d2.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays <= 0) return 30
  if (diffDays <= 1) return 20
  if (diffDays <= 3) return 10
  if (diffDays <= 7) return 5
  return 0
}

function scoreDescricao(d1: string, d2: string): number {
  const sim = similaridadeHibrida(d1, d2)
  return Math.round(sim * 20)
}

function scoreDocumento(docErp: string | null | undefined, idExtrato: string | null | undefined): number {
  const a = normalizarDocumento(docErp || "")
  const b = normalizarDocumento(idExtrato || "")
  if (!a || !b) return 0
  if (a === b) return 15
  const numA = a.replace(/\D/g, "")
  const numB = b.replace(/\D/g, "")
  if (numA && numB && numA === numB) return 10
  if (a.includes(b) || b.includes(a)) return 5
  return 0
}

// ========== PRÉ-FILTRO ==========

function passaPreFiltro(erp: EntradaConciliacao, extrato: EntradaConciliacao): boolean {
  // Tipo igual
  if (erp.tipo !== extrato.tipo) return false
  // Valor aproximado (<= 5%)
  const maxVal = Math.max(erp.valor, extrato.valor)
  if (maxVal > 0 && Math.abs(erp.valor - extrato.valor) / maxVal > 0.05) return false
  // Data próxima (<= 7 dias)
  const diffDays = Math.abs(erp.data.getTime() - extrato.data.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 7) return false
  return true
}

// ========== GERAÇÃO DE EXPLICAÇÕES ==========

function gerarExplicacoes(sd: ScoreDetalhado): string[] {
  const exps: string[] = []
  if (sd.valor >= 50) exps.push("Valor idêntico")
  else if (sd.valor >= 40) exps.push("Valor muito próximo")
  else if (sd.valor >= 20) exps.push("Valor aproximado")

  if (sd.data >= 30) exps.push("Data idêntica")
  else if (sd.data >= 20) exps.push("Data com diferença de 1 dia")
  else if (sd.data >= 10) exps.push("Data com diferença de até 3 dias")
  else if (sd.data > 0) exps.push("Data próxima")

  if (sd.descricao >= 18) exps.push(`Descrição muito similar (${Math.round((sd.descricao / 20) * 100)}%)`)
  else if (sd.descricao >= 12) exps.push(`Descrição similar (${Math.round((sd.descricao / 20) * 100)}%)`)
  else if (sd.descricao > 0) exps.push(`Descrição parcialmente similar (${Math.round((sd.descricao / 20) * 100)}%)`)

  if (sd.documento >= 15) exps.push("Documento/Identificador idêntico")
  else if (sd.documento >= 10) exps.push("Documento/Identificador numérico igual")
  else if (sd.documento > 0) exps.push("Documento/Identificador parcialmente igual")

  return exps
}

function calcularConfianca(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 90) return "HIGH"
  if (score >= 70) return "MEDIUM"
  return "LOW"
}

// ========== ALGORITMO PRINCIPAL ==========

export function gerarSugestoes(
  erpEntradas: EntradaConciliacao[],
  extratoEntradas: EntradaConciliacao[]
): ResultadoMatching {
  // Fase 1: Gerar TODOS os candidatos (com pré-filtro)
  interface Candidato {
    extratoId: string
    erpId: string
    score: number
    scoreDetalhado: ScoreDetalhado
    explicacoes: string[]
    confianca: "HIGH" | "MEDIUM" | "LOW"
    autoConfirmado: boolean
  }

  const candidatos: Candidato[] = []

  for (const extrato of extratoEntradas) {
    for (const erp of erpEntradas) {
      if (!passaPreFiltro(erp, extrato)) continue

      const sv = scoreValor(erp.valor, extrato.valor)
      const sd = scoreData(erp.data, extrato.data)
      const sdesc = scoreDescricao(erp.descricao, extrato.descricao)
      const sdoc = scoreDocumento(erp.documento, extrato.identificador)

      const scoreDetalhado: ScoreDetalhado = {
        valor: sv,
        tipo: 0, // tipo é pré-filtro, não soma no score
        data: sd,
        descricao: sdesc,
        documento: sdoc
      }

      const score = sv + sd + sdesc + sdoc
      if (score < 20) continue // muito fraco, descarta

      const explicacoes = gerarExplicacoes(scoreDetalhado)
      const confianca = calcularConfianca(score)
      const autoConfirmado =
        score >= 95 &&
        sv >= 50 && // valor exato
        sdoc >= 15 // documento exato

      candidatos.push({
        extratoId: extrato.id,
        erpId: erp.id,
        score,
        scoreDetalhado,
        explicacoes,
        confianca,
        autoConfirmado
      })
    }
  }

  // Fase 2: Ordenar globalmente por score DESC
  candidatos.sort((a, b) => b.score - a.score)

  // Fase 3: Consumir matches melhores primeiro
  const erpConsumidos = new Set<string>()
  const extratoMatchFinal = new Map<string, Candidato>()
  const extratoSugestoes = new Map<string, Candidato[]>()

  for (const cand of candidatos) {
    // Agrupa todas as sugestões por extrato (para exibir top 3 depois)
    if (!extratoSugestoes.has(cand.extratoId)) {
      extratoSugestoes.set(cand.extratoId, [])
    }
    const sugs = extratoSugestoes.get(cand.extratoId)!
    if (sugs.length < 3) sugs.push(cand)

    // Consumo global: só atribui se ERP ainda não foi usado
    if (!erpConsumidos.has(cand.erpId) && !extratoMatchFinal.has(cand.extratoId)) {
      extratoMatchFinal.set(cand.extratoId, cand)
      erpConsumidos.add(cand.erpId)
    }
  }

  // Fase 4: Classificar cada extrato
  const itens: ResultadoExtrato[] = []
  for (const extrato of extratoEntradas) {
    const match = extratoMatchFinal.get(extrato.id)
    const sugestoesRaw = extratoSugestoes.get(extrato.id) || []

    // Converter sugestões raw para MatchSugestao
    const sugestoes: MatchSugestao[] = sugestoesRaw.map(s => ({
      entradaOrigemId: s.erpId,
      entradaDestinoId: s.extratoId,
      score: s.score,
      scoreDetalhado: s.scoreDetalhado,
      explicacoes: s.explicacoes,
      confianca: s.confianca,
      autoConfirmado: s.autoConfirmado
    }))

    if (match && match.autoConfirmado) {
      const erp = erpEntradas.find(e => e.id === match.erpId)!
      const diffValor = Math.abs(erp.valor - extrato.valor)
      itens.push({
        extrato,
        status: "AUTO_CONFIRMADO",
        confianca: "HIGH",
        sugestoes: sugestoes.slice(0, 3),
        erpPareado: erp,
        diferencaValor: diffValor
      })
    } else if (match) {
      const erp = erpEntradas.find(e => e.id === match.erpId)!
      const diffValor = Math.abs(erp.valor - extrato.valor)
      // Verificar se é ambíguo: top1 e top2 com score >= 60 e diferença <= 10
      const top1 = sugestoes[0]
      const top2 = sugestoes[1]
      const isAmbiguo =
        top1 && top1.score >= 60 &&
        top2 && top2.score >= 60 &&
        Math.abs(top1.score - top2.score) <= 10

      if (isAmbiguo) {
        itens.push({
          extrato,
          status: "AMBIGUO",
          confianca: calcularConfianca(match.score),
          sugestoes: sugestoes.slice(0, 3),
          diferencaValor: diffValor
        })
      } else {
        itens.push({
          extrato,
          status: "SUGERIDO",
          confianca: calcularConfianca(match.score),
          sugestoes: sugestoes.slice(0, 3),
          diferencaValor: diffValor
        })
      }
    } else {
      itens.push({
        extrato,
        status: "SEM_MATCH",
        confianca: "LOW",
        sugestoes: []
      })
    }
  }

  // Totais
  const totalErp = erpEntradas.reduce((s, e) => s + (e.tipo === "CREDITO" ? e.valor : -e.valor), 0)
  const totalExtrato = extratoEntradas.reduce((s, e) => s + (e.tipo === "CREDITO" ? e.valor : -e.valor), 0)

  // Identificar ERPs não consumidos (sobrando)
  const erpsSobrando: ResultadoErpSobrando[] = []
  for (const erp of erpEntradas) {
    if (!erpConsumidos.has(erp.id)) {
      erpsSobrando.push({
        erp,
        status: "FALTANDO_BANCO"
      })
    }
  }

  // Hash da sessão (determinístico baseado nos dados)
  const hashBase = erpEntradas.map(e => e.id).sort().join("") +
    extratoEntradas.map(e => e.id).sort().join("") +
    String(erpEntradas.length) +
    String(extratoEntradas.length)
  const hashConciliacao = hashBase.split("").reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0).toString(16)

  return {
    itens,
    erpsSobrando,
    totalErp,
    totalExtrato,
    hashConciliacao
  }
}
