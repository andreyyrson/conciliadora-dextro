export interface ErpLancamento {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
  documento: string | null
  fornecedor: string | null
  categoria: string | null
  centroCusto: string | null
  banco: string | null
  upload?: { nomeArquivo: string; periodo: string }
}

export interface ExtratoLancamento {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
  identificador: string | null
  banco: string | null
  saldoApos: number | null
  importacao?: { nomeArquivo: string; tipo: string }
}

export interface LinhaComparativa {
  data: string
  erp: ErpLancamento | null
  extrato: ExtratoLancamento | null
  status: "match" | "divergente" | "sobra_erp" | "sobra_extrato"
}
