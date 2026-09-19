import { describe, it, expect } from 'vitest'
import { rebaseOrder } from '../orderRebase'

describe('rebaseOrder', () => {
  it('returns the intended order unchanged when it already matches the server', () => {
    const server = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(rebaseOrder(['c', 'a', 'b'], server)).toEqual(['c', 'a', 'b'])
  })

  it('drops ids the server no longer has', () => {
    expect(rebaseOrder(['c', 'gone', 'a'], [{ id: 'a' }, { id: 'c' }])).toEqual(['c', 'a'])
  })

  it('puts items the user never saw on top, newest first', () => {
    const server = [
      { id: 'a', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'b', created_at: '2024-01-02T00:00:00.000Z' },
      { id: 'new-old', created_at: '2024-02-01T00:00:00.000Z' },
      { id: 'new-newest', created_at: '2024-03-01T00:00:00.000Z' },
    ]
    expect(rebaseOrder(['b', 'a'], server)).toEqual(['new-newest', 'new-old', 'b', 'a'])
  })

  it('handles adds and deletes together while preserving the dragged relative order', () => {
    const server = [{ id: 'x', created_at: '2024-05-01T00:00:00.000Z' }, { id: 'a' }, { id: 'c' }]
    expect(rebaseOrder(['c', 'b', 'a'], server)).toEqual(['x', 'c', 'a'])
  })

  it('does not mutate its inputs', () => {
    const intended = ['b', 'a']
    const server = [{ id: 'a' }, { id: 'b' }]
    rebaseOrder(intended, server)
    expect(intended).toEqual(['b', 'a'])
    expect(server).toEqual([{ id: 'a' }, { id: 'b' }])
  })
})
