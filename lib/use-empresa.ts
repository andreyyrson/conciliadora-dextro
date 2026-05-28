"use client"

import { useState, useEffect } from "react"

const EMPRESA_KEY = "empresa_selecionada"

export function useEmpresa() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(EMPRESA_KEY)
    if (saved) {
      setEmpresaId(saved)
    }
  }, [])

  const setEmpresa = (id: string) => {
    localStorage.setItem(EMPRESA_KEY, id)
    setEmpresaId(id)
  }

  const clearEmpresa = () => {
    localStorage.removeItem(EMPRESA_KEY)
    setEmpresaId(null)
  }

  return { empresaId, setEmpresa, clearEmpresa }
}
