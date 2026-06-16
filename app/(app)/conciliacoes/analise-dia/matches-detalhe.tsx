"use client"

import React from "react"
import { CheckCircle } from "lucide-react"
import { formatarValor, type MatchDia } from "./types"
import { Button } from "@/components/ui/button"

interface MatchesDetalheProps {
  matches: MatchDia
  diaData?: string // yyyy-mm-dd
  onAfterAction?: () => void
}

export function MatchesDetalhe({ matches, diaData, onAfterAction }: MatchesDetalheProps) {
  if (!matches || matches.detalhes.length === 0) return null
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function completarCampoERP(
    erpId: string,
    campo: "descricao" | "valor" | "data",
    valorExtrato: string | number,
    valorErpAtual: string | number | null | undefined
  ) {
    // Regra: completar apenas se vazio; se houver valor, pedir confirmação para sobrescrever
    const isVazio = campo === "descricao"
      ? !valorErpAtual || String(valorErpAtual).trim() === ""
      : valorErpAtual === null || valorErpAtual === undefined

    if (!isVazio) {
      const confirma = window.confirm(
        `O campo ${campo} do ERP já possui um valor. Deseja sobrescrever com o valor do extrato?`
      )
      if (!confirma) return
    }

    const payload: any = {}
    if (campo === "data") {
      // valorExtrato deve ser yyyy-mm-dd
      payload.data = valorExtrato
    } else {
      payload[campo] = valorExtrato
    }

    const res = await fetch(`/api/erp/lancamentos/${erpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Falha ao completar ${campo}`)
    }
    setToast({ type: 'success', message: `${campo === 'data' ? 'Data' : campo === 'valor' ? 'Valor' : 'Descrição'} completado(a)` })
    onAfterAction?.()
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <CheckCircle className="w-4 h-4" />
        Matching ({matches.conciliados} conciliados, {matches.aRevisar} a revisar, {matches.naoConciliados} não conciliados)
      </h4>
      {toast && (
        <div className={`mb-2 text-xs px-2 py-1 rounded inline-block ${toast.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
          {toast.message}
        </div>
      )}
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
                <div className="text-right ml-4 min-w-[220px]">
                  <div className={`font-semibold ${confColor}`}>{statusLabel}</div>
                  {m.score > 0 && (
                    <div className="text-xs text-muted-foreground">Score: {m.score}</div>
                  )}
                  {m.erpPareado && (
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "descricao",
                              m.extratoDescricao,
                              m.erpPareado!.descricao
                            )
                            setToast({ type: 'success', message: 'Descrição completada' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar descrição' })
                          }
                        }}
                      >
                        Completar Descrição
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "valor",
                              m.extratoValor,
                              m.erpPareado!.valor
                            )
                            setToast({ type: 'success', message: 'Valor completado' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar valor' })
                          }
                        }}
                      >
                        Completar Valor
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const dataParaAplicar = diaData || new Date().toISOString().split("T")[0]
                            await completarCampoERP(
                              m.erpPareado!.id,
                              "data",
                              dataParaAplicar,
                              undefined
                            )
                            setToast({ type: 'success', message: 'Data completada' })
                            onAfterAction?.()
                          } catch (e: any) {
                            setToast({ type: 'error', message: e.message || 'Falha ao completar data' })
                          }
                        }}
                      >
                        Completar Data
                      </Button>
                    </div>
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
