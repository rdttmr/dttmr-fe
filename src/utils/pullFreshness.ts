// How long a successful pull is trusted before the next one goes back to the
// server. Local writes are already applied optimistically, so re-pulling on
// every screen visit or after every edit mostly re-downloads what is already
// there; changes from other devices show up once this window has passed (or
// right away when the app comes back to the foreground after it).
export const PULL_FRESH_MS = 30_000

// Tracks when each pull (keyed by e.g. "" for a whole collection, or a list
// id for its items) last succeeded. Freshness is per user: logging out does
// not clear local data, so a different account logging in on the same device
// must not skip its first pull.
export function createPullTracker(currentUserId: () => string | null | undefined) {
  const pulledAt = new Map<string, number>()
  const scoped = (key: string) => `${currentUserId() ?? ''}\u0000${key}`

  return {
    isFresh(key = ''): boolean {
      const at = pulledAt.get(scoped(key))
      return at !== undefined && Date.now() - at < PULL_FRESH_MS
    },
    markPulled(key = '') {
      pulledAt.set(scoped(key), Date.now())
    },
    invalidate(key = '') {
      pulledAt.delete(scoped(key))
    },
  }
}
