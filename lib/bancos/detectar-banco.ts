/**
 * Detecta o nome do banco brasileiro a partir do nome de um arquivo de extrato.
 * Normaliza o nome do arquivo (remove extensão, underscores, hífens, pontos,
 * remove acentos, converte para minúsculas) e busca por sinônimos de bancos.
 */

export const BANCOS_CONHECIDOS: Record<string, string[]> = {
  "Itaú": ["itau", "banco itau"],
  "Bradesco": ["bradesco", "banco bradesco"],
  "Santander": ["santander", "banco santander"],
  "Banco do Brasil": ["banco do brasil", "bb", "banco brasil"],
  "Caixa Econômica Federal": ["caixa", "caixa economica", "cef", "caixa economica federal"],
  "Nubank": ["nubank", "nu bank"],
  "Inter": ["inter", "banco inter"],
  "Safra": ["safra", "banco safra"],
  "Original": ["original", "banco original"],
  "C6 Bank": ["c6", "c6 bank"],
  "Neon": ["neon", "banco neon"],
}

function removerAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizarNomeArquivo(nome: string): string {
  // Remove extensão
  const semExtensao = nome.replace(/\.[^/.]+$/, "")
  // Substitui underscores, hífens, pontos por espaços
  const comEspacos = semExtensao.replace(/[_\-.]/g, " ")
  // Remove acentos, converte para minúsculas, remove múltiplos espaços
  return removerAcentos(comEspacos).toLowerCase().replace(/\s+/g, " ").trim()
}

export function detectarBanco(nomeArquivo: string): string | null {
  const normalizado = normalizarNomeArquivo(nomeArquivo)
  if (!normalizado) return null

  // Ordena sinônimos por comprimento decrescente para evitar match parcial
  // (ex: "bb" deve ser verificado antes de "banco brasil" para evitar match errado)
  const entradas = Object.entries(BANCOS_CONHECIDOS).flatMap(([nomeBanco, sinonimos]) =>
    sinonimos.map(s => ({ nomeBanco, sinonimo: s }))
  )
  entradas.sort((a, b) => b.sinonimo.length - a.sinonimo.length)

  for (const { nomeBanco, sinonimo } of entradas) {
    if (normalizado.includes(sinonimo)) {
      return nomeBanco
    }
  }

  return null
}
