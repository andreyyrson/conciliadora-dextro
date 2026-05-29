"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, ArrowRight, ArrowLeft, MousePointerClick, Sparkles, ChevronDown, ChevronUp } from "lucide-react"

interface MapeamentoColunasProps {
  colunas: string[]
  mapeamento: { [campo: string]: string | null }
  preview: { [coluna: string]: string }[]
  colunasNaoMapeadas: string[]
  confianca: { [campo: string]: number }
  mapeamentoSalvo: boolean
  onConfirmar: (mapeamento: { [campo: string]: string | null }) => void
  onCancelar: () => void
  tipo: "ERP" | "EXTRATO"
}

const TODOS_CAMPOS = [
  { key: "__null__", label: "— Ignorar —" },
  { key: "data", label: "📅 Data" },
  { key: "valor", label: "💰 Valor" },
  { key: "descricao", label: "📝 Descrição" },
  { key: "fornecedor", label: "🏢 Fornecedor" },
  { key: "categoria", label: "📊 Plano de Contas" },
  { key: "tipo", label: "↔️ Tipo (C/D)" },
  { key: "documento", label: "📄 Nº Documento" },
  { key: "cnpj", label: "🆔 CNPJ/CPF" },
  { key: "centroCusto", label: "📍 Centro de Custo" },
  { key: "banco", label: "🏦 Banco" },
  { key: "agencia", label: "🏛️ Agência" },
  { key: "conta", label: "🔢 Conta" },
  { key: "observacao", label: "💬 Observação" },
  { key: "lancamento", label: "📋 Lançamento" },
  { key: "identificador", label: "🔑 Identificador" },
  { key: "saldoApos", label: "💵 Saldo" },
  { key: "numero", label: "🔢 Número" },
  { key: "referencia", label: "📎 Referência" },
  { key: "status", label: "✅ Status" },
  { key: "projeto", label: "🚧 Projeto/OS" },
  { key: "natureza", label: "🌿 Natureza" }
]

const CAMPO_CORES: Record<string, string> = {
  data: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  valor: "bg-green-500/20 text-green-300 border-green-500/30",
  descricao: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  fornecedor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  categoria: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  tipo: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  documento: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  cnpj: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  centroCusto: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  banco: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  agencia: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  conta: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  observacao: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  lancamento: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  identificador: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  saldoApos: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  numero: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  referencia: "bg-stone-500/20 text-stone-300 border-stone-500/30",
  status: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  projeto: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  natureza: "bg-neutral-500/20 text-neutral-300 border-neutral-500/30"
}

const LABEL_CURTO: Record<string, string> = {
  data: "Data",
  valor: "Valor",
  descricao: "Desc.",
  fornecedor: "Fornec.",
  categoria: "Plano Cont.",
  tipo: "Tipo",
  documento: "Doc.",
  cnpj: "CNPJ",
  centroCusto: "CC",
  banco: "Banco",
  agencia: "Ag.",
  conta: "Conta",
  observacao: "Obs.",
  lancamento: "Lanct.",
  identificador: "ID",
  saldoApos: "Saldo",
  numero: "Nº",
  referencia: "Ref.",
  status: "Status",
  projeto: "Proj.",
  natureza: "Nat."
}

export function MapeamentoColunas({
  colunas,
  mapeamento,
  preview,
  mapeamentoSalvo,
  onConfirmar,
  onCancelar,
  tipo
}: MapeamentoColunasProps) {
  const [mapeamentoLocal, setMapeamentoLocal] = useState<{ [campo: string]: string | null }>(mapeamento)
  const [mostrarTratado, setMostrarTratado] = useState(false)
  const [expandedCampo, setExpandedCampo] = useState<string | null>(null)

  // Inverte o mapeamento: coluna original -> campo do sistema
  const colunaParaCampo = useMemo(() => {
    const map: { [coluna: string]: string } = {}
    for (const [campo, coluna] of Object.entries(mapeamentoLocal)) {
      if (coluna) map[coluna] = campo
    }
    return map
  }, [mapeamentoLocal])

  const handleAtribuirCampo = (coluna: string, campo: string) => {
    if (campo === "__null__") {
      // Desmapear: encontrar qual campo apontava para esta coluna
      const campoAtual = Object.entries(mapeamentoLocal).find(([, c]) => c === coluna)?.[0]
      if (campoAtual) {
        setMapeamentoLocal(prev => ({ ...prev, [campoAtual]: null }))
      }
      return
    }
    // Se outra coluna já está mapeada para este campo, desmapear
    const colunaAntiga = mapeamentoLocal[campo]
    setMapeamentoLocal(prev => {
      const novo = { ...prev, [campo]: coluna }
      // Se esta coluna estava mapeada para outro campo, limpa
      for (const [c, col] of Object.entries(novo)) {
        if (c !== campo && col === coluna) {
          novo[c] = null
        }
      }
      return novo
    })
  }

  const camposObrigatoriosPendentes = ["data", "valor"].filter(
    campo => !mapeamentoLocal[campo]
  )

  const podeConfirmar = camposObrigatoriosPendentes.length === 0

  // Preview da tabela tratada (com os campos mapeados)
  const previewTratado = useMemo(() => {
    return preview.slice(0, 10).map(linha => {
      const tratado: Record<string, string> = {}
      for (const [campo, coluna] of Object.entries(mapeamentoLocal)) {
        if (coluna && linha[coluna] !== undefined) {
          tratado[LABEL_CURTO[campo] || campo] = String(linha[coluna])
        }
      }
      return tratado
    })
  }, [preview, mapeamentoLocal])

  const colunasTratadas = useMemo(() => {
    const camposMapeados = Object.entries(mapeamentoLocal)
      .filter(([, c]) => c !== null)
      .map(([campo]) => LABEL_CURTO[campo] || campo)
    return camposMapeados
  }, [mapeamentoLocal])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              {mostrarTratado ? (
                <Sparkles className="w-5 h-5 text-white" />
              ) : (
                <MousePointerClick className="w-5 h-5 text-white" />
              )}
            </div>
            {mostrarTratado ? "Preview da Tabela Tratada" : "Mapeamento de Colunas"}
          </h3>
          <p className="text-sm text-gray-400 mt-2">
            {mostrarTratado
              ? "Esta é a tabela após o mapeamento. Verifique se está correta."
              : `Selecione o campo do sistema para cada coluna do arquivo. ${preview.length} registros no arquivo.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mapeamentoSalvo && (
            <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Mapeamento recuperado
            </span>
          )}
          <Button
            onClick={() => setMostrarTratado(!mostrarTratado)}
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all"
          >
            {mostrarTratado ? (
              <><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</>
            ) : (
              <><ArrowRight className="w-4 h-4 mr-2" /> Ver Preview</>
            )}
          </Button>
        </div>
      </div>

      {/* Alerta campos obrigatórios */}
      {!mostrarTratado && camposObrigatoriosPendentes.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
          <AlertCircle className="w-5 h-5 text-white mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong className="text-white">Campos obrigatórios pendentes:</strong>{" "}
            <span className="text-gray-300">
              {camposObrigatoriosPendentes.map(c => c === "data" ? "📅 Data" : "💰 Valor").join(", ")}
            </span>
            <p className="text-xs text-gray-400 mt-1.5">
              Selecione o campo correspondente no dropdown de cada coluna.
            </p>
          </div>
        </div>
      )}

      {/* Legenda dos campos mapeados */}
      {!mostrarTratado && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(mapeamentoLocal)
            .filter(([, coluna]) => coluna !== null)
            .map(([campo]) => (
              <span key={campo} className={`text-xs px-3 py-1.5 rounded-full border ${CAMPO_CORES[campo] || ""} flex items-center gap-1.5`}>
                <Check className="w-3 h-3" />
                {LABEL_CURTO[campo]}
              </span>
            ))}
        </div>
      )}

      {/* TABELA ORIGINAL — para mapeamento */}
      {!mostrarTratado && (
        <div className="border border-white/10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm">
                <tr>
                  {colunas.map(coluna => {
                    const campoAtribuido = colunaParaCampo[coluna]
                    const cor = campoAtribuido ? CAMPO_CORES[campoAtribuido] : ""
                    return (
                      <th
                        key={coluna}
                        className={`p-3 text-left min-w-[160px] border-b border-white/10 ${
                          campoAtribuido
                            ? `${cor} border-l-2 border-r-2`
                            : "bg-white/5 text-gray-300"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="font-mono text-xs text-gray-400 truncate" title={coluna}>
                            {coluna}
                          </div>
                          <select
                            value={campoAtribuido || "__null__"}
                            onChange={(e) => handleAtribuirCampo(coluna, e.target.value)}
                            className={`w-full text-xs rounded-lg px-2 py-2 border transition-all ${
                              campoAtribuido
                                ? `${cor} font-medium shadow-sm`
                                : "bg-black/50 border-white/20 text-gray-400 hover:border-white/30"
                            } focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer`}
                          >
                            {TODOS_CAMPOS.map(c => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.map((linha, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {colunas.map(coluna => {
                      const campo = colunaParaCampo[coluna]
                      return (
                        <td
                          key={coluna}
                          className={`p-3 text-gray-300 text-xs whitespace-nowrap ${
                            campo ? "bg-white/[0.03]" : ""
                          }`}
                        >
                          {String(linha[coluna] ?? "")}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABELA TRATADA — preview do resultado */}
      {mostrarTratado && (
        <div className="border border-white/10 rounded-xl overflow-hidden shadow-lg shadow-black/20">
          <div className="bg-white/5 px-4 py-3 border-b border-white/10">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Preview do resultado após mapeamento — {preview.length} registros
            </span>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/80 backdrop-blur-sm">
                <tr className="border-b border-white/10 bg-white/5">
                  {colunasTratadas.map((header) => (
                    <th key={header} className="text-left p-3 text-gray-200 font-medium whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewTratado.map((linha, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {colunasTratadas.map((header) => (
                      <td key={header} className="p-3 text-gray-300 text-xs whitespace-nowrap">
                        {linha[header] || <span className="text-gray-600 italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 pt-4">
        {!mostrarTratado ? (
          <>
            <Button
              onClick={() => setMostrarTratado(true)}
              className="bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!podeConfirmar}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Ver Tabela Tratada
            </Button>
            <Button
              onClick={onCancelar}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => onConfirmar(mapeamentoLocal)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar e Salvar
            </Button>
            <Button
              onClick={() => setMostrarTratado(false)}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Mapeamento
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
