"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileCheck, Database, Table2, Search, ChevronLeft, ChevronRight, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LancamentoExtraido {
  data: string
  valor: number
  tipo: string
  descricao: string
  fornecedor: string | null
  banco: string | null
  categoria: string | null
}

interface ExtracaoPreviewProps {
  totalLinhas: number
  preview: LancamentoExtraido[]
}

const ITENS_POR_PAGINA = 50

export function ExtracaoPreview({ totalLinhas, preview }: ExtracaoPreviewProps) {
  const [busca, setBusca] = useState("")
  const [pagina, setPagina] = useState(1)
  const [verTodos, setVerTodos] = useState(false)

  const formatarValor = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  const formatarData = (d: string) => {
    const [ano, mes, dia] = d.split("-")
    return `${dia}/${mes}/${ano}`
  }

  // Filtro por busca em qualquer campo
  const filtrados = useMemo(() => {
    if (!busca.trim()) return preview
    const termo = busca.toLowerCase()
    return preview.filter(l =>
      l.descricao.toLowerCase().includes(termo) ||
      (l.fornecedor?.toLowerCase().includes(termo) ?? false) ||
      (l.banco?.toLowerCase().includes(termo) ?? false) ||
      (l.categoria?.toLowerCase().includes(termo) ?? false) ||
      l.data.includes(termo) ||
      l.valor.toString().includes(termo) ||
      l.tipo.toLowerCase().includes(termo)
    )
  }, [preview, busca])

  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA)
  const paginaAtual = Math.min(pagina, totalPaginas || 1)
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
  const paginados = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA)

  const displayData = verTodos ? preview.slice(0, 5) : paginados

  const totalCreditos = preview.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + l.valor, 0)
  const totalDebitos = preview.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + l.valor, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-success/10 rounded-lg">
          <FileCheck className="w-5 h-5 text-success" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Dados Extraídos do ERP
          </h3>
          <p className="text-sm text-muted-foreground">
            {totalLinhas} lançamentos processados e normalizados
          </p>
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-3 gap-3">
        <CampoCard
          label={`Entradas: ${formatarValor(totalCreditos)}`}
          icone={<Database className="w-4 h-4" />}
          cor="green"
        />
        <CampoCard
          label={`Saídas: ${formatarValor(totalDebitos)}`}
          icone={<Database className="w-4 h-4" />}
          cor="red"
        />
        <CampoCard
          label={`Saldo: ${formatarValor(totalCreditos - totalDebitos)}`}
          icone={<Database className="w-4 h-4" />}
          cor="blue"
        />
      </div>

      {/* Campos extraídos - cards */}
      <div className="grid grid-cols-3 gap-3">
        <CampoCard label="Data" icone={<Database className="w-4 h-4" />} cor="blue" />
        <CampoCard label="Banco" icone={<Database className="w-4 h-4" />} cor="purple" />
        <CampoCard label="Valor" icone={<Database className="w-4 h-4" />} cor="green" />
        <CampoCard label="Fornecedor" icone={<Database className="w-4 h-4" />} cor="orange" />
        <CampoCard label="Plano de Contas" icone={<Database className="w-4 h-4" />} cor="pink" />
        <CampoCard label="Descrição" icone={<Database className="w-4 h-4" />} cor="cyan" />
      </div>

      {/* Barra de busca + controle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar em qualquer campo..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
          />
        </div>
        <Button
          onClick={() => setVerTodos(!verTodos)}
          variant="outline"
          className="text-sm shrink-0"
        >
          {verTodos ? (
            <><X className="w-4 h-4 mr-1" /> Resumir</>
          ) : (
            <><Eye className="w-4 h-4 mr-1" /> Ver todos ({filtrados.length})</>
          )}
        </Button>
      </div>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-accent px-4 py-2 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {verTodos
                ? `Mostrando ${displayData.length} de ${filtrados.length} registros`
                : `Página ${paginaAtual} de ${totalPaginas} — ${filtrados.length} registros filtrados`
              }
            </span>
          </div>
          {busca && (
            <span className="text-xs text-muted-foreground">
              Filtro: "{busca}"
            </span>
          )}
        </div>

        <div className={`overflow-x-auto ${verTodos ? "max-h-[600px] overflow-y-auto" : ""}`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-border bg-accent">
                <th className="text-left p-2 text-foreground font-medium">#</th>
                <th className="text-left p-2 text-foreground font-medium">Data</th>
                <th className="text-left p-2 text-foreground font-medium">Banco</th>
                <th className="text-right p-2 text-foreground font-medium">Valor</th>
                <th className="text-left p-2 text-foreground font-medium">Tipo</th>
                <th className="text-left p-2 text-foreground font-medium">Fornecedor</th>
                <th className="text-left p-2 text-foreground font-medium">Plano de Contas</th>
                <th className="text-left p-2 text-foreground font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((linha, i) => {
                const idxGlobal = verTodos ? i : inicio + i
                return (
                  <tr key={idxGlobal} className="border-b border-border hover:bg-accent">
                    <td className="p-2 text-muted-foreground font-mono text-xs">{idxGlobal + 1}</td>
                    <td className="p-2 text-foreground font-mono text-xs whitespace-nowrap">
                      {formatarData(linha.data)}
                    </td>
                    <td className="p-2 text-foreground">
                      {linha.banco ? (
                        <span className="text-brand">{linha.banco}</span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className={`p-2 text-right font-mono font-medium whitespace-nowrap ${
                      linha.tipo === "DEBITO" ? "text-destructive" : "text-success"
                    }`}>
                      {formatarValor(linha.valor)}
                    </td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        linha.tipo === "DEBITO"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success/10 text-success"
                      }`}>
                        {linha.tipo}
                      </span>
                    </td>
                    <td className="p-2 text-foreground max-w-[180px] truncate">
                      {linha.fornecedor ? (
                        <span className="text-warning">{linha.fornecedor}</span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="p-2 text-foreground max-w-[180px] truncate">
                      {linha.categoria ? (
                        <span className="text-brand">{linha.categoria}</span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="p-2 text-foreground max-w-[250px] truncate" title={linha.descricao}>
                      {linha.descricao}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!verTodos && totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-accent">
            <Button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              {inicio + 1}–{Math.min(inicio + ITENS_POR_PAGINA, filtrados.length)} de {filtrados.length}
            </span>
            <Button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              variant="outline"
              size="sm"
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CampoCard({
  label,
  icone,
  cor
}: {
  label: string
  icone: React.ReactNode
  cor: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "red"
}) {
  const cores: Record<string, string> = {
    blue: "bg-brand/10 text-brand border-brand/20",
    purple: "bg-brand/10 text-brand border-brand/20",
    green: "bg-success/10 text-success border-success/20",
    orange: "bg-warning/10 text-warning border-warning/20",
    pink: "bg-brand/10 text-brand border-brand/20",
    cyan: "bg-brand/10 text-brand border-brand/20",
    red: "bg-destructive/10 text-destructive border-destructive/20"
  }

  return (
    <div className={`p-3 rounded-lg border ${cores[cor]} flex items-center gap-2`}>
      {icone}
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
