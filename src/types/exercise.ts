export enum Equipment {
  Unknown = 0,
  Floor = 1,
  Rings = 2,
  PullUpBar = 3,
  ParallelBars = 4,
  LowBar = 5,
  Parallettes = 6,
  ResistanceBand = 7,
}

export enum Load {
  Unknown = 0,
  Bodyweight = 1,
  External = 2,
}

export enum Metric {
  Unknown = 0,
  Reps = 1,
  Seconds = 2,
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  [Equipment.Unknown]: 'Unknown',
  [Equipment.Floor]: 'Floor',
  [Equipment.Rings]: 'Rings',
  [Equipment.PullUpBar]: 'Pull-up bar',
  [Equipment.ParallelBars]: 'Parallel bars',
  [Equipment.LowBar]: 'Low bar',
  [Equipment.Parallettes]: 'Parallettes',
  [Equipment.ResistanceBand]: 'Resistance band',
}

export const LOAD_LABELS: Record<Load, string> = {
  [Load.Unknown]: 'Unknown',
  [Load.Bodyweight]: 'Bodyweight',
  [Load.External]: 'External',
}

export const METRIC_LABELS: Record<Metric, string> = {
  [Metric.Unknown]: 'Unknown',
  [Metric.Reps]: 'Reps',
  [Metric.Seconds]: 'Seconds',
}

export interface Exercise {
  id: string
  name: string
  notes?: string
  equipment?: Equipment[]
  load?: Load
  metric?: Metric
  tags?: string[]
  modified_at?: string
}

export interface PaginatedExercises {
  data: Exercise[]
  total: number
  count: number
}
