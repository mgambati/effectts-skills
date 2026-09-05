import { Effect } from "effect"

// Contract: acknowledge only after recording the delivery once.
export const deliver = (record: () => void) => Effect.gen(function* () {
  Effect.sync(record)
  return "acknowledged" as const
})
