"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useEmpresa } from "@/lib/use-empresa"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { TransferenciaSugestao, DiagnosticoTransferencias } from "@/lib/conciliacao/transferencias"

export function TransferenciasCard() {
  const { empresaId } = useEmpresa()
  const [sugestoes, setSugestoes] = useState<TransferenciaSugestao[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [aprovando, setAprovando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [diagnostico, setDiagnostico] = useState<DiagnosticoTransferencias | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState<Date>(new Date())
  const [openCalendar, setOpenCalendar] = useState(false)

  const getPeriodoRange = useCallback((data: Date) => {
    const primeiroDia = new Date(data.getFullYear(), data.getMonth(), 1)
    const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0)
    return {
      inicio: primeiroDia.toISOString().split("T")[0],
      fim: ultimoDia.toISOString().split("T")[0]
    }
  }, [])

  const buscar = useCallback(async () => {
    if (!empresaId) return
    const { inicio, fim } = getPeriodoRange(mesSelecionado)
    setCarregando(true)
    setMensagem("")
    try {
      const res = await fetch(
        `/api/conciliacoes/transferencias/detectar?empresaId=${empresaId}&dataInicio=${inicio}&dataFim=${fim}`
      )
      const data = await res.json().catch(() => ({}))
      console.log("[TransferenciasCard] response", { status: res.status, data })
      if (res.ok) {
        setSugestoes(data.transferencias || [])
        setDiagnostico(data.diagnostico || null)
        setSelecionadas(new Set())
        if ((data.transferencias || []).length === 0) {
          setMensagem("Nenhuma transferência identificada.")
        }
      } else {
        setMensagem(data.error || "Não foi possível detectar transferências.")
        setDiagnostico(null)
        setSelecionadas(new Set())
      }
    } catch (error) {
      console.error("[TransferenciasCard] erro", error)
      setMensagem("Falha ao detectar transferências.")
      setDiagnostico(null)
    } finally {
      setCarregando(false)
    }
  }, [empresaId, mesSelecionado, getPeriodoRange])

  useEffect(() => {
    if (empresaId) buscar()
  }, [empresaId, buscar])

  const handleMesChange = (date: Date | undefined) => {
    if (date) {
      setMesSelecionado(date)
      setOpenCalendar(false)
    }
  }

  const toggle = (id: string) => {
    setSelecionadas(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const aprovar = async () => {
    if (!empresaId || selecionadas.size === 0) return
    setAprovando(true)
    try {
      const selecionadasList = sugestoes.filter(t => selecionadas.has(t.id))
      const res = await fetch("/api/conciliacoes/transferencias/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, transferencias: selecionadasList })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMensagem(`${data.updated || 0} transferência(s) removidas.`)
        await buscar()
      } else {
        setMensagem(data.error || "Falha ao aprovar transferências.")
      }
    } catch (error) {
      console.error("Erro ao aprovar transferências", error)
      setMensagem("Erro ao aprovar transferências.")
    } finally {
      setAprovando(false)
    }
  }

  if (!empresaId) return null

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Transferências detectadas</h3>
        {carregando && <Loader2 className="animate-spin text-muted-foreground" size={18} />}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Período de busca
        </label>
        <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start w-[250px]" role="combobox">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {mesSelecionado.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-2">
            <Calendar
              mode="single"
              selected={mesSelecionado}
              onSelect={handleMesChange}
            />
          </PopoverContent>
        </Popover>
      </div>
      {sugestoes.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sugestoes.map(transferencia => (
            <label
              key={transferencia.id}
              className="flex items-start gap-3 p-3 rounded border border-dashed bg-background"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selecionadas.has(transferencia.id)}
                onChange={() => toggle(transferencia.id)}
              />
              <div className="flex-1 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  R$ {transferencia.valor.toFixed(2)} • {new Date(transferencia.dataOrigem).toLocaleDateString()} → {new Date(transferencia.dataDestino).toLocaleDateString()}
                </div>
                <div>
                  {transferencia.descricaoOrigem} → {transferencia.descricaoDestino}
                </div>
                <div className="text-xs text-muted-foreground">
                  {transferencia.origemTipo} {transferencia.bancoOrigem || ""} → {transferencia.destinoTipo} {transferencia.bancoDestino || ""}
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{mensagem || "Nenhuma transferência detectada."}</p>
          {diagnostico && (
            <div className="bg-muted p-3 rounded text-xs font-mospace">
              <p className="font-semibold">Diagnóstico:</p>
              <p>ERP: {diagnostico.totalErp} | Extrato: {diagnostico.totalExtrato} | Total: {diagnostico.totalLancamentos}</p>
              <p>Débitos: {diagnostico.debitos} | Créditos: {diagnostico.creditos}</p>
              <p>Tipos encontrados: {diagnostico.tiposUnicos.join(", ") || "-"}</p>
              <p>Amostra:</p>
              <ul className="list-disc list-inside">
                {diagnostico.amostra.map(tx => (
                  <li key={tx.id}>
                    {tx.tipo} R$ {tx.valor.toFixed(2)} {new Date(tx.data).toLocaleDateString()} [{tx.banco || "sem banco"}] {tx.descricao.slice(0, 30)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => buscar()}
          disabled={carregando}
        >
          Recarregar
        </Button>
        <Button
          size="sm"
          onClick={aprovar}
          disabled={selecionadas.size === 0 || aprovando}
        >
          {aprovando ? "Removendo..." : "Aprovar remoção"}
        </Button>
      </div>
    </Card>
  )
}
