import { describe, expect, it } from 'vitest'
import { clip } from '../utils/promptBudget.js'

describe('clip', () => {
  it('shortens long text and says it did', () => {
    const long = 'x'.repeat(500)
    expect(clip(long, 100)).toHaveLength(100)
    expect(clip(long, 100).endsWith('…')).toBe(true)
  })

  it('collapses the whitespace that inflates a prompt', () => {
    expect(clip('a\n\n   b   \n c')).toBe('a b c')
  })

  it('handles nothing at all', () => {
    expect(clip(undefined)).toBe('')
    expect(clip('')).toBe('')
  })
})
