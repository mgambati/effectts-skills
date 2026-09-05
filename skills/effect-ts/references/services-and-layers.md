# Services & Layers

## Table of Contents

- [Context.Service](#contextservice)
- [Layer Implementations](#layer-implementations)
- [Service-Driven Development](#service-driven-development)
- [Test Implementations](#test-implementations)
- [Providing Layers](#providing-layers)
- [Layer Memoization](#layer-memoization)
- [Sharing Layers Between Tests](#sharing-layers-between-tests)
- [Service lookup with recovery](#service-lookup-with-recovery)

## Context.Service

Use a service when callers need a replaceable dependency or shared resource. Pure functions and explicit parameters remain suitable for local computations. The examples declare tags with `Context.Service`:

<!-- check: services-tags -->
```typescript
import { Effect, Context } from "effect"

class Database extends Context.Service<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>()("@app/Database") {}

class Logger extends Context.Service<
  Logger,
  {
    readonly log: (message: string) => Effect.Effect<void>
  }
>()("@app/Logger") {}
```

Keep identifiers unique among distinct services sharing a context, for example `@app/ServiceName`. Follow the repository's naming and mutability conventions.

Capture stable dependencies during layer construction when methods should be self-contained. A method may retain an environment requirement when the caller owns it, such as a request-specific service or `Scope`. Declare those requirements and the errors the implementation can return.

Use `Effect.gen` for sequential dependent operations. Named `Effect.fn` functions add tracing to operations that need it; direct combinators are suitable for small compositions.

## Layer Implementations

Use `Layer.effect` for effectful implementations and `Layer.sync` for synchronous ones:

<!-- check: services-http -->
```typescript
import { Effect, Layer, Schema, Context } from "effect"
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http"

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}

class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  { id: UserId }
) {}

export class Analytics extends Context.Service<
  Analytics,
  { readonly track: (event: string, data: Record<string, unknown>) => Effect.Effect<void> }
>()("@app/Analytics") {}

export class Users extends Context.Service<
  Users,
  {
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFoundError | HttpClientError.HttpClientError | Schema.SchemaError>
    readonly all: () => Effect.Effect<readonly User[], HttpClientError.HttpClientError | Schema.SchemaError>
  }
>()("@app/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const analytics = yield* Analytics

      const findById = Effect.fn("Users.findById")(function* (id: UserId) {
        yield* analytics.track("user.find", { id })
        const response = yield* http.get(`https://api.example.com/users/${id}`)
        if (response.status === 404) return yield* new UserNotFoundError({ id })
        yield* HttpClientResponse.filterStatusOk(response)
        return yield* HttpClientResponse.schemaBodyJson(User)(response)
      })

      const all = Effect.fn("Users.all")(function* () {
        const response = yield* http.get("https://api.example.com/users")
        yield* HttpClientResponse.filterStatusOk(response)
        return yield* HttpClientResponse.schemaBodyJson(Schema.Array(User))(response)
      })

      return { findById, all }
    })
  )
}
```

The examples use static `layer` and `testLayer` members. Separate exported layers and other repository naming conventions work too.

## Service-Driven Development

When designing orchestration around agreed contracts, sketch leaf service tags first. For an uncertain external API, implement a small integration first to establish the contract. This example demonstrates the contract-first approach:

<!-- check: services-events -->
```typescript
import { Clock, Effect, Layer, Schema, Context } from "effect"

const RegistrationId = Schema.String.pipe(Schema.brand("RegistrationId"))
type RegistrationId = typeof RegistrationId.Type
const EventId = Schema.String.pipe(Schema.brand("EventId"))
type EventId = typeof EventId.Type
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type
const TicketId = Schema.String.pipe(Schema.brand("TicketId"))
type TicketId = typeof TicketId.Type

class User extends Schema.Class<User>("User")({
  id: UserId, name: Schema.String, email: Schema.String,
}) {}

class Registration extends Schema.Class<Registration>("Registration")({
  id: RegistrationId, eventId: EventId, userId: UserId,
  ticketId: TicketId, registeredAt: Schema.Date,
}) {}

class Ticket extends Schema.Class<Ticket>("Ticket")({
  id: TicketId, eventId: EventId, code: Schema.String,
}) {}

// Leaf services: contracts only, no implementations yet
export class Users extends Context.Service<
  Users,
  { readonly findById: (id: UserId) => Effect.Effect<User> }
>()("@app/Users") {}

class Tickets extends Context.Service<
  Tickets,
  { readonly issue: (eventId: EventId, userId: UserId) => Effect.Effect<Ticket> }
>()("@app/Tickets") {}

class Emails extends Context.Service<
  Emails,
  { readonly send: (to: string, subject: string, body: string) => Effect.Effect<void> }
>()("@app/Emails") {}

// Higher-level service: orchestrates leaf services
class Events extends Context.Service<
  Events,
  { readonly register: (eventId: EventId, userId: UserId) => Effect.Effect<Registration> }
>()("@app/Events") {
  static readonly layer = Layer.effect(
    Events,
    Effect.gen(function* () {
      const users = yield* Users
      const tickets = yield* Tickets
      const emails = yield* Emails

      const register = Effect.fn("Events.register")(
        function* (eventId: EventId, userId: UserId) {
          const user = yield* users.findById(userId)
          const ticket = yield* tickets.issue(eventId, userId)
          const now = yield* Clock.currentTimeMillis

          const registration = new Registration({
            id: RegistrationId.make(crypto.randomUUID()),
            eventId, userId, ticketId: ticket.id,
            registeredAt: new Date(now),
          })

          yield* emails.send(
            user.email,
            "Event Registration Confirmed",
            `Your ticket code: ${ticket.code}`
          )

          return registration
        }
      )

      return { register }
    })
  )
}
```

This code compiles and type-checks even though leaf services have no implementations yet. Adding production layers later does not change Events code.

## Test Implementations

Allocate in-memory test state inside `Layer.sync` so each layer build owns its state. Keep mutations synchronous or coordinate concurrent read-modify-write operations explicitly:

<!-- check: services-test -->
```typescript
import { Console, Context, Effect, Layer } from "effect"

class Database extends Context.Service<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>()("@app/Database") {
  static readonly testLayer = Layer.sync(Database, () => {
    const records: Record<string, unknown> = {
      "user-1": { id: "user-1", name: "Alice" },
    }
    const query = (sql: string) => Effect.succeed(Object.values(records))
    const execute = (sql: string) => Console.log(`Test execute: ${sql}`)
    return { query, execute }
  })
}
```

## Providing Layers

Compose long-lived application dependencies at the entry point so their lifetimes and sharing are visible. Provide locally for tests, request scopes, overrides, or intentionally isolated resources:

Illustrative fragment. Composition sketch with application-owned layers and service contracts.

<!-- fragment: Composition sketch with application-owned layers and service contracts. -->
```typescript
// Compose all layers
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(loggerLayer),
  Layer.provideMerge(configLayer),
)

// Program uses services freely
const program = Effect.gen(function* () {
  const users = yield* UserService
  const logger = yield* Logger
  yield* logger.info("Starting...")
  yield* users.getUser()
})

// Provide once
const main = program.pipe(Effect.provide(appLayer))
Effect.runPromise(main)
```

## Layer.provide vs Layer.provideMerge vs Layer.mergeAll

Choose whether the consumer also needs the provider in its output context:

| Method | Deps Satisfied | Available to Program | Use When |
|--------|---------------|---------------------|----------|
| `Layer.provide` | Yes | No | Internal layer building (hide implementation detail) |
| `Layer.provideMerge` | Yes | Yes | Tests needing multiple services, incremental composition |
| `Layer.mergeAll` | No | Yes | Combining independent layers at the same level |

Illustrative fragment. Supply MyService, DatabaseLayer, UserRepo and OrderRepo and import Layer.

<!-- fragment: Supply MyService, DatabaseLayer, UserRepo and OrderRepo and import Layer. -->
```typescript
// Layer.provide: satisfies deps, hides the provider
const internal = MyService.layer.pipe(Layer.provide(DatabaseLayer))
// Result: Layer<MyService> (Database NOT available to program)

// Layer.provideMerge: satisfies deps AND keeps provider accessible
const test = MyService.layer.pipe(Layer.provideMerge(DatabaseLayer))
// Result: Layer<MyService | Database> (both available)

// Layer.mergeAll: combines without resolving deps
const combined = Layer.mergeAll(UserRepo.layer, OrderRepo.layer)
// Result: Layer<UserRepo | OrderRepo, never, SharedDeps> (deps still required)
```

**Common error to recognize:**
```
Effect<A, E, SomeService> is not assignable to Effect<A, E, never>
```
This means `SomeService` is still required. Provide its layer at the boundary. Use `provideMerge` when the program also needs to access a provider retained by another layer.

## Layer Memoization

Within a shared layer build and memo map, Effect memoizes by layer reference identity. Separate builds can allocate separate resources even when they use the same layer value.

Illustrative fragment. Supply Postgres, UserRepo and OrderRepo and import Layer.

<!-- fragment: Supply Postgres, UserRepo and OrderRepo and import Layer. -->
```typescript
// Separate instances: use when each consumer needs its own pool
const separatePools = Layer.merge(
  UserRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://...", poolSize: 10 }))
  ),
  OrderRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://...", poolSize: 10 })) // different ref!
  )
)

// Shared instance: use when both consumers should share a pool
const postgresLayer = Postgres.layer({ url: "postgres://...", poolSize: 10 })

const sharedPool = Layer.merge(
  UserRepo.layer.pipe(Layer.provide(postgresLayer)),
  OrderRepo.layer.pipe(Layer.provide(postgresLayer)) // same ref
)
```

Bind a parameterized layer once in the scope that should share it. Use module scope for a stable application dependency, or a request/factory scope for dynamic configuration and isolation. Construct separate instances when separate resources are intended.

## Sharing Layers Between Tests

Read [Testing](testing.md#providing-layers) when choosing test isolation or suite-level sharing. These examples show the two provisioning forms:

Illustrative fragment. Supply a Counter service and layer with get returning Effect<number>; import Effect and test helpers.

<!-- fragment: Supply a Counter service and layer with get returning Effect<number>; import Effect and test helpers. -->
```typescript
// A separate build per test
it.effect("starts at zero", () =>
  Effect.gen(function* () {
    const counter = yield* Counter
    expect(yield* counter.get()).toBe(0)
  }).pipe(Effect.provide(Counter.layer))
)

// One suite-owned build
it.layer(Counter.layer)("counter", (it) => {
  it.effect("starts at zero", () =>
    Effect.gen(function* () {
      const counter = yield* Counter
      expect(yield* counter.get()).toBe(0)
    })
  )
})
```

See [testing.md](testing.md) for the full worked example.

## Service lookup with recovery

This complete example uses a class constructor for the fallback record and an in-memory layer for lookup.

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
