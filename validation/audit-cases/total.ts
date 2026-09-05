import { Effect } from "effect"

// Contract: each run reads once and returns the sum, including zero for no entries.
export const total = (read: Effect.Effect<readonly number[]>) => read.pipe(
  Effect.map(values => values.reduce((sum, value) => sum + value, 0)),
)
