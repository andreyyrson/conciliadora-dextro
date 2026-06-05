"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log para monitoramento de erros
    console.error("Error boundary capturou:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      <h2 className="text-xl font-semibold text-red-400 mb-4">
        Algo deu errado
      </h2>
      <p className="text-gray-400 mb-6 text-center max-w-md">
        Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte.
      </p>
      <Button onClick={reset} className="bg-white text-black hover:bg-gray-200">
        Tentar novamente
      </Button>
    </div>
  )
}
