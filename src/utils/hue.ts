// Curated hues (violets, pinks, corals, teals, blues) - deliberately skipping
// the acid greens/yellows so every generated colour sits well in the palette.
const HUES = [252, 268, 288, 318, 340, 356, 14, 30, 168, 190, 208, 226]

// Deterministic hue (0-359) for a string, so a list/recipe keeps the same
// accent colour everywhere it is shown without having to store one.
export function hueFromString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return HUES[Math.abs(hash) % HUES.length] ?? 252
}
