"use client"

import React, { useRef, useEffect } from "react"
import { Building2, User, LogOut, ChevronDown, Check } from "lucide-react"
import { useEmpresa } from "@/lib/use-empresa"

interface PainelHeaderProps {
  context: "portfolio" | "company"
  user: { name?: string; email?: string }
  role?: string
}

export function PainelHeader({
  context,
  user,
}: PainelHeaderProps) {
  const [showEmpresaDropdown, setShowEmpresaDropdown] = React.useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false)
  const { empresaId, empresas, setEmpresa } = useEmpresa()
  const empresaRef = useRef<HTMLDivElement>(null)

  const empresaAtual = empresas.find((e) => e.id === empresaId)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (empresaRef.current && !empresaRef.current.contains(event.target as Node)) {
        setShowEmpresaDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      {/* Seletor de Empresa Global */}
      {context === "company" ? (
        <div className="relative" ref={empresaRef}>
          <button
            onClick={() => setShowEmpresaDropdown(!showEmpresaDropdown)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showEmpresaDropdown
                ? "border-brand bg-brand/5 ring-1 ring-brand"
                : empresas.length > 0
                ? "border-border hover:border-brand/50 hover:bg-accent"
                : "border-border opacity-60 cursor-not-allowed"
            }`}
            disabled={empresas.length === 0}
          >
            <Building2 size={18} className="text-brand" />
            <span className="text-sm font-medium min-w-[120px] text-left">
              {empresaAtual?.nome || "Selecione uma empresa"}
            </span>
            {empresas.length > 0 && (
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform ${showEmpresaDropdown ? "rotate-180" : ""}`}
              />
            )}
          </button>

          {showEmpresaDropdown && empresas.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto py-1">
              <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Empresas
              </div>
              {empresas.map((empresa) => (
                <button
                  key={empresa.id}
                  onClick={() => {
                    setEmpresa(empresa.id)
                    setShowEmpresaDropdown(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                    empresa.id === empresaId ? "bg-accent font-medium" : ""
                  }`}
                >
                  <span className="truncate">{empresa.nome}</span>
                  {empresa.id === empresaId && (
                    <Check size={14} className="text-brand flex-shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div />
      )}

      {/* Profile Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <span className="text-sm font-medium">{user.name || user.email}</span>
        </button>

        {showProfileDropdown && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              onClick={() => {
                window.location.href = "/api/auth/signout"
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors text-destructive"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
