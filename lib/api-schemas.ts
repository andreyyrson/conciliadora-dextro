import { z } from "zod"

export const empresaIdParam = z.string().min(1, "empresaId é obrigatório")
export const idParam = z.string().min(1, "id é obrigatório")

export const aprovarBody = z.object({
  empresaId: z.string().min(1),
  dataDia: z.string().min(1),
  justificativa: z.string().optional(),
})

export const reprovarBody = z.object({
  empresaId: z.string().min(1),
  dataDia: z.string().min(1),
  justificativa: z.string().min(1, "Justificativa é obrigatória para reprovação"),
})

export const revisarBody = z.object({
  empresaId: z.string().min(1),
  dataDia: z.string().min(1),
  justificativa: z.string().optional(),
})

export const aprovarLancamentoBody = z.object({
  empresaId: z.string().min(1),
  dataDia: z.string().min(1),
  extratoId: z.string().min(1),
  justificativa: z.string().optional(),
})

export const reprovarLancamentoBody = z.object({
  empresaId: z.string().min(1),
  dataDia: z.string().min(1),
  extratoId: z.string().min(1),
  justificativa: z.string().min(1, "Justificativa é obrigatória para reprovação"),
})

export const rodarBody = z.object({
  empresaId: z.string().min(1),
  dataInicio: z.string().min(1),
  dataFim: z.string().min(1),
})

export const aceitarDivergentesBody = z.object({
  empresaId: z.string().min(1),
  itens: z.array(
    z.object({
      erpId: z.string().optional(),
      extratoId: z.string().optional(),
      extratoImportadoId: z.string().optional(),
    })
  ).min(1, "Selecione pelo menos um item"),
})

export const empresaBody = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
})

export const contaBody = z.object({
  empresaId: z.string().min(1),
  banco: z.string().min(1, "Banco é obrigatório"),
  agencia: z.string().optional(),
  conta: z.string().min(1, "Conta é obrigatória"),
})

export const erpLancamentoPatch = z.object({
  data: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().optional(),
  tipo: z.string().optional(),
  documento: z.string().optional().nullable(),
  fornecedor: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  centroCusto: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
})

export const extratoLancamentoPatch = z.object({
  data: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().optional(),
  tipo: z.string().optional(),
  identificador: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  saldoApos: z.number().optional().nullable(),
})
