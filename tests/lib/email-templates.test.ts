import { describe, it, expect, vi } from 'vitest'

// Mock next-intl's getTranslations to load messages JSON directly, resolve
// nested keys, and interpolate {param} placeholders. Keeps tests pure (no
// next.config plugin) while exercising the real translation strings.
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const messages = locale === 'en'
      ? (await import('../../messages/en.json')).default
      : (await import('../../messages/fr.json')).default

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ns = (messages as any)[namespace]
    if (!ns) throw new Error(`Namespace ${namespace} not found in ${locale}`)

    return (key: string, params?: Record<string, string | number>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = ns
      for (const part of key.split('.')) {
        value = value?.[part]
      }
      if (typeof value !== 'string') {
        throw new Error(`Missing key ${namespace}.${key} in ${locale}`)
      }
      return value.replace(/\{(\w+)\}/g, (_: string, k: string) =>
        params && k in params ? String(params[k]) : `{${k}}`,
      )
    }
  },
}))

import {
  emailWelcome,
  emailNewApprovalRequest,
  emailApprovalConfirmation,
  emailInvoiceAvailable,
  emailApprovalReminder,
  emailCommentNotification,
  emailFileUploaded,
  emailProjectStatusChange,
} from '@/lib/email-templates'

const LOCALES = ['fr', 'en'] as const

describe('emailWelcome', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders subject + html with greeting, clientName, CTA url`, async () => {
      const result = await emailWelcome({
        userName: 'Sophie',
        clientName: 'Givenchy',
        portalUrl: 'https://example.com/portal',
        locale,
      })

      expect(result.subject).toBeTruthy()
      expect(result.subject).not.toContain('{')
      expect(result.html).toContain('Sophie')
      expect(result.html).toContain('Givenchy')
      expect(result.html).toContain('https://example.com/portal')
      expect(result.html).toContain('Bureau Tonalli')
    })
  }
})

describe('emailNewApprovalRequest', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders with project, file, and approval URL`, async () => {
      const result = await emailNewApprovalRequest({
        userName: 'Pierre',
        projectName: 'Campaign 2026',
        fileName: 'visual-01.png',
        approvalUrl: 'https://example.com/approval/abc',
        locale,
      })

      expect(result.subject).toContain('Campaign 2026')
      expect(result.html).toContain('Pierre')
      expect(result.html).toContain('Campaign 2026')
      expect(result.html).toContain('visual-01.png')
      expect(result.html).toContain('https://example.com/approval/abc')
    })
  }
})

describe('emailApprovalConfirmation', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] APPROVED → subject reflects approval, no feedback section if absent`, async () => {
      const result = await emailApprovalConfirmation({
        userName: 'Isabelle',
        fileName: 'mockup.pdf',
        decision: 'APPROVED',
        locale,
      })

      expect(result.subject).toContain('mockup.pdf')
      expect(result.html).toContain('mockup.pdf')
      expect(result.html).toContain('Isabelle')
      expect(result.html).not.toContain('Votre commentaire')
      expect(result.html).not.toContain('Your comment')
    })

    it(`[${locale}] REVISION_REQUESTED with feedback → renders feedback`, async () => {
      const result = await emailApprovalConfirmation({
        userName: 'Marie',
        fileName: 'logo-v2.svg',
        decision: 'REVISION_REQUESTED',
        feedback: 'Prefer a softer tone in the gradient',
        locale,
      })

      expect(result.html).toContain('logo-v2.svg')
      expect(result.html).toContain('Prefer a softer tone in the gradient')
    })
  }
})

describe('emailInvoiceAvailable', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders invoice number, amount, due date, portal URL`, async () => {
      const result = await emailInvoiceAvailable({
        userName: 'Sophie',
        invoiceNumber: 'INV-2026-042',
        amount: '12 500 €',
        dueDate: '15 juin 2026',
        portalUrl: 'https://example.com/invoices/42',
        locale,
      })

      expect(result.subject).toContain('INV-2026-042')
      expect(result.html).toContain('INV-2026-042')
      expect(result.html).toContain('12 500 €')
      expect(result.html).toContain('15 juin 2026')
      expect(result.html).toContain('https://example.com/invoices/42')
    })
  }
})

describe('emailApprovalReminder', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders project, file, days, and CTA url`, async () => {
      const result = await emailApprovalReminder({
        userName: 'Pierre',
        projectName: 'Campagne Cartier',
        fileName: 'mockup-final.png',
        approvalUrl: 'https://example.com/approval/abc',
        daysPending: 5,
        locale,
      })

      expect(result.subject).toContain('Campagne Cartier')
      expect(result.html).toContain('Pierre')
      expect(result.html).toContain('mockup-final.png')
      expect(result.html).toContain('5')
      expect(result.html).toContain('https://example.com/approval/abc')
    })
  }
})

describe('emailCommentNotification', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders commenter, file, project, comment text, thread URL`, async () => {
      const result = await emailCommentNotification({
        userName: 'Isabelle',
        commenterName: 'Mar Guixa',
        projectName: 'Lookbook Givenchy',
        fileName: 'frame-12.mp4',
        commentText: 'Le cadrage de la scène 3 est trop serré',
        threadUrl: 'https://example.com/threads/xyz',
        locale,
      })

      expect(result.subject).toContain('Mar Guixa')
      expect(result.subject).toContain('frame-12.mp4')
      expect(result.html).toContain('Isabelle')
      expect(result.html).toContain('Mar Guixa')
      expect(result.html).toContain('Lookbook Givenchy')
      expect(result.html).toContain('frame-12.mp4')
      expect(result.html).toContain('Le cadrage de la scène 3 est trop serré')
      expect(result.html).toContain('https://example.com/threads/xyz')
    })
  }
})

describe('emailFileUploaded', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders file, version, project, and project URL`, async () => {
      const result = await emailFileUploaded({
        userName: 'Sophie',
        projectName: 'YSL Spring 2026',
        fileName: 'concept-v4.psd',
        fileVersion: 4,
        projectUrl: 'https://example.com/projects/ysl-spring',
        locale,
      })

      expect(result.subject).toContain('YSL Spring 2026')
      expect(result.html).toContain('Sophie')
      expect(result.html).toContain('concept-v4.psd')
      expect(result.html).toContain('4')
      expect(result.html).toContain('YSL Spring 2026')
      expect(result.html).toContain('https://example.com/projects/ysl-spring')
    })
  }
})

describe('emailProjectStatusChange', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] renders project, phase label, and project URL`, async () => {
      const result = await emailProjectStatusChange({
        userName: 'Marie',
        projectName: 'Initio Parfums Privés — Brand Refresh',
        phaseLabel: locale === 'fr' ? 'Production' : 'In production',
        projectUrl: 'https://example.com/projects/initio',
        locale,
      })

      expect(result.subject).toContain('Initio Parfums Privés — Brand Refresh')
      expect(result.html).toContain('Marie')
      expect(result.html).toContain('Initio Parfums Privés — Brand Refresh')
      expect(result.html).toContain(locale === 'fr' ? 'Production' : 'In production')
      expect(result.html).toContain('https://example.com/projects/initio')
    })
  }
})
