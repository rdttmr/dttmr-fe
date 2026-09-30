// The API serializes these as their names. The lists are what it sends
// today, but new values (equipment especially) may appear without notice,
// so the fields are typed as plain strings and labelled via exerciseLabel().
export const EQUIPMENT = [
  'floor',
  'rings',
  'pull_up_bar',
  'parallel_bars',
  'low_bar',
  'parallettes',
  'resistance_band',
] as const
export const LOADS = ['bodyweight', 'external'] as const
export const METRICS = ['reps', 'seconds'] as const

export type Equipment = (typeof EQUIPMENT)[number]
export type Load = (typeof LOADS)[number]
export type Metric = (typeof METRICS)[number]

const LABELS: Record<string, string> = {
  floor: 'Floor',
  rings: 'Rings',
  pull_up_bar: 'Pull-up bar',
  parallel_bars: 'Parallel bars',
  low_bar: 'Low bar',
  parallettes: 'Parallettes',
  resistance_band: 'Resistance band',
  bodyweight: 'Bodyweight',
  external: 'External',
  reps: 'Reps',
  seconds: 'Seconds',
}

// Known values get a hand-written label; unknown ones are humanized from the
// snake_case name ("weight_vest" -> "Weight vest") instead of being dropped.
export function exerciseLabel(value: string): string {
  const known = LABELS[value]
  if (known) return known
  const words = value.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export interface Exercise {
  id: string
  name: string
  notes?: string
  equipment?: (Equipment | (string & {}))[]
  load?: Load | (string & {})
  metric?: Metric | (string & {})
  tags?: string[]
  modified_at?: string
}

export interface PaginatedExercises {
  data: Exercise[]
  total: number
  count: number
}
