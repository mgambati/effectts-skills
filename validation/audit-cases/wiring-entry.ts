import { Effect } from "effect"
import { ready } from "./wiring"

export const start = () => Effect.runPromise(ready)
