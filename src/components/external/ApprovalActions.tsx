'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Edit3, Loader2 } from 'lucide-react'

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED'

interface ApprovalActionsProps {
  approvalId: string
  status: ApprovalStatus
}

export function ApprovalActions({ approvalId, status }: ApprovalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  if (status !== 'PENDING') return null

  const handleApprove = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/external/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Une erreur est survenue')
        return
      }
      router.refresh()
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!showFeedback) {
      setShowFeedback(true)
      return
    }

    if (!feedback.trim()) {
      setError('Veuillez ajouter un commentaire')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/external/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', feedback: feedback.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Une erreur est survenue')
        return
      }
      router.refresh()
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {showFeedback && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Décrivez les modifications souhaitées..."
          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px]"
        />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Approuver
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
          Demander des modifications
        </button>
      </div>
    </div>
  )
}
