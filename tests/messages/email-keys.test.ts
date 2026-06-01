import { describe, it, expect } from 'vitest'
import fr from '../../messages/fr.json'
import en from '../../messages/en.json'

// Keys referenced by the email templates. If a template adds a new key,
// add it here AND to messages/{fr,en}.json — this test catches drift.
const REQUIRED_EMAIL_KEYS = [
  'common.greeting',
  'common.footer',
  'welcome.subject',
  'welcome.title',
  'welcome.body',
  'welcome.cta',
  'newApprovalRequest.subject',
  'newApprovalRequest.title',
  'newApprovalRequest.body',
  'newApprovalRequest.cta',
  'approvalConfirmation.subjectApproved',
  'approvalConfirmation.subjectRejected',
  'approvalConfirmation.titleApproved',
  'approvalConfirmation.titleRejected',
  'approvalConfirmation.bodyApproved',
  'approvalConfirmation.bodyRejected',
  'approvalConfirmation.feedbackLabel',
  'invoiceAvailable.subject',
  'invoiceAvailable.title',
  'invoiceAvailable.body',
  'invoiceAvailable.amountLabel',
  'invoiceAvailable.dueLabel',
  'invoiceAvailable.cta',
  'approvalReminder.subject',
  'approvalReminder.title',
  'approvalReminder.body',
  'approvalReminder.cta',
  'commentNotification.subject',
  'commentNotification.title',
  'commentNotification.intro',
  'commentNotification.commentLabel',
  'commentNotification.cta',
  'fileUploaded.subject',
  'fileUploaded.title',
  'fileUploaded.body',
  'fileUploaded.cta',
  'projectStatusChange.subject',
  'projectStatusChange.title',
  'projectStatusChange.body',
  'projectStatusChange.cta',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(obj: any, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as object)) {
      return (acc as Record<string, unknown>)[k]
    }
    return undefined
  }, obj)
}

describe('email translation keys', () => {
  for (const key of REQUIRED_EMAIL_KEYS) {
    it(`fr.email.${key} exists and is a string`, () => {
      const value = get(fr.email, key)
      expect(typeof value).toBe('string')
      expect(value).not.toBe('')
    })

    it(`en.email.${key} exists and is a string`, () => {
      const value = get(en.email, key)
      expect(typeof value).toBe('string')
      expect(value).not.toBe('')
    })
  }

  it('fr and en email namespaces have identical keys (parity)', () => {
    function flatten(obj: unknown, prefix = ''): string[] {
      if (!obj || typeof obj !== 'object') return []
      const keys: string[] = []
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'object' && v !== null) {
          keys.push(...flatten(v, path))
        } else {
          keys.push(path)
        }
      }
      return keys.sort()
    }
    expect(flatten(fr.email)).toEqual(flatten(en.email))
  })
})
