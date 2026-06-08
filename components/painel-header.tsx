"use client"

import React from "react"
import { Building2, User, LogOut, ChevronDown } from "lucide-react"
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

  const empresaAtual = empresas.find((e) => e.id === empresaId)

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      {/* Seletor de Empresa Global */}
      {context === "company" ? (
        <div className="relative">
          <button
            onClick={() => setShowEmpresaDropdown(!showEmpresaDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
            disabled={empresas.length === 0}
          >
            <Building2 size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium">
              {empresaAtual?.nome || "Selecione uma empresa"}
            </span>
            {empresas.length > 0 && (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </button>

          {showEmpresaDropdown && empresas.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
              {empresas.map((empresa) => (
                <button
                  key={empresa.id}
                  onClick={() => {
                    setEmpresa(empresa.id)
                    setShowEmpresaDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    empresa.id === empresaId ? "bg-accent font-medium" : ""
                  }`}
                >
                  {empresa.nome}
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
