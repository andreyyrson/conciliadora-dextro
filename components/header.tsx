"use client"

import { signOut, useSession } from "next-auth/react"
import { motion } from "framer-motion"

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="border-b border-white/20 bg-black h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-300">
          Bem-vindo, {session?.user?.name || session?.user?.email}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-gray-300 hover:text-white transition-colors"
        >
          Sair
        </motion.button>
      </div>
    </header>
  )
}
