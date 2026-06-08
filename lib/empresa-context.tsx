"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

const EMPRESA_KEY = "empresa_selecionada"

export interface Empresa {
  id: string
  nome: string
  cnpj?: string | null
}

interface EmpresaContextValue {
  empresaId: string | null
  empresas: Empresa[]
  loading: boolean
  setEmpresa: (id: string) => void
  clearEmpresa: () => void
  refreshEmpresas: () => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextValue | undefined>(undefined)

function getSavedEmpresa(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(EMPRESA_KEY)
}

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresaId, setEmpresaId] = useState<string | null>(getSavedEmpresa)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  const setEmpresa = useCallback((id: string) => {
    localStorage.setItem(EMPRESA_KEY, id)
    setEmpresaId(id)
  }, [])

  const clearEmpresa = useCallback(() => {
    localStorage.removeItem(EMPRESA_KEY)
    setEmpresaId(null)
  }, [])

  const refreshEmpresas = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/empresas")
      const data = await response.json()
      const lista: Empresa[] = data.empresas || []
      setEmpresas(lista)

      // Selecionar a primeira empresa automaticamente se nenhuma estiver salva
      // ou se a empresa salva não existir mais na lista.
      setEmpresaId((atual) => {
        if (atual && lista.some((e) => e.id === atual)) {
          return atual
        }
        if (lista.length > 0) {
          localStorage.setItem(EMPRESA_KEY, lista[0].id)
          return lista[0].id
        }
        return null
      })
    } catch (error) {
      console.error("Erro ao buscar empresas:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshEmpresas()
  }, [refreshEmpresas])

  return (
    <EmpresaContext.Provider
      value={{
        empresaId,
        empresas,
        loading,
        setEmpresa,
        clearEmpresa,
        refreshEmpresas,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresaContext(): EmpresaContextValue {
  const context = useContext(EmpresaContext)
  if (!context) {
    throw new Error("useEmpresaContext deve ser usado dentro de EmpresaProvider")
  }
  return context
}
