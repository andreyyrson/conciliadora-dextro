import { detectarBanco } from "./detectar-banco"

interface ContaErp {
  banco: string | null
}

function normalizar(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function removerExtensao(nome: string): string {
  return nome.replace(/\.[^/.]+$/, "")
}

function calcularScore(nomeArquivoNormalizado: string, contaNormalizada: string): number {
  const palavrasArquivo = nomeArquivoNormalizado.split(" ")
  const palavrasConta = contaNormalizada.split(" ")

  let score = 0
  for (const palavra of palavrasArquivo) {
    if (palavra.length < 2) continue // Ignora palavras muito curtas
    if (palavrasConta.some(p => p.includes(palavra) || palavra.includes(p))) {
      score += palavra.length
    }
  }

  return score
}

/**
 * Encontra a conta ERP que melhor corresponde ao nome do arquivo de extrato.
 * Usa fuzzy matching comparando o nome do arquivo com a coluna 'banco' dos lançamentos ERP.
 *
 * Exemplo:
 *   nomeArquivo: "extrato_blu_umarizal.csv"
 *   contasErp: [{ banco: "Banco Blu - Umarizal" }, { banco: "Itaú - SP" }]
 *   retorna: "Banco Blu - Umarizal"
 */
export function encontrarContaPorNomeArquivo(
  nomeArquivo: string,
  contasErp: ContaErp[]
): string | null {
  const bancoDetectado = detectarBanco(nomeArquivo)
  if (!bancoDetectado) return null

  const nomeSemExtensao = removerExtensao(nomeArquivo)
  const nomeNormalizado = normalizar(nomeSemExtensao)
  const bancoNormalizado = normalizar(bancoDetectado)

  // Remove o nome do banco do nome do arquivo para isolar o identificador
  const nomeSemBanco = nomeNormalizado
    .replace(new RegExp(`\\b${bancoNormalizado}\\b`, "g"), "")
    .replace(/\s+/g, " ")
    .trim()

  let melhorScore = 0
  let melhorConta: string | null = null
  const threshold = 3 // Score mínimo para considerar match

  const contasUnicas = new Set<string>()
  for (const conta of contasErp) {
    if (conta.banco) contasUnicas.add(conta.banco)
  }

  for (const conta of contasUnicas) {
    const contaNormalizada = normalizar(conta)

    // Verifica se a conta contém o banco detectado
    if (!contaNormalizada.includes(bancoNormalizado)) continue

    // Calcula score baseado em quantas palavras do nome do arquivo (sem o banco)
    // estão presentes na conta
    const score = calcularScore(nomeSemBanco, contaNormalizada)

    if (score > melhorScore && score >= threshold) {
      melhorScore = score
      melhorConta = conta
    }
  }

  return melhorConta
}

/**
 * Versão simplificada que retorna apenas o banco detectado
 * quando não encontra conta específica.
 */
export function resolverBancoParaImportacao(
  nomeArquivo: string,
  contasErp: ContaErp[]
): string | null {
  const contaEspecifica = encontrarContaPorNomeArquivo(nomeArquivo, contasErp)
  if (contaEspecifica) return contaEspecifica

  return detectarBanco(nomeArquivo)
}
