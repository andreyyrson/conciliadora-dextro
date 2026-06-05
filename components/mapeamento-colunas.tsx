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
  { key: "data", label: "Data" },
  { key: "valor", label: "Valor" },
  { key: "descricao", label: "Descrição" },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "categoria", label: "Plano de Contas" },
  { key: "tipo", label: "Tipo (C/D)" },
  { key: "documento", label: "Nº Documento" },
  { key: "cnpj", label: "CNPJ/CPF" },
  { key: "centroCusto", label: "Centro de Custo" },
  { key: "banco", label: "Banco" },
  { key: "agencia", label: "Agência" },
  { key: "conta", label: "Conta" },
  { key: "observacao", label: "Observação" },
  { key: "lancamento", label: "Lançamento" },
  { key: "identificador", label: "Identificador" },
  { key: "saldoApos", label: "Saldo" },
  { key: "numero", label: "Número" },
  { key: "referencia", label: "Referência" },
  { key: "status", label: "Status" },
  { key: "projeto", label: "Projeto/OS" },
  { key: "natureza", label: "Natureza" }
]

const CAMPO_CORES: Record<string, string> = {
  data: "bg-accent text-foreground border-border",
  valor: "bg-accent text-foreground border-border",
  descricao: "bg-accent text-foreground border-border",
  fornecedor: "bg-accent text-foreground border-border",
  categoria: "bg-accent text-foreground border-border",
  tipo: "bg-accent text-foreground border-border",
  documento: "bg-accent text-foreground border-border",
  cnpj: "bg-accent text-foreground border-border",
  centroCusto: "bg-accent text-foreground border-border",
  banco: "bg-accent text-foreground border-border",
  agencia: "bg-accent text-foreground border-border",
  conta: "bg-accent text-foreground border-border",
  observacao: "bg-accent text-foreground border-border",
  lancamento: "bg-accent text-foreground border-border",
  identificador: "bg-accent text-foreground border-border",
  saldoApos: "bg-accent text-foreground border-border",
  numero: "bg-accent text-foreground border-border",
  referencia: "bg-accent text-foreground border-border",
  status: "bg-accent text-foreground border-border",
  projeto: "bg-accent text-foreground border-border",
  natureza: "bg-accent text-foreground border-border"
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
          <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              {mostrarTratado ? (
                <Sparkles className="w-5 h-5 text-foreground" />
              ) : (
                <MousePointerClick className="w-5 h-5 text-foreground" />
              )}
            </div>
            {mostrarTratado ? "Preview da Tabela Tratada" : "Mapeamento de Colunas"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {mostrarTratado
              ? "Esta é a tabela após o mapeamento. Verifique se está correta."
              : `Selecione o campo do sistema para cada coluna do arquivo. ${preview.length} registros no arquivo.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mapeamentoSalvo && (
            <span className="text-xs text-foreground bg-accent border border-border px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Mapeamento recuperado
            </span>
          )}
          <Button
            onClick={() => setMostrarTratado(!mostrarTratado)}
            variant="outline"
            size="sm"
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
        <div className="flex items-start gap-3 p-4 bg-accent border border-border rounded-xl">
          <AlertCircle className="w-5 h-5 text-foreground mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong className="text-foreground">Campos obrigatórios pendentes:</strong>{" "}
            <span className="text-muted-foreground">
              {camposObrigatoriosPendentes.map(c => c === "data" ? "📅 Data" : "💰 Valor").join(", ")}
            </span>
            <p className="text-xs text-muted-foreground mt-1.5">
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
        <div className="border border-border rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
                <tr>
                  {colunas.map(coluna => {
                    const campoAtribuido = colunaParaCampo[coluna]
                    const cor = campoAtribuido ? CAMPO_CORES[campoAtribuido] : ""
                    return (
                      <th
                        key={coluna}
                        className={`p-3 text-left min-w-[160px] border-b border-border ${
                          campoAtribuido
                            ? `${cor} border-l-2 border-r-2`
                            : "bg-accent text-muted-foreground"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="font-mono text-xs text-muted-foreground truncate" title={coluna}>
                            {coluna}
                          </div>
                          <select
                            value={campoAtribuido || "__null__"}
                            onChange={(e) => handleAtribuirCampo(coluna, e.target.value)}
                            className={`w-full text-xs rounded-lg px-2 py-2 border transition-all bg-background text-foreground ${
                              campoAtribuido
                                ? `${cor} font-medium shadow-sm`
                                : "border-border hover:border-border"
                            } focus:outline-none focus:ring-2 focus:ring-border cursor-pointer`}
                          >
                            {TODOS_CAMPOS.map(c => (
                              <option key={c.key} value={c.key} className="bg-background text-foreground">{c.label}</option>
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
                  <tr key={i} className="border-b border-border hover:bg-accent transition-colors">
                    {colunas.map(coluna => {
                      const campo = colunaParaCampo[coluna]
                      return (
                        <td
                          key={coluna}
                          className={`p-3 text-muted-foreground text-xs whitespace-nowrap ${
                            campo ? "bg-accent/50" : ""
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
        <div className="border border-border rounded-xl overflow-hidden shadow-lg">
          <div className="bg-accent px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Preview do resultado após mapeamento — {preview.length} registros
            </span>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/80 backdrop-blur-sm">
                <tr className="border-b border-border bg-accent">
                  {colunasTratadas.map((header) => (
                    <th key={header} className="text-left p-3 text-foreground font-medium whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewTratado.map((linha, i) => (
                  <tr key={i} className="border-b border-border hover:bg-accent transition-colors">
                    {colunasTratadas.map((header) => (
                      <td key={header} className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {linha[header] || <span className="text-muted-foreground italic">—</span>}
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
              disabled={!podeConfirmar}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Ver Tabela Tratada
            </Button>
            <Button
              onClick={onCancelar}
              variant="outline"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => onConfirmar(mapeamentoLocal)}
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar e Salvar
            </Button>
            <Button
              onClick={() => setMostrarTratado(false)}
              variant="outline"
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
