function levenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  let prev: number[] = Array.from({ length: cols }, (_, j) => j)

  for (let i = 1; i < rows; i++) {
    const curr: number[] = [i]
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr.push(Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost))
    }
    prev = curr
  }

  return prev[cols - 1] ?? 0
}

function maxDistanceFor(queryLength: number): number {
  if (queryLength <= 4) return 1
  return 2
}

/**
 * Cheap, local fuzzy substring match: true if `text` contains a run of
 * characters within edit-distance of `query` (tolerating ~1-2 typos).
 */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const t = text.toLowerCase()
  if (t.includes(q)) return true

  const maxDistance = maxDistanceFor(q.length)
  const minLen = Math.max(1, q.length - maxDistance)
  const maxLen = q.length + maxDistance

  for (let len = minLen; len <= maxLen; len++) {
    for (let start = 0; start + len <= t.length; start++) {
      if (levenshtein(q, t.substring(start, start + len)) <= maxDistance) return true
    }
  }

  return false
}
