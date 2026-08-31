import { describe, it, expect } from 'vitest'
import { fuzzyMatch } from '../fuzzyMatch'

describe('fuzzyMatch', () => {
  it('matches an empty query against anything', () => {
    expect(fuzzyMatch('', 'Groceries')).toBe(true)
    expect(fuzzyMatch('   ', 'Groceries')).toBe(true)
  })

  it('matches an exact substring, case-insensitively', () => {
    expect(fuzzyMatch('milk', 'Buy milk and eggs')).toBe(true)
    expect(fuzzyMatch('MILK', 'buy milk and eggs')).toBe(true)
  })

  it('tolerates a couple of off characters', () => {
    expect(fuzzyMatch('mikl', 'Buy milk and eggs')).toBe(true)
    expect(fuzzyMatch('grocries', 'Groceries')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(fuzzyMatch('xyz', 'Groceries')).toBe(false)
    expect(fuzzyMatch('banana', 'Groceries')).toBe(false)
  })
})
