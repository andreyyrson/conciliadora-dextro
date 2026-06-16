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
  banco?: string | null
}

export interface ScoreDetalhado {
  valor: number
  tipo: number
  data: number
  descricao: number
  fornecedor: number
  banco: number
}

export interface MatchSugestao {
  entradaOrigemId: string     // ID do ERP
  entradaDestinoId: string    // ID do extrato
  score: number               // 0–120
  scoreDetalhado: ScoreDetalhado
  explicacoes: string[]
  confianca: "HIGH" | "MEDIUM" | "LOW"
  autoConfirmado: boolean
}

export interface ResultadoExtrato {
  extrato: EntradaConciliacao
  status: "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO"
  confianca: "HIGH" | "MEDIUM" | "LOW"
  sugestoes: MatchSugestao[]      // top 3 candidatos
  erpPareado?: EntradaConciliacao  // se casado
  diferencaValor?: number         // diferença absoluta entre ERP e extrato
  autoConfirmado: boolean         // para auditoria (auto vs manual) — só no Excel
  requerDecisaoManual?: boolean   // ênfase visual na revisão (ex-AMBIGUO)
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

/** Verifica se duas datas são o mesmo dia de calendário */
function mesmaData(a: Date, b: Date): boolean {
  return a.toISOString().split("T")[0] === b.toISOString().split("T")[0]
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
export function similaridadeHibrida(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  const t = tokenSimilarity(na, nb)
  const tri = trigramSimilarity(na, nb)
  const lev = levenshteinSimilarity(na, nb)
  return t * 0.4 + tri * 0.4 + lev * 0.2
}

// ========== SCORE INDIVIDUAL ==========

export function scoreValor(v1: number, v2: number): number {
  const diff = Math.abs(v1 - v2)
  if (diff < 0.01) return 50
  const max = Math.max(v1, v2)
  const pct = max === 0 ? 1 : diff / max
  if (pct <= 0.005) return 45 // 0,5% de diferença
  if (pct <= 0.01) return 40  // 1% de diferença
  if (pct <= 0.02) return 30  // 2% de diferença
  if (pct <= 0.05) return 15  // 5% de diferença
  return 0
}

export function scoreData(d1: Date, d2: Date): number {
  const diffMs = Math.abs(d1.getTime() - d2.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays <= 0) return 10
  if (diffDays <= 3) return 10
  if (diffDays <= 7) return 5
  return 0
}

export function scoreDescricao(d1: string, d2: string): number {
  const sim = similaridadeHibrida(d1, d2)
  return Math.round(sim * 25)
}

export function scoreFornecedor(fornecedorErp: string | null | undefined, descricaoExtrato: string | null | undefined): number {
  const fornecedor = fornecedorErp || ""
  const descricao = descricaoExtrato || ""
  if (!fornecedor || !descricao) return 0
  
  // Tentar encontrar fornecedor na descrição do extrato
  const descricaoNorm = descricao.toUpperCase()
  const fornecedorNorm = fornecedor.toUpperCase()
  
  // Se fornecedor está contido na descrição
  if (descricaoNorm.includes(fornecedorNorm)) {
    return 15
  }
  
  // Similaridade parcial
  const sim = similaridadeHibrida(fornecedor, descricao)
  return Math.round(sim * 15)
}

// Mapeamento de abreviações de banco
const MAPEAMENTO_BANCO: Record<string, string> = {
  "BB": "BANCO DO BRASIL",
  "ITAU": "ITAÚ",
  "NUBANK": "NUBANK",
  "INTER": "BANCO INTER",
  "SANTANDER": "SANTANDER",
  "BRADESCO": "BRADESCO",
  "CAIXA": "CAIXA ECONOMICA FEDERAL",
  "HSBC": "HSBC",
  "CITIBANK": "CITIBANK",
  "BANCO DO BRASIL": "BANCO DO BRASIL",
  "ITAÚ": "ITAÚ",
  "BANCO INTER": "BANCO INTER",
  "CAIXA ECONÔMICA FEDERAL": "CAIXA ECONOMICA FEDERAL",
  "CAIXA ECONOMICA": "CAIXA ECONOMICA FEDERAL",
}

export function normalizarBanco(banco: string): string {
  // Aplicar mapeamento de abreviações
  const bancoMapeado = MAPEAMENTO_BANCO[banco.toUpperCase()] || banco
  
  // Remover acentos
  const semAcentos = bancoMapeado.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // Converter para maiúsculas
  const maiusculas = semAcentos.toUpperCase()
  
  // Remover espaços extras
  const semEspacosExtras = maiusculas.trim().replace(/\s+/g, ' ')
  
  // Remover caracteres especiais (manter apenas letras, números e espaços)
  const semEspeciais = semEspacosExtras.replace(/[^A-Z0-9\s]/g, '')
  
  // Remover palavras comuns
  const palavrasComuns = ["BANCO", "S.A.", "S A", "LTDA", "ECONOMICA", "FEDERAL", "ECONÔMICA"]
  let resultado = semEspeciais
  palavrasComuns.forEach(palavra => {
    resultado = resultado.replace(new RegExp(`\\b${palavra}\\b`, 'g'), '')
  })
  
  // Remover espaços extras novamente após remoção de palavras
  return resultado.trim().replace(/\s+/g, ' ')
}

export function scoreBanco(bancoErp: string | null | undefined, bancoExtrato: string | null | undefined): number {
  const banco1 = bancoErp || ""
  const banco2 = bancoExtrato || ""
  if (!banco1 || !banco2) return 0
  
  // Normalizar ambos os bancos
  const banco1Norm = normalizarBanco(banco1)
  const banco2Norm = normalizarBanco(banco2)
  
  if (!banco1Norm || !banco2Norm) return 0
  
  // Se bancos normalizados são idênticos
  if (banco1Norm === banco2Norm) {
    return 20
  }
  
  // Similaridade parcial
  const sim = similaridadeHibrida(banco1Norm, banco2Norm)
  return Math.round(sim * 20)
}

// ========== PRÉ-FILTRO ==========

export function passaPreFiltro(erp: EntradaConciliacao, extrato: EntradaConciliacao): boolean {
  // Tipo igual
  if (erp.tipo !== extrato.tipo) return false
  // Valor aproximado (<= 5%)
  const maxVal = Math.max(erp.valor, extrato.valor)
  if (maxVal > 0 && Math.abs(erp.valor - extrato.valor) / maxVal > 0.05) return false
  // Data próxima (<= 7 dias) - filtro organizacional
  const diffDays = Math.abs(erp.data.getTime() - extrato.data.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 7) return false
  return true
}

// ========== AGRUPAMENTO POR DIA ==========

function agruparPorDia(entradas: EntradaConciliacao[]): Map<string, EntradaConciliacao[]> {
  const grupos = new Map<string, EntradaConciliacao[]>()
  for (const entrada of entradas) {
    const dataKey = entrada.data.toISOString().split('T')[0] // YYYY-MM-DD
    if (!grupos.has(dataKey)) {
      grupos.set(dataKey, [])
    }
    grupos.get(dataKey)!.push(entrada)
  }
  return grupos
}

// ========== GERAÇÃO DE EXPLICAÇÕES ==========

export function gerarExplicacoes(sd: ScoreDetalhado): string[] {
  const exps: string[] = []
  if (sd.valor >= 50) exps.push("Valor idêntico")
  else if (sd.valor >= 45) exps.push("Valor muito próximo (≤ 0,5%)")
  else if (sd.valor >= 40) exps.push("Valor muito próximo (≤ 1%)")
  else if (sd.valor >= 30) exps.push("Valor aproximado (≤ 2%)")
  else if (sd.valor >= 15) exps.push("Valor aproximado (≤ 5%)")

  if (sd.data >= 10) exps.push("Data próxima (≤ 3 dias)")
  else if (sd.data >= 5) exps.push("Data próxima (≤ 7 dias)")
  else if (sd.data > 0) exps.push("Data próxima")

  if (sd.descricao >= 22) exps.push(`Descrição muito similar (${Math.round((sd.descricao / 25) * 100)}%)`)
  else if (sd.descricao >= 18) exps.push(`Descrição similar (${Math.round((sd.descricao / 25) * 100)}%)`)
  else if (sd.descricao > 0) exps.push(`Descrição parcialmente similar (${Math.round((sd.descricao / 25) * 100)}%)`)

  if (sd.fornecedor >= 12) exps.push(`Fornecedor muito similar (${Math.round((sd.fornecedor / 15) * 100)}%)`)
  else if (sd.fornecedor >= 9) exps.push(`Fornecedor similar (${Math.round((sd.fornecedor / 15) * 100)}%)`)
  else if (sd.fornecedor > 0) exps.push(`Fornecedor parcialmente similar (${Math.round((sd.fornecedor / 15) * 100)}%)`)

  if (sd.banco >= 20) exps.push("Banco idêntico")
  else if (sd.banco >= 15) exps.push(`Banco muito similar (${Math.round((sd.banco / 20) * 100)}%)`)
  else if (sd.banco >= 10) exps.push(`Banco similar (${Math.round((sd.banco / 20) * 100)}%)`)
  else if (sd.banco > 0) exps.push(`Banco parcialmente similar (${Math.round((sd.banco / 20) * 100)}%)`)

  return exps
}

export function calcularConfianca(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 90) return "HIGH"
  if (score >= 70) return "MEDIUM"
  return "LOW"
}

// ========== ALGORITMO PRINCIPAL ==========

export function gerarSugestoes(
  erpEntradas: EntradaConciliacao[],
  extratoEntradas: EntradaConciliacao[]
): ResultadoMatching {
  // Fase 0: Agrupar por dia para otimizar matching
  const erpPorDia = agruparPorDia(erpEntradas)
  const extratoPorDia = agruparPorDia(extratoEntradas)

  // Fase 1: Gerar TODOS os candidatos (com pré-filtro)
  interface Candidato {
    extratoId: string
    erpId: string
    score: number
    scoreDetalhado: ScoreDetalhado
    explicacoes: string[]
    confianca: "HIGH" | "MEDIUM" | "LOW"
    autoConfirmado: boolean
    requerConferencia: boolean
  }

  const candidatos: Candidato[] = []

  // Comparar primeiro dentro do mesmo dia, depois expandir para dias próximos
  for (const [dataExtrato, extratosDoDia] of extratoPorDia) {
    // Primeiro: tentar match no mesmo dia
    const erpsMesmoDia = erpPorDia.get(dataExtrato) || []
    for (const extrato of extratosDoDia) {
      for (const erp of erpsMesmoDia) {
        if (!passaPreFiltro(erp, extrato)) continue

        const sv = scoreValor(erp.valor, extrato.valor)
        const sd = scoreData(erp.data, extrato.data)
        const sdesc = scoreDescricao(erp.descricao, extrato.descricao)
        const sforn = scoreFornecedor(erp.fornecedor, extrato.descricao)
        const sbanc = scoreBanco(erp.banco, extrato.banco)

        const scoreDetalhado: ScoreDetalhado = {
          valor: sv,
          tipo: 0, // tipo é pré-filtro, não soma no score
          data: sd,
          descricao: sdesc,
          fornecedor: sforn,
          banco: sbanc
        }

        const score = sv + sd + sdesc + sforn + sbanc // valor + data + descrição + fornecedor + banco (total 120)
        if (score < 20) continue // muito fraco, descarta

        const explicacoes = gerarExplicacoes(scoreDetalhado)
        const confianca = calcularConfianca(score)
        
        // Nova heurística de auto-confirmação:
        // Atalho núcleo forte: valor ≤1% + descrição ≥60% + data no DIA EXATO
        // → se fornecedor/banco também baterem: CONCILIADO (auto)
        // → se fornecedor/banco divergirem: A_REVISAR (não é rejeitado)
        // Fallback (dias ±1..7): mantém regra rígida atual
        const temFornecedor = !!erp.fornecedor
        const temBanco = !!erp.banco
        const fornecedorOk = !temFornecedor || sforn >= 10
        const bancoOk = !temBanco || sbanc >= 15
        const dataExata = mesmaData(erp.data, extrato.data)
        const nucleoForte = sv >= 40 && sdesc >= 15

        const atalho = nucleoForte && dataExata
        const regraRigida = score >= 50 && sv >= 40 && sdesc >= 15 && sd >= 5 && fornecedorOk && bancoOk

        // Auto-confirma: atalho completo (com fornecedor/banco) OU regra rígida
        const autoConfirmado = (atalho && fornecedorOk && bancoOk) || regraRigida
        // Marca para conferência quando atalho bate mas fornecedor/banco divergem
        const requerConferencia = atalho && (!fornecedorOk || !bancoOk)

        candidatos.push({
          extratoId: extrato.id,
          erpId: erp.id,
          score,
          scoreDetalhado,
          explicacoes,
          confianca,
          autoConfirmado,
          requerConferencia
        })
      }
    }

    // Segundo: se não encontrou match no mesmo dia, tentar dias próximos (±7 dias)
    const dataExtratoDate = new Date(dataExtrato)
    for (let offset = -7; offset <= 7; offset++) {
      if (offset === 0) continue // já verificado
      const dataOffset = new Date(dataExtratoDate)
      dataOffset.setDate(dataOffset.getDate() + offset)
      const dataOffsetKey = dataOffset.toISOString().split('T')[0]
      const erpsDiaOffset = erpPorDia.get(dataOffsetKey) || []

      for (const extrato of extratosDoDia) {
        // Verificar se já tem candidato bom para este extrato
        const jaTemCandidatoBom = candidatos.some(c => 
          c.extratoId === extrato.id && c.score >= 70
        )
        if (jaTemCandidatoBom) continue

        for (const erp of erpsDiaOffset) {
          if (!passaPreFiltro(erp, extrato)) continue

          const sv = scoreValor(erp.valor, extrato.valor)
          const sd = scoreData(erp.data, extrato.data)
          const sdesc = scoreDescricao(erp.descricao, extrato.descricao)
          const sforn = scoreFornecedor(erp.fornecedor, extrato.descricao)
          const sbanc = scoreBanco(erp.banco, extrato.banco)

          const scoreDetalhado: ScoreDetalhado = {
            valor: sv,
            tipo: 0,
            data: sd,
            descricao: sdesc,
            fornecedor: sforn,
            banco: sbanc
          }

          const score = sv + sd + sdesc + sforn + sbanc // valor + data + descrição + fornecedor + banco (total 120)
          if (score < 20) continue

          const explicacoes = gerarExplicacoes(scoreDetalhado)
          const confianca = calcularConfianca(score)
          
          // Nova heurística de auto-confirmação (fallback para dias ±1..7)
          const temFornecedor = !!erp.fornecedor
          const temBanco = !!erp.banco
          const fornecedorOk = !temFornecedor || sforn >= 10
          const bancoOk = !temBanco || sbanc >= 15
          const dataExata = mesmaData(erp.data, extrato.data)
          const nucleoForte = sv >= 40 && sdesc >= 15

          const atalho = nucleoForte && dataExata
          const regraRigida = score >= 50 && sv >= 40 && sdesc >= 15 && sd >= 5 && fornecedorOk && bancoOk

          const autoConfirmado = (atalho && fornecedorOk && bancoOk) || regraRigida
          const requerConferencia = atalho && (!fornecedorOk || !bancoOk)

          candidatos.push({
            extratoId: extrato.id,
            erpId: erp.id,
            score,
            scoreDetalhado,
            explicacoes,
            confianca,
            autoConfirmado,
            requerConferencia
          })
        }
      }
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
        status: "CONCILIADO",
        confianca: "HIGH",
        sugestoes: sugestoes.slice(0, 3),
        erpPareado: erp,
        diferencaValor: diffValor,
        autoConfirmado: true
      })
    } else if (match) {
      const erp = erpEntradas.find(e => e.id === match.erpId)!
      const diffValor = Math.abs(erp.valor - extrato.valor)

      // Se o atalho bateu mas fornecedor/banco divergiram → A revisar com ênfase
      const requerDecisaoManual = match.requerConferencia

      if (requerDecisaoManual) {
        // Adiciona explicação de aviso
        const exps = [...match.explicacoes]
        exps.push("⚠ Conferir: fornecedor/banco divergente")
        match.explicacoes = exps
      }

      itens.push({
        extrato,
        status: "A_REVISAR",
        confianca: calcularConfianca(match.score),
        sugestoes: sugestoes.slice(0, 3),
        erpPareado: erp,
        diferencaValor: diffValor,
        autoConfirmado: false,
        requerDecisaoManual
      })
    } else {
      itens.push({
        extrato,
        status: "NAO_CONCILIADO",
        confianca: "LOW",
        sugestoes: [],
        autoConfirmado: false
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
