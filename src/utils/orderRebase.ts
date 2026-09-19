// The order endpoints (POST /lists/order, POST /recipes/order) re-assign the
// display order of ALL of a user's items and reject any id list that doesn't
// match the server's current set exactly ("stale ids"). A reorder queued
// offline can therefore go stale: another device created or deleted an item
// in the meantime.
//
// Rebuilds the user's intended order against what the server actually has:
// ids the server no longer knows are dropped, ids the user never saw (created
// elsewhere) go on top - new items always land first - newest first, and
// everything else keeps the relative order the user dragged it into.
export function rebaseOrder(
  intendedIds: string[],
  serverItems: { id: string; created_at?: string }[],
): string[] {
  const serverIds = new Set(serverItems.map((item) => item.id))
  const kept = intendedIds.filter((id) => serverIds.has(id))
  const keptSet = new Set(kept)
  const unseen = serverItems
    .filter((item) => !keptSet.has(item.id))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map((item) => item.id)

  return [...unseen, ...kept]
}
