export interface EntradaConciliacao {
  id: string
  origem: "ERP" | "EXTRATO"
  data: Date
  valor: number
  tipo: "CREDITO" | "DEBITO"
  descricao: string
  documento?: string
  fornecedor?: string
  categoria?: string
  banco?: string
  identificador?: string
  arquivoUpload?: string
}

export interface ResultadoMatchingItem {
  erp: EntradaConciliacao | null
  extrato: EntradaConciliacao | null
  status: "CONCILIADO" | "A_REVISAR"
}

export interface ResultadoMatching {
  itens: ResultadoMatchingItem[]
  erpsSobrando: EntradaConciliacao[]
  extratosSobrando: EntradaConciliacao[]
}

function normalizeDescricao(s?: string | null): string {
  if (!s) return ""
  const noAccents = s.normalize("NFD").replace(/\p{Diacritic}+/gu, "")
  return noAccents.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}

function tokenSet(str: string): Set<string> {
  return new Set(str.split(" ").filter(t => t.length >= 3))
}

function jaccardSimilarity(a: string, b: string): number {
  const A = tokenSet(a)
  const B = tokenSet(b)
  if (A.size === 0 && B.size === 0) return 1
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const uni = A.size + B.size - inter
  return uni === 0 ? 0 : inter / uni
}

function descricaoParecida(a: string, b: string): boolean {
  if (!a || !b) return false
  // match se inclusão direta com comprimento mínimo
  if (a.length >= 8 && b.includes(a)) return true
  if (b.length >= 8 && a.includes(b)) return true
  // ou similaridade de Jaccard por tokens
  return jaccardSimilarity(a, b) >= 0.6
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getUTCFullYear() === d2.getUTCFullYear() && d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCDate() === d2.getUTCDate()
}

function isNextBusinessDay(d1: Date, d2: Date): boolean {
  // true se d2 é o próximo dia útil após d1 (somente para frente)
  const next = new Date(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate() + 1))
  // se sábado (6), pular para segunda (+2 dias); se domingo (0), pular para segunda (+1 dia)
  const wd = next.getUTCDay()
  if (wd === 6) next.setUTCDate(next.getUTCDate() + 2)
  else if (wd === 0) next.setUTCDate(next.getUTCDate() + 1)
  return isSameDay(next, d2)
}

function valorIgual(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol
}

export function gerarSugestoesComparativo(
  erps: EntradaConciliacao[],
  extratos: EntradaConciliacao[],
  options?: { arquivoQuery?: string }
): ResultadoMatching {
  const usadosExtrato = new Set<string>()
  const itens: ResultadoMatchingItem[] = []

  // Índices por dia (YYYY-MM-DD) para limitar busca
  const byDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
  const extByKey = new Map<string, EntradaConciliacao[]>()
  for (const ex of extratos) {
    const k0 = byDate(ex.data)
    const k1 = `NBD:${k0}` // marcador para matching D+1 útil será calculado dinamicamente
    if (!extByKey.has(k0)) extByKey.set(k0, [])
    extByKey.get(k0)!.push(ex)
    // Não indexamos NBD aqui; vamos calcular por ERP
  }

  for (const erp of erps) {
    // Candidatos: mesma data (D+0) e próximo dia útil (D+1 útil)
    const keyD0 = byDate(erp.data)
    const d1 = new Date(Date.UTC(erp.data.getUTCFullYear(), erp.data.getUTCMonth(), erp.data.getUTCDate() + 1))
    const wd = d1.getUTCDay()
    if (wd === 6) d1.setUTCDate(d1.getUTCDate() + 2)
    else if (wd === 0) d1.setUTCDate(d1.getUTCDate() + 1)
    const keyD1 = byDate(d1)

    const candidatos = [
      ...(extByKey.get(keyD0) || []),
      ...(extByKey.get(keyD1) || []),
    ].filter(ex => ex.tipo === erp.tipo && !usadosExtrato.has(ex.id))

    let best: { ex: EntradaConciliacao; score: number; three: boolean } | null = null
    const normErp = normalizeDescricao(erp.descricao)
    for (const ex of candidatos) {
      const normEx = normalizeDescricao(ex.descricao)
      const mValor = valorIgual(erp.valor, ex.valor) ? 1 : 0
      const mData = isSameDay(erp.data, ex.data) || isNextBusinessDay(erp.data, ex.data) ? 1 : 0
      const mDesc = normErp.length > 0 && descricaoParecida(normErp, normEx) ? 1 : 0
      const baseScore = mValor + mData + mDesc
      if (baseScore < 2) continue
      const three = baseScore === 3
      // bônus pequeno de desempate se arquivoUpload corresponder parcialmente ao filtro informado
      const arquivoBonus = options?.arquivoQuery && ex.arquivoUpload && (
        ex.arquivoUpload.includes(options.arquivoQuery) || ex.arquivoUpload.startsWith(options.arquivoQuery)
      ) ? 0.2 : 0
      const score = baseScore + arquivoBonus
      if (!best || (three && !best.three) || (three === best.three && (score > best.score || (score === best.score && Math.abs(erp.valor - ex.valor) < Math.abs(erp.valor - best.ex.valor))))) {
        best = { ex, score, three }
      }
    }

    if (best) {
      usadosExtrato.add(best.ex.id)
      itens.push({ erp, extrato: best.ex, status: best.three ? "CONCILIADO" : "A_REVISAR" })
    }
  }

  const usadosSet = usadosExtrato
  const erpIdsPareados = new Set(itens.map(i => i.erp!.id))
  const erpsSobrando = erps.filter(e => !erpIdsPareados.has(e.id))
  const extratosSobrando = extratos.filter(e => !usadosSet.has(e.id))

  return { itens, erpsSobrando, extratosSobrando }
}

export interface ErpTransaction {
  id: string
  data: Date
  descricao: string
  valor: number
  tipo: string
  documento: string | null
  fornecedor: string | null
  banco: string | null
  categoria: string | null
}

export interface ExtratoTransaction {
  id: string
  origem: "EXTRATO" | "EXTRATO_IMPORTADO"
  data: Date
  descricao: string
  valor: number
  tipo: string
  saldoApos: number | null
  identificador: string | null
  banco: string | null
  arquivoUpload?: string | null
}

export interface DiaConciliacao {
  data: string
  totalDebitoErp: number
  totalCreditoErp: number
  totalDebitoExtrato: number
  totalCreditoExtrato: number
  saldoFinalErp: number
  saldoFinalExtrato: number
  saldoAposBanco: number | null
  transacoesErp: ErpTransaction[]
  transacoesExtrato: ExtratoTransaction[]
  statusDia: "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO" | "SEM_DADOS"
  qtdErp: number
  qtdExtrato: number
  matches: MatchSummary
  diferencaDebito: number
  diferencaCredito: number
}

export interface MatchSummary {
  conciliados: number
  aRevisar: number
  naoConciliados: number
  erpsSobrando: number
  detalhes: MatchDetail[]
  erpsSobrandoDetalhes: { id: string; descricao: string; valor: number; tipo: string; banco?: string }[]
}

export interface MatchDetail {
  extratoId: string
  extratoDescricao: string
  extratoValor: number
  status: string
  confianca: string
  score: number
  erpPareado: {
    id: string
    descricao: string
    valor: number
  } | null
  diferencaValor: number | undefined
  explicacoes: string[]
}
