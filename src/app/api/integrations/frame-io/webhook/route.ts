import { NextResponse } from 'next/server'
import { verifyFrameIoSignature } from '@/lib/integrations/frame-io'

// Event types we recognize today. Anything else is logged and accepted (200)
// so Frame.io doesn't retry forever.
const HANDLED_EVENTS = ['asset.ready', 'comment.created'] as const
type HandledEvent = (typeof HANDLED_EVENTS)[number]

interface FrameIoWebhookBody {
  type?: string
  resource?: { id?: string; type?: string }
  data?: Record<string, unknown>
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.FRAME_IO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[frame-io webhook] FRAME_IO_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    )
  }

  // We need the RAW body for HMAC verification, so read text and parse manually
  const rawBody = await req.text()
  const signature = req.headers.get('x-frameio-signature')
  const timestamp = req.headers.get('x-frameio-request-timestamp')

  const isValid = verifyFrameIoSignature({ signature, timestamp, body: rawBody, secret })
  if (!isValid) {
    console.warn('[frame-io webhook] invalid signature', {
      hasSig: !!signature,
      hasTs: !!timestamp,
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let parsed: FrameIoWebhookBody
  try {
    parsed = JSON.parse(rawBody) as FrameIoWebhookBody
  } catch (err) {
    console.error('[frame-io webhook] invalid JSON', { err })
    // 500 → Frame.io retries; that's what we want for transient parse errors
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 500 })
  }

  const eventType = parsed.type ?? 'unknown'

  if (HANDLED_EVENTS.includes(eventType as HandledEvent)) {
    // TODO(F2-036 follow-up): map asset.ready → FileVersion / comment.created → Comment
    // Requires schema decisions coordinated with Memo. For now, log and ack.
    console.info('[frame-io webhook] handled event (no-op)', {
      type: eventType,
      resourceId: parsed.resource?.id,
    })
  } else {
    console.info('[frame-io webhook] ignored unknown event type', { type: eventType })
  }

  return NextResponse.json({ received: true })
}
