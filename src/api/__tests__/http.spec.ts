import { describe, it, expect } from 'vitest'
import { ApiError, isServerRejection } from '../http'

describe('isServerRejection', () => {
  it.each([400, 403, 404, 409, 422])('treats a %i response as a final rejection', (status) => {
    expect(isServerRejection(new ApiError('Nope', status))).toBe(true)
  })

  it.each([401, 408, 429])('does not treat a %i response as final', (status) => {
    expect(isServerRejection(new ApiError('Try later', status))).toBe(false)
  })

  it.each([500, 502, 503])('does not treat a %i server error as final', (status) => {
    expect(isServerRejection(new ApiError('Broken', status))).toBe(false)
  })

  it('does not treat a network failure or other error as final', () => {
    expect(isServerRejection(new TypeError('Failed to fetch'))).toBe(false)
    expect(isServerRejection(new Error('Sync failed'))).toBe(false)
    expect(isServerRejection('boom')).toBe(false)
  })
})
