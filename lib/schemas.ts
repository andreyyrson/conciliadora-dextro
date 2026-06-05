import { z } from "zod"

// Schema para criação de empresa
export const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  cnpj: z.string().optional().nullable(),
})

// Schema para criação de usuário
export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().optional(),
})

// Schema para criação de conciliação
export const conciliacaoSchema = z.object({
  uploadId: z.string().min(1, "uploadId é obrigatório"),
  contaId: z.string().optional(),
  importacaoId: z.string().optional(),
  empresaId: z.string().min(1, "empresaId é obrigatório"),
})

// Schema para upload de arquivo
export const uploadSchema = z.object({
  empresaId: z.string().min(1, "empresaId é obrigatório"),
})
