"use client"

import { CheckCircle } from "lucide-react"
import { formatarValor, type MatchDia } from "./types"

interface MatchesDetalheProps {
  matches: MatchDia
}

export function MatchesDetalhe({ matches }: MatchesDetalheProps) {
  if (!matches || matches.detalhes.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <CheckCircle className="w-4 h-4" />
        Matching ({matches.conciliados} conciliados, {matches.aRevisar} a revisar, {matches.naoConciliados} não conciliados)
      </h4>
      <div className="space-y-2">
        {matches.detalhes.map((m) => {
          const confColor = m.confianca === "HIGH" ? "text-green-500" : m.confianca === "MEDIUM" ? "text-yellow-500" : "text-red-500"
          const statusLabel = m.status === "CONCILIADO" ? "Conciliado" : m.status === "A_REVISAR" ? "A revisar" : "Não conciliado"
          const statusBg = m.status === "CONCILIADO" ? "bg-green-500/10" : m.status === "A_REVISAR" ? "bg-yellow-500/10" : "bg-gray-500/10"

          return (
            <div key={m.extratoId} className={`p-3 rounded text-sm ${statusBg}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">
                    Extrato: {m.extratoDescricao} — R$ {formatarValor(m.extratoValor)}
                  </div>
                  {m.erpPareado && (
                    <div className="text-muted-foreground mt-1">
                      ERP: {m.erpPareado.descricao} — R$ {formatarValor(m.erpPareado.valor)}
                    </div>
                  )}
                  {m.diferencaValor !== undefined && m.diferencaValor > 0.01 && (
                    <div className="text-xs text-red-500 mt-1">
                      Diferença: R$ {formatarValor(m.diferencaValor)}
                    </div>
                  )}
                  {m.explicacoes.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.explicacoes.join(" • ")}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <div className={`font-semibold ${confColor}`}>{statusLabel}</div>
                  {m.score > 0 && (
                    <div className="text-xs text-muted-foreground">Score: {m.score}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {matches.erpsSobrando > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {matches.erpsSobrando} lançamento(s) ERP sem correspondência no extrato
        </div>
      )}
    </div>
  )
}
