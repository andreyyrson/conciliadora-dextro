"use client"

import React from "react"
import { Building2, User, LogOut, Settings } from "lucide-react"

interface PainelHeaderProps {
  context: "portfolio" | "company"
  tenantId?: string
  tenants: Array<{ id: string; name: string }>
  user: { name?: string; email?: string }
  role?: string
}

export function PainelHeader({
  context,
  tenantId,
  tenants,
  user,
  role,
}: PainelHeaderProps) {
  const [showTenantDropdown, setShowTenantDropdown] = React.useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false)

  const canManage = role === "MASTER" || role === "ADMIN"
  const canDelete = role === "MASTER"

  const currentTenant = tenants.find((t) => t.id === tenantId)

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      {/* Tenant Selector */}
      {context === "company" && tenantId && (
        <div className="relative">
          <button
            onClick={() => setShowTenantDropdown(!showTenantDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
          >
            <Building2 size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium">{currentTenant?.name}</span>
          </button>

          {showTenantDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => {
                    window.location.href = `/dashboard?tenantId=${tenant.id}`
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {tenant.name}
                </button>
              ))}
            </div>
          )}
        </div>
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
