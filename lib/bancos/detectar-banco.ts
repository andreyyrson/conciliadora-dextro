/**
 * Detecta o nome do banco brasileiro a partir do nome de um arquivo de extrato.
 * Normaliza o nome do arquivo (remove extensão, underscores, hífens, pontos,
 * remove acentos, converte para minúsculas) e busca por sinônimos de bancos.
 */

export const BANCOS_CONHECIDOS: Record<string, string[]> = {
  // Grandes bancos tradicionais
  "Itaú": ["itau", "banco itau", "itaú unibanco", "itau unibanco", "itau sa"],
  "Bradesco": ["bradesco", "banco bradesco", "bradesco sa"],
  "Santander": ["santander", "banco santander", "santander brasil"],
  "Banco do Brasil": ["banco do brasil", "bb", "banco brasil", "banco do brasil sa"],
  "Caixa Econômica Federal": ["caixa", "caixa economica", "cef", "caixa economica federal", "caixa ecf", "caixa geral"],

  // Bancos digitais / neobancos
  "Nubank": ["nubank", "nu bank", "nu pagamentos", "nubank sa"],
  "Inter": ["inter", "banco inter", "intermedium", "inter medium", "banco intermedium"],
  "Safra": ["safra", "banco safra", "safra sa"],
  "Original": ["original", "banco original", "original sa"],
  "C6 Bank": ["c6", "c6 bank", "c6bank", "c6 institutional"],
  "Neon": ["neon", "banco neon", "neon pagamentos", "neon sa"],
  "Next": ["next", "banco next", "next itau", "next by bradesco", "next bb"],
  "Will": ["will", "will bank", "banco will", "willbank"],
  "Digio": ["digio", "banco digio", "digio sa", "digio bsb"],
  "PicPay": ["picpay", "pic pay", "banco picpay", "picpay sa"],
  "Mercado Pago": ["mercado pago", "mercadopago", "mercado pago sa", "mercado livre"],
  "PagBank": ["pagbank", "pag bank", "pagseguro", "pag seguro", "banco pagseguro"],
  "Ame Digital": ["ame", "ame digital", "banco ame", "ame sa"],
  "BS2": ["bs2", "banco bs2", "bs2 sa", "banco bic"],
  "Banco PAN": ["banco pan", "pan", "banco panamericano", "panamericano"],
  "Banco BMG": ["bmg", "banco bmg", "bmg sa"],
  "Superdigital": ["superdigital", "super digital", "banco superdigital"],
  "Agibank": ["agibank", "agi bank", "banco agi", "agi sa"],
  "Banco Blu": ["blu", "banco blu", "blu sa", "blu digital"],
  "Banco Wiz": ["wiz", "banco wiz", "wiz sa"],
  "Banco Vindi": ["vindi", "banco vindi", "vindi sa"],
  "Banco Zippi": ["zippi", "banco zippi", "zippi sa"],
  "Banco Crefisa": ["crefisa", "banco crefisa", "crefisa sa"],
  "Banco Geru": ["geru", "banco geru", "geru sa"],
  "Banco Simplic": ["simplic", "banco simplic", "simplic sa"],
  "Banco Noverde": ["noverde", "banco noverde", "noverde sa"],
  "Banco Creditas": ["creditas", "banco creditas", "creditas sa"],
  "Banco OpenCo": ["openco", "banco openco", "openco sa"],
  "Banco Dock": ["dock", "banco dock", "dock sa"],
  "Banco Pismo": ["pismo", "banco pismo", "pismo sa"],
  "Banco QI": ["qi", "banco qi", "qi tech", "qi sa"],
  "Banco Arbi": ["arbi", "banco arbi", "arbi sa"],
  "Banco Fair": ["fair", "banco fair", "fair sa"],
  "Banco Bexs": ["bexs", "banco bexs", "bexs sa"],
  "Banco ABC": ["abc", "banco abc", "abc sa"],
  "Banco D+": ["d+", "d mais", "banco d mais", "dplus"],
  "Banco Lev": ["lev", "banco lev", "lev sa"],
  "Banco Flow": ["flow", "banco flow", "flow sa"],
  "Banco Zetta": ["zetta", "banco zetta", "zetta sa"],
  "Banco B4": ["b4", "banco b4", "b4 sa"],
  "Banco Yape": ["yape", "banco yape", "yape sa"],
  "Banco Noh": ["noh", "banco noh", "noh sa"],
  "Banco Sinqia": ["sinqia", "banco sinqia", "sinqia sa"],
  "Banco Tino": ["tino", "banco tino", "tino sa"],
  "Banco Lofty": ["lofty", "banco lofty", "lofty sa"],
  "Banco Warren": ["warren", "banco warren", "warren sa"],
  "Banco Modalmais": ["modalmais", "modal mais", "banco modalmais"],
  "Banco Clear": ["clear", "banco clear", "clear sa"],
  "Banco Trip": ["trip", "banco trip", "trip sa"],
  "Banco Orama": ["orama", "banco orama", "orama sa"],
  "Banco Toro": ["toro", "banco toro", "toro sa"],
  "Banco Magnetis": ["magnetis", "banco magnetis", "magnetis sa"],
  "Banco Suno": ["suno", "banco suno", "suno sa"],
  "Banco Meson": ["meson", "banco meson", "meson sa"],
  "Banco Capitania": ["capitania", "banco capitania", "capitania sa"],
  "Banco Finago": ["finago", "banco finago", "finago sa"],
  "Banco Sora": ["sora", "banco sora", "sora sa"],
  "Banco Caju": ["caju", "banco caju", "caju sa"],
  "Banco Flash": ["flash", "banco flash", "flash sa"],
  "Banco Gocap": ["gocap", "banco gocap", "gocap sa"],
  "Banco Infracap": ["infracap", "banco infracap", "infracap sa"],
  "Banco Qenta": ["qenta", "banco qenta", "qenta sa"],
  "Banco R2": ["r2", "banco r2", "r2 sa"],
  "Banco Uau": ["uau", "banco uau", "uau sa"],
  "Banco Vivara": ["vivara", "banco vivara", "vivara sa"],

  // Bancos de investimento / varejo premium
  "BTG Pactual": ["btg", "btg pactual", "banco btg", "btg sa", "btg pactual sa"],
  "XP Investimentos": ["xp", "xp investimentos", "banco xp", "xp sa", "xp inc"],
  "Modal": ["modal", "banco modal", "modal sa", "banco modal sa"],
  "Rico": ["rico", "banco rico", "rico investimentos"],
  "Guide": ["guide", "guide investimentos", "banco guide"],
  "Easynvest": ["easynvest", "easy invest", "easyinvest", "banco easy"],
  "Genial": ["genial", "genial investimentos", "banco genial", "genial sa"],
  "Terra": ["terra", "terra investimentos", "banco terra"],

  // Bancos regionais
  "Banrisul": ["banrisul", "banco banrisul", "banco do rio grande do sul"],
  "Banestes": ["banestes", "banco banestes", "banestes sa"],
  "Banese": ["banese", "banco banese", "banco do estado de sergipe"],
  "Banpará": ["banpara", "banco banpara", "banco do para", "banco do estado do para"],
  "Banco da Amazônia": ["banco da amazonia", "amazonia", "basa", "banco da amazônia", "basa sa"],
  "Banco do Nordeste": ["banco do nordeste", "bnb", "banco do nordeste do brasil"],
  "Banco da Bahia": ["banco da bahia", "banco bahia"],
  "Banco Mercantil": ["mercantil", "banco mercantil", "mercantil do brasil", "mercantil sa"],
  "Banco Daycoval": ["daycoval", "banco daycoval", "daycoval sa"],
  "Banco Sofisa": ["sofisa", "banco sofisa", "sofisa sa"],
  "Banco Bonsucesso": ["bonsucesso", "banco bonsucesso", "bonsucesso sa"],
  "Banco Pine": ["pine", "banco pine", "pine sa"],
  "Banco Industrial": ["banco industrial", "banco industrial do brasil", "bib"],
  "Banco Cruzeiro do Sul": ["cruzeiro do sul", "banco cruzeiro do sul", "cruzeiro sul"],

  // Bancos de crédito / financeiras
  "Banco Semear": ["semear", "banco semear"],
  "Banco Alfa": ["alfa", "banco alfa", "alfa sa"],
  "Banco Rabobank": ["rabobank", "banco rabobank", "rabo bank"],
  "Banco Fator": ["fator", "banco fator", "fator sa"],
  "Banco Máxima": ["maxima", "banco maxima", "maxima sa"],
  "Banco Topázio": ["topazio", "banco topazio", "topazio sa"],
  "Banco Ourinvest": ["ourinvest", "banco ourinvest", "ourinvest sa"],
  "Banco Rendimento": ["rendimento", "banco rendimento", "rendimento sa"],
  "Banco Luso Brasileiro": ["luso", "banco luso", "luso brasileiro", "banco luso brasileiro"],

  // Cooperativas
  "Sicoob": ["sicoob", "sicoob sa", "cooperativa sicoob"],
  "Sicredi": ["sicredi", "sicredi sa", "cooperativa sicredi"],
  "Unicred": ["unicred", "unicred sa", "cooperativa unicred"],

  // Bancos de automóveis / leasing
  "Banco Toyota": ["toyota", "banco toyota", "toyota brasil"],
  "Banco Volkswagen": ["volkswagen", "vw", "banco volkswagen", "banco vw"],
  "Banco Mercedes-Benz": ["mercedes", "mercedes benz", "banco mercedes", "mercedes-benz"],
  "Banco Honda": ["honda", "banco honda", "honda brasil"],
  "Banco Hyundai": ["hyundai", "banco hyundai", "hyundai brasil"],
  "Banco BMW": ["bmw", "banco bmw", "bmw brasil"],
  "Banco CNH Capital": ["cnh", "banco cnh", "cnh capital", "cnh industrial"],
  "Banco Bradesco Financiamentos": ["bradesco financiamentos", "bradesco fin", "banco bradesco fin"],

  // Outros
  "Citibank": ["citi", "citibank", "banco citi", "citigroup"],
  "HSBC": ["hsbc", "hsbc brasil", "banco hsbc"],
  "Banco J.P. Morgan": ["jp morgan", "jpmorgan", "jpm", "banco jpmorgan"],
  "Banco Goldman Sachs": ["goldman", "goldman sachs", "banco goldman"],
  "Banco Morgan Stanley": ["morgan stanley", "banco morgan", "morgan sa"],
  "Banco Credit Suisse": ["credit suisse", "banco credit suisse", "cs sa"],
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

export function listarBancos(): string[] {
  return Object.keys(BANCOS_CONHECIDOS).sort()
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
