"use client"

import { useEmpresaContext } from "./empresa-context"

export function useEmpresa() {
  const { empresaId, empresas, loading, setEmpresa, clearEmpresa, refreshEmpresas } =
    useEmpresaContext()

  return { empresaId, empresas, loading, setEmpresa, clearEmpresa, refreshEmpresas }
}
