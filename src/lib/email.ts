import { Resend } from 'resend'

const DEFAULT_FROM = 'Bureau Tonalli <notifications@bureautonalli.com>'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

/**
 * Send a transactional email via Resend.
 * Degrades gracefully if RESEND_API_KEY is not configured: logs + returns false.
 * Never throws — caller can fire-and-forget.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] Resend not configured, skipping', {
      to: params.to,
      subject: params.subject,
    })
    return false
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM
  const resend = new Resend(apiKey)

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (error) {
      console.error('[email] Resend returned error', { to: params.to, error })
      return false
    }

    return true
  } catch (err) {
    console.error('[email] Unexpected error', { to: params.to, err })
    return false
  }
}
