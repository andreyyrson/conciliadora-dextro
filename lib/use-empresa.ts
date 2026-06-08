"use client"

import { useState, useCallback } from "react"

const EMPRESA_KEY = "empresa_selecionada"

function getSavedEmpresa(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(EMPRESA_KEY)
}

export function useEmpresa() {
  const [empresaId, setEmpresaId] = useState<string | null>(getSavedEmpresa)

  const setEmpresa = useCallback((id: string) => {
    localStorage.setItem(EMPRESA_KEY, id)
    setEmpresaId(id)
  }, [])

  const clearEmpresa = useCallback(() => {
    localStorage.removeItem(EMPRESA_KEY)
    setEmpresaId(null)
  }, [])

  return { empresaId, setEmpresa, clearEmpresa }
}
