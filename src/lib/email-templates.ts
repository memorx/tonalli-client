import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'

// ══════════════════════════════════════════════
// LAYOUT (shared shell — matches internal portal visual)
// ══════════════════════════════════════════════

function head(): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0F0F1A; color: #E0E0E0; border-radius: 12px; overflow: hidden;">
  <div style="background: #6C3FC5; padding: 20px 24px;">
    <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">Bureau Tonalli</h1>
  </div>
  <div style="padding: 24px;">`
}

function foot(footerText: string): string {
  return `</div>
  <div style="padding: 16px 24px; border-top: 1px solid #2A2A40; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #888;">${footerText}</p>
  </div>
</div>`
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display: inline-block; padding: 10px 24px; background: #6C3FC5; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; margin-top: 16px;">${text}</a>`
}

function card(content: string, accent: string = '#6C3FC5'): string {
  return `<div style="background: #1A1A2E; border-radius: 8px; padding: 16px; border-left: 3px solid ${accent}; margin: 12px 0;">${content}</div>`
}

// ══════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════

export interface EmailRendered {
  subject: string
  html: string
}

export async function emailWelcome(params: {
  userName: string
  clientName: string
  portalUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('welcome.subject'),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('welcome.title', { clientName: params.clientName })}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      <p style="margin: 0 0 16px; color: #E0E0E0; font-size: 14px; line-height: 1.5;">${t('welcome.body')}</p>
      ${btn(t('welcome.cta'), params.portalUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailNewApprovalRequest(params: {
  userName: string
  projectName: string
  fileName: string
  approvalUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('newApprovalRequest.subject', { projectName: params.projectName }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('newApprovalRequest.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0 0 4px; font-size: 14px;"><strong>${params.fileName}</strong></p>
         <p style="margin: 0; font-size: 13px; color: #888;">${params.projectName}</p>`,
        '#EF9F27',
      )}
      <p style="margin: 0 0 16px; color: #E0E0E0; font-size: 14px;">${t('newApprovalRequest.body')}</p>
      ${btn(t('newApprovalRequest.cta'), params.approvalUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailApprovalConfirmation(params: {
  userName: string
  fileName: string
  decision: 'APPROVED' | 'REVISION_REQUESTED'
  feedback?: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  const approved = params.decision === 'APPROVED'
  const subject = approved
    ? t('approvalConfirmation.subjectApproved', { fileName: params.fileName })
    : t('approvalConfirmation.subjectRejected', { fileName: params.fileName })
  const title = approved
    ? t('approvalConfirmation.titleApproved')
    : t('approvalConfirmation.titleRejected')
  const body = approved
    ? t('approvalConfirmation.bodyApproved', { fileName: params.fileName })
    : t('approvalConfirmation.bodyRejected', { fileName: params.fileName })
  const accent = approved ? '#10B981' : '#EF4444'

  return {
    subject,
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${title}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0; font-size: 14px;">${body}</p>` +
          (params.feedback
            ? `<p style="margin: 12px 0 0; font-size: 13px; color: #E0E0E0;"><strong>${t('approvalConfirmation.feedbackLabel')}</strong></p>
               <p style="margin: 4px 0 0; font-size: 13px; color: #E0E0E0; font-style: italic;">"${params.feedback}"</p>`
            : ''),
        accent,
      )}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailInvoiceAvailable(params: {
  userName: string
  invoiceNumber: string
  amount: string
  dueDate: string
  portalUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('invoiceAvailable.subject', { invoiceNumber: params.invoiceNumber }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('invoiceAvailable.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0 0 4px; font-size: 14px;"><strong>${params.invoiceNumber}</strong></p>
         <p style="margin: 4px 0 0; font-size: 13px; color: #E0E0E0;"><span style="color: #888;">${t('invoiceAvailable.amountLabel')}:</span> ${params.amount}</p>
         <p style="margin: 4px 0 0; font-size: 13px; color: #E0E0E0;"><span style="color: #888;">${t('invoiceAvailable.dueLabel')}:</span> ${params.dueDate}</p>`,
      )}
      <p style="margin: 0 0 16px; color: #E0E0E0; font-size: 14px;">${t('invoiceAvailable.body')}</p>
      ${btn(t('invoiceAvailable.cta'), params.portalUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailApprovalReminder(params: {
  userName: string
  projectName: string
  fileName: string
  approvalUrl: string
  daysPending: number
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('approvalReminder.subject', { projectName: params.projectName }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('approvalReminder.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0; font-size: 14px;">${t('approvalReminder.body', { days: params.daysPending, fileName: params.fileName })}</p>
         <p style="margin: 4px 0 0; font-size: 13px; color: #888;">${params.projectName}</p>`,
        '#EF9F27',
      )}
      ${btn(t('approvalReminder.cta'), params.approvalUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailCommentNotification(params: {
  userName: string
  commenterName: string
  projectName: string
  fileName: string
  commentText: string
  threadUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('commentNotification.subject', { commenterName: params.commenterName, fileName: params.fileName }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('commentNotification.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      <p style="margin: 0 0 12px; color: #E0E0E0; font-size: 14px;">${t('commentNotification.intro', {
        commenterName: params.commenterName,
        fileName: params.fileName,
        projectName: params.projectName,
      })}</p>
      ${card(
        `<p style="margin: 0 0 4px; font-size: 13px; color: #888;"><strong>${t('commentNotification.commentLabel')}</strong></p>
         <p style="margin: 4px 0 0; font-size: 14px; color: #E0E0E0; font-style: italic;">"${params.commentText}"</p>`,
      )}
      ${btn(t('commentNotification.cta'), params.threadUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailFileUploaded(params: {
  userName: string
  projectName: string
  fileName: string
  fileVersion: number
  projectUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('fileUploaded.subject', { projectName: params.projectName }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('fileUploaded.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0; font-size: 14px;">${t('fileUploaded.body', {
          fileName: params.fileName,
          version: params.fileVersion,
          projectName: params.projectName,
        })}</p>`,
      )}
      ${btn(t('fileUploaded.cta'), params.projectUrl)}
    ${foot(t('common.footer'))}`,
  }
}

export async function emailProjectStatusChange(params: {
  userName: string
  projectName: string
  /** Already-translated phase label (caller resolves via client-status.ts) */
  phaseLabel: string
  projectUrl: string
  locale: Locale
}): Promise<EmailRendered> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email' })
  return {
    subject: t('projectStatusChange.subject', { projectName: params.projectName, phaseLabel: params.phaseLabel }),
    html: `${head()}
      <h2 style="margin: 0 0 8px; font-size: 16px; color: #F5F5F5;">${t('projectStatusChange.title')}</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">${t('common.greeting', { name: params.userName })}</p>
      ${card(
        `<p style="margin: 0; font-size: 14px;">${t('projectStatusChange.body', {
          projectName: params.projectName,
          phaseLabel: params.phaseLabel,
        })}</p>`,
      )}
      ${btn(t('projectStatusChange.cta'), params.projectUrl)}
    ${foot(t('common.footer'))}`,
  }
}
