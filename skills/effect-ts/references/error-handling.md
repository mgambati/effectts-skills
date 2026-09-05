# Error Handling

## Table of Contents

- [Schema.TaggedError](#schemataggederror)
- [Yieldable Errors](#yieldable-errors)
- [Recovering from Errors](#recovering-from-errors)
- [Expected Errors vs Defects](#expected-errors-vs-defects)
- [Schema.Defect() for Unknown Errors](#schemadefect-for-unknown-errors)

## Schema.TaggedError

Use `Schema.TaggedError` when an error needs schema decoding or encoding and tagged recovery. Existing typed errors can remain when they already provide the required recovery contract:

<!-- check: errors-domain -->
```typescript
import { Schema } from "effect"

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String,
  }
) {}

const AppError = Schema.Union([ValidationError, NotFoundError])
type AppError = typeof AppError.Type
```

**Benefits:**
- Serializable (can send over network, save to DB)
- Type-safe with built-in `_tag` for pattern matching
- Custom methods via class extension
- Sensible default `message` when you don't declare one

Split error tags when callers need different recovery, reporting, or payloads. A shared `NotFoundError` with a resource field is sufficient when callers handle missing resources uniformly. Preserve useful provider errors or map them at the boundary where the public contract changes.

## Yieldable Errors

`Schema.TaggedError` values are yieldable. Yield them directly in generators or use `Effect.fail` where explicit failure construction fits the surrounding code:

<!-- check: errors-yield -->
```typescript
import { Effect, Random, Schema } from "effect"

class BadLuck extends Schema.TaggedError<BadLuck>()(
  "BadLuck",
  { roll: Schema.Number }
) {}

const rollDie = Effect.gen(function* () {
  const roll = yield* Random.nextIntBetween(1, 7)
  if (roll === 1) {
    yield* new BadLuck({ roll }) // no Effect.fail needed
  }
  return { roll }
})
```

## Recovering from Errors

### catch

Handle all errors with a fallback:

Illustrative fragment. program returns string and fails with an Error; import Effect.

<!-- fragment: program returns string and fails with an Error; import Effect. -->
```typescript
const recovered: Effect.Effect<string, never> = program.pipe(
  Effect.catch((error) =>
    Effect.gen(function* () {
      yield* Effect.logError("Error occurred", error)
      return `Recovered from ${error.name}`
    })
  )
)
```

### catchTag

Handle a specific error by its `_tag`:

Illustrative fragment. program has an HttpError with statusCode and message; import Effect.

<!-- fragment: program has an HttpError with statusCode and message; import Effect. -->
```typescript
const recovered = program.pipe(
  Effect.catchTag("HttpError", (error) =>
    Effect.gen(function* () {
      yield* Effect.logWarning(`HTTP ${error.statusCode}: ${error.message}`)
      return "Recovered from HttpError"
    })
  )
)
// HttpError is removed from the error channel; other errors remain
```

### catchTags

Handle multiple error types at once:

Illustrative fragment. program has HttpError and ValidationError variants; import Effect.

<!-- fragment: program has HttpError and ValidationError variants; import Effect. -->
```typescript
const recovered = program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("Recovered from HttpError"),
    ValidationError: () => Effect.succeed("Recovered from ValidationError"),
  })
)
// Both error types removed from the error channel
```

## Expected Errors vs Defects

Effect tracks errors in the type system (`Effect<A, E, R>`) so callers know what can fail and can recover.

**Use typed errors** for domain failures the caller can handle: validation errors, "not found", permission denied, rate limits.

Use defects for bugs and violated invariants. Report them at a boundary that owns the failed computation. A startup program may deliberately convert a configuration failure to a defect when it cannot continue:

Illustrative fragment. loadConfig returns an Effect with a port field; import Effect.

<!-- fragment: loadConfig returns an Effect with a port field; import Effect. -->
```typescript
// At app entry: if config fails, nothing can proceed
const main = Effect.gen(function* () {
  const config = yield* loadConfig.pipe(Effect.orDie)
  yield* Effect.log(`Starting on port ${config.port}`)
})
```

Use `Effect.exit` to inspect the full outcome. Recover with `Effect.catchDefect` when the boundary can isolate the failure and continue safely, such as an independent plugin task. Keep that recovery policy explicit.

## Schema.Defect() for Unknown Errors

Wrap unknown errors from external libraries with `Schema.Defect()`:

<!-- check: errors-api -->
```typescript
import { Schema, Effect } from "effect"

class ApiError extends Schema.TaggedError<ApiError>()(
  "ApiError",
  {
    endpoint: Schema.String,
    statusCode: Schema.Number,
    error: Schema.Defect(), // wraps the underlying error
  }
) {}

const fetchUser = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`).then((r) => r.json()),
    catch: (error) => new ApiError({
      endpoint: `/api/users/${id}`,
      statusCode: 500,
      error,
    }),
  })
```

**Schema.Defect() handles:**
- JavaScript `Error` instances become `{ name, message }` objects
- Other values serialize through Effect's JSON formatter, with a string fallback when needed
- Result is serializable for network/storage

**Use for:** wrapping external library errors, network boundaries, persisting errors to DB, logging systems.

## Advanced Patterns

### TypeId Branding (from Effect core packages)

Brand error families with a TypeId symbol for runtime type discrimination across package boundaries:

<!-- check: errors-typeid -->
```typescript
import { hasProperty, isTagged } from "effect/Predicate"
import { Schema } from "effect"

export const TypeId: unique symbol = Symbol.for("@myapp/AppError")
export type TypeId = typeof TypeId

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  { resource: Schema.String, id: Schema.String }
) {
  readonly [TypeId] = TypeId

  static is(u: unknown): u is NotFoundError {
    return hasProperty(u, TypeId) && isTagged(u, "NotFoundError")
  }
}
```

### Static refail Helper (from @effect/cluster)

Map expected failures into a domain error while preserving interruption and defects:

<!-- check: errors-refail -->
```typescript
import { Effect, Schema } from "effect"

export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  { cause: Schema.Defect() }
) {
  static refail<A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, PersistenceError, R> {
    return Effect.mapError(effect, (cause) => new PersistenceError({ cause }))
  }
}

// Usage: wrap any database call
const safeQuery = PersistenceError.refail(Effect.fail(new Error("Database unavailable")))
```

### Effect.flip (Swap Success/Error for Testing)

Illustrative fragment. Supply MyService, badInput and TestLayer and the Effect and test imports.

<!-- fragment: Supply MyService, badInput and TestLayer and the Effect and test imports. -->
```typescript
it.effect("should fail on invalid input", () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const error = yield* service.doThing(badInput).pipe(Effect.flip)
    expect(error._tag).toBe("ValidationError")
  }).pipe(Effect.provide(TestLayer))
)
```

Patterns adapted from [artimath/effect-skills](https://github.com/artimath/effect-skills) (MIT).
