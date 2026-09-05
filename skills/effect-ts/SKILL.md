---
name: effect-ts
description: "Effect v4 implementation and review. Use for Effect services and layers, schemas, typed errors, testing, HTTP clients, CLI tools, config, and process lifetimes. Check the consuming project's version before applying examples."
---

# Effect v4

Supported version: **4.0.0-rc.112**. Compatibility claims apply to this release only.

## Resolve the version first

1. Find the package that owns the code. Read its manifest and lockfile, then resolve its installed `effect/package.json` from that package's directory. Record the exact installed version and the versions of relevant `@effect/*` packages. A manifest range or an `@effect/*` import alone does not establish v4 compatibility.
2. If it resolves to the supported release, use the references below. For v3, use that installed version's official docs and source instead of these examples. For another v4 release, prerelease, missing installation, or conflicting workspace resolutions, treat these examples as unverified. Resolve the discrepancy and check the target APIs before editing. A migration to v4 requires task authorization.
3. Follow [version and source lookup](references/version-compatibility.md) to obtain matching documentation and source. Complete the lookup when each API being changed has a verified signature and relevant behavior at the consuming project's version.
4. Load the topic reference, implement the change, and run the consuming package's typecheck and relevant behavior tests. Report the version used and any examples whose dependencies or behavior remain unverified.

## Services and composition

Use `Context.Service` for tags and explicit layers for implementations. Capture dependencies while constructing the layer so methods require no additional services. Declare the errors methods can actually return.

<!-- check: core-service -->
```typescript
import { Context, Effect, Layer, Schema } from "effect"

const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound", { id: UserId }
) {}

class Users extends Context.Service<Users, {
  readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound>
}>()("@app/Users") {
  static readonly testLayer = Layer.sync(Users, () => {
    const records = new Map<UserId, User>()
    return {
      findById: Effect.fn("Users.findById")(function* (id: UserId) {
        const user = records.get(id)
        if (!user) return yield* new UserNotFound({ id })
        return user
      }),
    }
  })
}

const program = Effect.gen(function* () {
  const users = yield* Users
  return yield* users.findById(UserId.make("user-123"))
}).pipe(
  Effect.catchTag("UserNotFound", (error) =>
    Effect.succeed(new User({ id: error.id, name: "Unknown" }))
  ),
  Effect.provide(Users.testLayer),
)
```

Use unique service identifiers such as `@app/Users`. Use `Effect.gen` for sequential work and named `Effect.fn` functions for operations that benefit from tracing. Compose layers at the entry point. `Layer.provide` hides the provider, `Layer.provideMerge` retains it, and `Layer.mergeAll` combines independent layers. Reuse a layer instance when its resource should be shared within a build.

## Schemas and errors

Use `Schema.Struct` for records without behavior, `Schema.Class<Self>` for records with methods, and tagged classes for variants. Brands distinguish domain values; add constraints when input needs validation. `Schema.Date` accepts Date objects. Use `Schema.DateFromString` for ISO string boundaries.

<!-- check: core-variants -->
```typescript
import { Match, Schema } from "effect"

class Success extends Schema.TaggedClass<Success>()("Success", {
  value: Schema.Number,
}) {}
class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}
const Result = Schema.Union([Success, Failure])
type Result = typeof Result.Type
const render = (result: Result) => Match.valueTags(result, {
  Success: ({ value }) => `Got: ${value}`,
  Failure: ({ error }) => `Error: ${error}`,
})
```

Yield tagged errors for expected failures. Recover by tag with `Effect.catchTag` or `Effect.catchTags`. Use `Effect.catch` for a fallback covering the entire error channel. Keep defects distinct from expected errors.

## Testing and instrumentation

Use `it.effect` with `@effect/vitest` for a test clock and automatic scoping. Use `it.live` for the real clock. Provide fresh layers per test unless a suite intentionally shares a resource with `it.layer`.

<!-- check: core-instrumentation -->
```typescript
import { Effect, Schedule } from "effect"

const fetchWithRetry = Effect.fn("fetchWithRetry")(
  function* (url: string) {
    return yield* Effect.tryPromise(() => fetch(url).then((r) => r.text()))
  },
  Effect.retry(Schedule.max([Schedule.exponential("100 millis"), Schedule.recurs(3)])),
  Effect.timeout("5 seconds"),
)
```

This retries failures up to three times and bounds the whole operation to five seconds. Choose retryable failures and timeout placement for the operation being implemented.

## Reference files

Load these as needed for deeper patterns:

- **[Services & Layers](references/services-and-layers.md)**: Context.Service, service-driven development, test layers, layer memoization, provide vs provideMerge
- **[Data Modeling](references/data-modeling.md)**: Schema.Class, branded types, variants, Match.valueTags, JSON encoding
- **[Schema Decisions](references/schema-decisions.md)**: Schema.Class vs Struct vs TaggedClass decision flowchart, migration patterns
- **[Error Handling](references/error-handling.md)**: Schema.TaggedError, catch/catchTag/catchTags, defects, Schema.Defect(), TypeId/refail patterns
- **[Testing](references/testing.md)**: @effect/vitest setup, it.effect/it.live/it.layer, TestClock, Effect.flip, Context.Reference overrides, worked example
- **[HTTP Clients](references/http-clients.md)**: HttpClient, request building, response decoding, middleware, retries, typed API service
- **[CLI](references/cli.md)**: Command.make, Arguments, Flags, subcommands, worked task manager example
- **[Config](references/config.md)**: Config module, schema validation, ConfigProvider, Redacted, config layers
- **[Processes & Scopes](references/processes.md)**: Fork types, Scope.provide, ChildProcess and ChildProcessSpawner, killable background tasks
- **[Setup](references/setup.md)**: tsconfig, Effect Language Service, project structure, module settings
