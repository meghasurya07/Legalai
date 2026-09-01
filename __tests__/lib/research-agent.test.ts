import { describe, expect, it } from 'vitest'
import { formatResearchContext, type WebResearchResult } from '@/lib/solari/research-agent'
import { isSolariConfigured, getSolariApiKey } from '@/lib/solari/client'

describe('Solari Client Configuration', () => {
  it('isSolariConfigured returns true when fallback or env key exists', () => {
    expect(isSolariConfigured()).toBe(true)
    expect(getSolariApiKey()).toContain('slr_live_')
  })
})

describe('formatResearchContext', () => {
  it('returns default message when sources array is empty', () => {
    const emptyResult: WebResearchResult = {
      query: 'sovereign immunity',
      sources: [],
      sessionId: 'session_123',
      durationMs: 500,
      searchedSources: ['Google Scholar', 'Cornell LII'],
    }
    expect(formatResearchContext(emptyResult)).toBe('No relevant legal sources found from web research.')
  })

  it('formats multiple legal sources with citations, snippets, and URLs', () => {
    const result: WebResearchResult = {
      query: 'sovereign immunity state courts',
      sources: [
        {
          title: 'Alden v. Maine',
          citation: '527 U.S. 706 (1999)',
          date: '1999',
          url: 'https://scholar.google.com/scholar_case?case=123',
          source: 'google_scholar',
          snippet: 'States retain sovereign immunity in their own courts.',
        },
        {
          title: 'Sovereign Immunity Wex Entry',
          citation: 'Cornell Law School LII',
          url: 'https://www.law.cornell.edu/wex/sovereign_immunity',
          source: 'cornell_lii',
          snippet: 'Overview of federal and state sovereign immunity.',
        },
      ],
      sessionId: 'session_456',
      durationMs: 1200,
      searchedSources: ['Google Scholar', 'Cornell LII'],
    }

    const context = formatResearchContext(result)
    expect(context).toContain('## Web Research Results (2 sources found)')
    expect(context).toContain('Alden v. Maine')
    expect(context).toContain('527 U.S. 706 (1999)')
    expect(context).toContain('https://scholar.google.com/scholar_case?case=123')
    expect(context).toContain('Cornell Law School LII')
  })
})
