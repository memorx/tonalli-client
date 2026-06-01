import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('supabase-client', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('returns null when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-key'
    const { supabase } = await import('@/lib/supabase-client')
    expect(supabase).toBeNull()
  })

  it('returns null when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    const { supabase } = await import('@/lib/supabase-client')
    expect(supabase).toBeNull()
  })

  it('returns null when both env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const { supabase } = await import('@/lib/supabase-client')
    expect(supabase).toBeNull()
  })

  it('returns a Supabase client when both env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key'
    const { supabase } = await import('@/lib/supabase-client')
    expect(supabase).not.toBeNull()
    // sanity: the client should expose the realtime API surface we use
    expect(typeof supabase?.channel).toBe('function')
    expect(typeof supabase?.removeChannel).toBe('function')
  })
})
