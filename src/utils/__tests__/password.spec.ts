import { describe, it, expect } from 'vitest'
import { passwordProblem } from '../password'

describe('passwordProblem', () => {
  it('accepts passwords between 8 characters and 72 bytes', () => {
    expect(passwordProblem('password')).toBeNull()
    expect(passwordProblem('a'.repeat(72))).toBeNull()
  })

  it('rejects short passwords', () => {
    expect(passwordProblem('short')).toContain('at least 8')
  })

  it('counts bytes, not characters, against the upper limit', () => {
    expect(passwordProblem('a'.repeat(73))).toContain('too long')
    expect(passwordProblem('ü'.repeat(36))).toBeNull()
    expect(passwordProblem('ü'.repeat(37))).toContain('too long')
  })
})
