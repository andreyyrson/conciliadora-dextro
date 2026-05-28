"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-white/20 bg-black h-full">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">Conciliação</h1>
      </div>
      <nav className="px-4 space-y-2">
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/dashboard"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
        </motion.div>
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/conciliacoes"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Conciliações
          </Link>
        </motion.div>
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/contas"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Contas Bancárias
          </Link>
        </motion.div>
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/importacoes"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Importações
          </Link>
        </motion.div>
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/upload"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Upload ERP
          </Link>
        </motion.div>
        <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
          <Link
            href="/empresas"
            className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Empresas
          </Link>
        </motion.div>
      </nav>
    </aside>
  )
}
