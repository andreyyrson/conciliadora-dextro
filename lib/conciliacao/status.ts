/**
 * Taxonomia unificada de status de conciliação.
 * Na tela: 3 rótulos (Conciliado, A revisar, Não conciliado).
 * No banco: enum ConciliacaoItemStatus (AUTO_CONFIRMADO, CONFIRMADO_MANUAL, REJEITADO, SEM_MATCH).
 * No engine: status unificados + marcador interno autoConfirmado para auditoria no Excel.
 */

export type StatusUnificado = "CONCILIADO" | "A_REVISAR" | "NAO_CONCILIADO"

export const STATUS_LABEL: Record<StatusUnificado, string> = {
  CONCILIADO: "Conciliado",
  A_REVISAR: "A revisar",
  NAO_CONCILIADO: "Não conciliado"
}

export const STATUS_COLOR: Record<StatusUnificado, string> = {
  CONCILIADO: "text-success",
  A_REVISAR: "text-warning",
  NAO_CONCILIADO: "text-destructive"
}

export const STATUS_BG: Record<StatusUnificado, string> = {
  CONCILIADO: "bg-success/10",
  A_REVISAR: "bg-warning/10",
  NAO_CONCILIADO: "bg-destructive/10"
}

export const STATUS_BORDER: Record<StatusUnificado, string> = {
  CONCILIADO: "border-l-green-500",
  A_REVISAR: "border-l-yellow-500",
  NAO_CONCILIADO: "border-l-red-500"
}

export const STATUS_ICON: Record<StatusUnificado, "CheckCircle" | "AlertCircle" | "MinusCircle"> = {
  CONCILIADO: "CheckCircle",
  A_REVISAR: "AlertCircle",
  NAO_CONCILIADO: "MinusCircle"
}

/**
 * Mapeia status do engine (AUTO_CONFIRMADO, SUGERIDO, AMBIGUO, SEM_MATCH)
 * para status unificado da tela.
 */
export function engineStatusToUnificado(
  status: "AUTO_CONFIRMADO" | "SUGERIDO" | "AMBIGUO" | "SEM_MATCH"
): StatusUnificado {
  switch (status) {
    case "AUTO_CONFIRMADO":
      return "CONCILIADO"
    case "SUGERIDO":
    case "AMBIGUO":
      return "A_REVISAR"
    case "SEM_MATCH":
      return "NAO_CONCILIADO"
  }
}

/**
 * Mapeia status do banco (ConciliacaoItemStatus) para status unificado da tela.
 * Usa resolvidoManualmente para distinguir CONFIRMADO_MANUAL ainda não revisado.
 */
export function bancoStatusToUnificado(
  status: "AUTO_CONFIRMADO" | "CONFIRMADO_MANUAL" | "REJEITADO" | "SEM_MATCH",
  resolvidoManualmente?: boolean
): StatusUnificado {
  switch (status) {
    case "AUTO_CONFIRMADO":
      return "CONCILIADO"
    case "CONFIRMADO_MANUAL":
      // Se foi resolvido manualmente, é conciliado; senão, ainda está a revisar
      return resolvidoManualmente ? "CONCILIADO" : "A_REVISAR"
    case "REJEITADO":
    case "SEM_MATCH":
      return "NAO_CONCILIADO"
  }
}
