"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wallet,
  Upload,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"

interface PainelSidebarProps {
  context: "portfolio" | "company"
  tenantId?: string
  tenantName?: string
  role?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function PainelSidebar({
  context,
  tenantId,
  tenantName,
  role,
  collapsed,
  onToggle,
}: PainelSidebarProps) {
  const pathname = usePathname()

  const canManage = role === "MASTER" || role === "ADMIN"
  const canDelete = role === "MASTER"

  const portfolioNav = [
    {
      label: "Gestão",
      items: [
        {
          label: "Empresas",
          href: "/empresas",
          icon: Building2,
          visible: true,
        },
        {
          label: "Equipe",
          href: "/equipe",
          icon: Users,
          visible: canManage,
        },
      ],
    },
  ]

  const companyNav = [
    {
      label: "Visão geral",
      items: [
        {
          label: "Início",
          href: `/dashboard`,
          icon: LayoutDashboard,
          visible: true,
        },
      ],
    },
    {
      label: "Financeiro",
      items: [
        {
          label: "DRE",
          href: `/dre`,
          icon: FileText,
          visible: canManage,
        },
        {
          label: "Lançamentos",
          href: `/lancamentos`,
          icon: Wallet,
          visible: canManage,
        },
      ],
    },
  ]

  const conciliacaoNav = [
    {
      label: "Conciliação",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          visible: true,
        },
        {
          label: "Empresas",
          href: "/empresas",
          icon: Building2,
          visible: true,
        },
        {
          label: "Contas",
          href: "/contas",
          icon: Wallet,
          visible: true,
        },
        {
          label: "Importar Dados",
          href: "/importar",
          icon: Upload,
          visible: true,
        },
        {
          label: "Conciliações",
          href: "/conciliacoes",
          icon: FileText,
          visible: true,
        },
      ],
    },
  ]

  const navItems = context === "portfolio" ? portfolioNav : conciliacaoNav

  return (
    <aside
      className={`flex flex-col bg-card border-r border-border transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-foreground">Dextro</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {navItems.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items
                .filter((item) => item.visible !== false)
                .map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-brand text-white"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon size={18} />
                      {!collapsed && <span className="text-sm">{item.label}</span>}
                    </Link>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {tenantId && !collapsed && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 size={16} />
            <span className="truncate">{tenantName}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
