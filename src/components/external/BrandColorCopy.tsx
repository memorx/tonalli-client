'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface BrandColorCopyProps {
  name: string
  value: string
}

export function BrandColorCopy({ name, value }: BrandColorCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 w-full"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-lg border border-border"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
      <div className="shrink-0">
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </button>
  )
}
