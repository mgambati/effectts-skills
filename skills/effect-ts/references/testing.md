# Testing

## Table of Contents

- [Setup](#setup)
- [Basic Testing](#basic-testing)
- [Test Function Variants](#test-function-variants)
- [Providing Layers](#providing-layers)
- [TestClock](#testclock)
- [Test Modifiers](#test-modifiers)
- [Logging in Tests](#logging-in-tests)
- [Worked Example](#worked-example)

## Setup

Read the consuming manifest and lockfile for the test runner and dependency versions. Add @effect/vitest only when the task requires its Effect test helpers, using the project's package manager and compatible peer dependencies. For the dependency set checked here, read `validation/package.json` in the full repository.

Config:

<!-- check: testing-config -->
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
})
```

## Basic Testing

Import Effect-specific test helpers from `@effect/vitest`. Ordinary Vitest tests and utilities remain appropriate for code that does not need those helpers:

<!-- check: testing-basic -->
```typescript
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

describe("Calculator", () => {
  it("sync test", () => {
    expect(1 + 1).toBe(2)
  })

  it.effect("effect test", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed(1 + 1)
      expect(result).toBe(2)
    })
  )
})
```

## Test Function Variants

### it.effect

Most common. Provides TestClock and a Scope. Clock starts at 0:

Illustrative fragment. Supply processData and import Effect and it/expect.

<!-- fragment: Supply processData and import Effect and it/expect. -->
```typescript
it.effect("processes data", () =>
  Effect.gen(function* () {
    const result = yield* processData("input")
    expect(result).toBe("expected")
  })
)
```

### it.live

Uses real system clock. Use when you need actual delays or real time:

<!-- check: testing-live -->
```typescript
import { Clock, Effect } from "effect"
import { expect, it } from "@effect/vitest"

it.live("real clock", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBeGreaterThan(0) // actual system time
  })
)
```

### Scoped Resources

Scoping is automatic in v4. Check resource removal in `afterEach`, after the test scope closes:

<!-- check: testing-scoped -->
```typescript
import { Effect, FileSystem } from "effect"
import { NodeFileSystem } from "@effect/platform-node"
import { existsSync, rmSync } from "node:fs"
import { afterEach } from "vitest"
import { expect, it } from "@effect/vitest"

let directory: string | undefined
afterEach(() => {
  if (directory) {
    try { expect(existsSync(directory)).toBe(false) }
    finally { rmSync(directory, { recursive: true, force: true }); directory = undefined }
  }
})

it.effect("temp directory cleaned up", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const tempDir = yield* fs.makeTempDirectoryScoped()
    directory = tempDir
    yield* fs.writeFileString(`${tempDir}/test.txt`, "hello")
    expect(yield* fs.exists(`${tempDir}/test.txt`)).toBe(true)
    // scope closes, tempDir is deleted
  }).pipe(Effect.provide(NodeFileSystem.layer))
)
```

## Providing Layers

Build layers per test when mutable state must start fresh. For state allocation, read [Test implementations](services-and-layers.md#test-implementations). Use `it.layer` for intentional suite-level sharing, such as an expensive database or an immutable fixture. Reset shared mutable state between tests when assertions require isolation.

This test provides a fixed database implementation locally:

Illustrative fragment. Supply Database service with query returning Effect<readonly string[]> and the test imports.

<!-- fragment: Supply Database service with query returning Effect<readonly string[]> and the test imports. -->
```typescript
const testDatabase = Layer.succeed(Database, {
  query: (_sql) => Effect.succeed(["mock", "data"]),
})

it.effect("queries database", () =>
  Effect.gen(function* () {
    const db = yield* Database
    const results = yield* db.query("SELECT *")
    expect(results.length).toBe(2)
  }).pipe(Effect.provide(testDatabase))
)
```

## TestClock

`it.effect` provides TestClock automatically. Use `TestClock.adjust` to simulate time:

<!-- check: testing-clock -->
```typescript
import { Effect, Fiber } from "effect"
import { expect, it } from "@effect/vitest"

import { TestClock } from "effect/testing"

it.effect("time-based test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.delay(Effect.succeed("done"), "10 seconds").pipe(
      Effect.forkChild()
    )
    yield* TestClock.adjust("10 seconds")
    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

## Test Modifiers

Illustrative fragment. Test modifier examples. Replace the sample effects and remove .only before committing a test.

<!-- fragment: Test modifier examples. Replace the sample effects and remove .only before committing a test. -->
```typescript
it.effect.skip("temporarily disabled", () => Effect.void)
it.effect.only("focus on this", () => Effect.void)
it.effect.fails("known bug, expected to fail", () => Effect.fail("expected"))
```

## Logging in Tests

By default, `it.effect` suppresses log output:

<!-- check: testing-logging -->
```typescript
import { Effect, Logger } from "effect"
import { it } from "@effect/vitest"

// Option 1: provide a logger
it.effect("with logging", () =>
  Effect.gen(function* () {
    yield* Effect.log("visible")
  }).pipe(Effect.provide(Logger.layer([Logger.consolePretty()])))
)

// Option 2: it.live enables logging by default
it.live("live with logging", () =>
  Effect.gen(function* () {
    yield* Effect.log("visible")
  })
)
```

## Worked Example

Testing the Events service from [services-and-layers.md](services-and-layers.md#service-driven-development):

### Test layers with in-memory state

<!-- check: testing-events -->
```typescript
import { Clock, Effect, Layer, Option, Schema, Context } from "effect"
import { describe, expect, it } from "@effect/vitest"

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type
const EventId = Schema.String.pipe(Schema.brand("EventId"))
type EventId = typeof EventId.Type
const TicketId = Schema.String.pipe(Schema.brand("TicketId"))
type TicketId = typeof TicketId.Type
const RegistrationId = Schema.String.pipe(Schema.brand("RegistrationId"))
type RegistrationId = typeof RegistrationId.Type

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

class Email extends Schema.Class<Email>("Email")({
  to: Schema.String, subject: Schema.String, body: Schema.String,
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound", { id: UserId }
) {}

// Test layers with mutable in-memory state
class Users extends Context.Service<Users, {
  readonly create: (user: User) => Effect.Effect<void>
  readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound>
}>()("@app/Users") {
  static readonly testLayer = Layer.sync(Users, () => {
    const store = new Map<UserId, User>()
    const create = (user: User) => Effect.sync(() => void store.set(user.id, user))
    const findById = (id: UserId) =>
      Option.fromNullishOr(store.get(id)).pipe(
        Effect.fromOption,
        Effect.catch(() => Effect.fail(new UserNotFound({ id })))
      )
    return { create, findById }
  })
}

class Tickets extends Context.Service<Tickets, {
  readonly issue: (eventId: EventId, userId: UserId) => Effect.Effect<Ticket>
}>()("@app/Tickets") {
  static readonly testLayer = Layer.sync(Tickets, () => {
    let counter = 0
    const issue = (eventId: EventId, _userId: UserId) =>
      Effect.sync(() => new Ticket({
        id: TicketId.make(`ticket-${counter++}`),
        eventId, code: `CODE-${counter}`,
      }))
    return { issue }
  })
}

class Emails extends Context.Service<Emails, {
  readonly send: (email: Email) => Effect.Effect<void>
  readonly sent: Effect.Effect<ReadonlyArray<Email>>
}>()("@app/Emails") {
  static readonly testLayer = Layer.sync(Emails, () => {
    const emails: Array<Email> = []
    const send = (email: Email) => Effect.sync(() => void emails.push(email))
    const sent = Effect.sync(() => emails)
    return { send, sent }
  })
}
```

### The orchestration service

<!-- check: testing-events -->
```typescript
class Events extends Context.Service<Events, {
  readonly register: (eventId: EventId, userId: UserId) => Effect.Effect<Registration, UserNotFound>
}>()("@app/Events") {
  static readonly layer = Layer.effect(Events, Effect.gen(function* () {
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
        yield* emails.send(new Email({
          to: user.email,
          subject: "Event Registration Confirmed",
          body: `Your ticket code: ${ticket.code}`,
        }))
        return registration
      }
    )
    return { register }
  }))
}
```

### Tests

<!-- check: testing-events -->
```typescript
// provideMerge exposes leaf services for setup/assertions
const testLayer = Events.layer.pipe(
  Layer.provideMerge(Users.testLayer),
  Layer.provideMerge(Tickets.testLayer),
  Layer.provideMerge(Emails.testLayer),
)

describe("Events.register", () => {
  // Reusing a Layer value with per-test provide still allocates fresh state.
  for (const run of ["first", "second"]) {
    it.effect(`starts with fresh stores in the ${run} test`, () =>
      Effect.gen(function* () {
        const users = yield* Users
        const emails = yield* Emails
        const events = yield* Events
        const id = UserId.make("isolation-user")
        expect((yield* Effect.flip(users.findById(id)))._tag).toBe("UserNotFound")
        expect(yield* emails.sent).toHaveLength(0)
        yield* users.create(new User({ id, name: "Alice", email: "alice@example.com" }))
        const registration = yield* events.register(EventId.make("event-1"), id)
        expect(registration.ticketId).toBe("ticket-0")
        expect(yield* emails.sent).toHaveLength(1)
      }).pipe(Effect.provide(testLayer))
    )
  }

  it.effect("creates registration with correct data", () =>
    Effect.gen(function* () {
      const users = yield* Users
      const events = yield* Events

      const user = new User({
        id: UserId.make("user-123"),
        name: "Alice", email: "alice@example.com",
      })
      yield* users.create(user)

      const eventId = EventId.make("event-789")
      const registration = yield* events.register(eventId, user.id)

      expect(registration.eventId).toBe(eventId)
      expect(registration.userId).toBe(user.id)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect("sends confirmation email with ticket code", () =>
    Effect.gen(function* () {
      const users = yield* Users
      const events = yield* Events
      const emails = yield* Emails

      const user = new User({
        id: UserId.make("user-456"),
        name: "Bob", email: "bob@example.com",
      })
      yield* users.create(user)

      yield* events.register(EventId.make("event-789"), user.id)

      const sentEmails = yield* emails.sent
      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].to).toBe("bob@example.com")
      expect(sentEmails[0].subject).toBe("Event Registration Confirmed")
      expect(sentEmails[0].body).toContain("CODE-")
    }).pipe(Effect.provide(testLayer))
  )
})
```

## Testing Errors with Effect.flip

Swap the success/error channels to assert on errors:

Illustrative fragment. Supply MyService, badInput and testLayer and the Effect and test imports.

<!-- fragment: Supply MyService, badInput and testLayer and the Effect and test imports. -->
```typescript
it.effect("rejects invalid input", () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const error = yield* service.process(badInput).pipe(Effect.flip)
    expect(error._tag).toBe("ValidationError")
  }).pipe(Effect.provide(testLayer))
)
```

## Test isolation with Context.Reference

Use a reference for a fiber-local override and `Config` for the environment fallback. Providing a reference affects only the wrapped effect and its children. It does not mutate `process.env`.

<!-- check: testing-reference -->
```typescript
import { Config, Context, Effect } from "effect"
import { expect, it } from "@effect/vitest"

const ConfigOverride = Context.Reference<string | undefined>("@app/ConfigOverride", {
  defaultValue: () => undefined,
})

const getConfig = Effect.gen(function* () {
  const override = yield* ConfigOverride
  if (override !== undefined) return override
  return yield* Config.string("MY_CONFIG").pipe(Config.withDefault("/default/path"))
})

it.effect("uses an isolated override", () =>
  Effect.gen(function* () {
    const results = yield* Effect.all([
      getConfig.pipe(Effect.provideService(ConfigOverride, "/first")),
      getConfig.pipe(Effect.provideService(ConfigOverride, "/second")),
    ], { concurrency: "unbounded" })
    expect(results).toEqual(["/first", "/second"])
    expect(yield* ConfigOverride).toBeUndefined()
  })
)
```
