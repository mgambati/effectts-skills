# Data modeling

## Schema boundaries

Use a schema when the task needs runtime decoding, encoding, or a type derived from that boundary contract. Existing TypeScript types can remain for internal data with no such requirement.

Read [Schema decisions](schema-decisions.md) before choosing a representation or adding brands and constraints. This reference demonstrates fields, matching, and encoding after that decision.

## Records

This class has a computed `displayName` and a Date field decoded from an ISO string:

<!-- check: model-user -->
```typescript
import { Schema } from "effect"

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

export class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.DateFromString,
}) {
  get displayName() {
    return `${this.name} (${this.email})`
  }
}

const user = new User({
  id: UserId.make("user-123"),
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date(),
})
```

## Variants

Simple string/number alternatives with `Schema.Literals`:

Illustrative fragment. Import Schema from effect.

<!-- fragment: Import Schema from effect. -->
```typescript
const Status = Schema.Literals(["pending", "active", "completed"])
type Status = typeof Status.Type // "pending" | "active" | "completed"
```

This class-based variant example uses `Schema.TaggedClass` and `Schema.Union`:

<!-- check: model-variants -->
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

// Exhaustive pattern matching
const renderResult = (result: Result) =>
  Match.valueTags(result, {
    Success: ({ value }) => `Got: ${value}`,
    Failure: ({ error }) => `Error: ${error}`,
  })
```

## Branded fields

Read [Nominal brands and runtime validation](schema-decisions.md#nominal-brands-and-runtime-validation) for the decision rule. In this example, UserId and PostId distinguish opaque strings; Email is nominal only. Port also has a range check:

<!-- check: model-brands -->
```typescript
import { Schema } from "effect"

// Entity IDs
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

const PostId = Schema.String.pipe(Schema.brand("PostId"))
type PostId = typeof PostId.Type

// Email has no format validation in this example.
const Email = Schema.String.pipe(Schema.brand("Email"))
type Email = typeof Email.Type

const Port = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  Schema.brand("Port")
)
type Port = typeof Port.Type

// Typed calls distinguish brands; assertions can bypass the compiler.
const userId = UserId.make("user-123")
const postId = PostId.make("post-456")

function getUser(id: UserId) { /* ... */ }
// getUser(postId) // Type error: can't pass PostId where UserId expected
```

## JSON encoding and decoding

Use `Schema.fromJsonString` to combine JSON.parse + schema decoding in one step:

<!-- check: model-json -->
```typescript
import { Effect, Schema } from "effect"

class Move extends Schema.Class<Move>("Move")({
  from: Schema.String,
  to: Schema.String,
}) {}

const MoveFromJson = Schema.fromJsonString(Move)

const program = Effect.gen(function* () {
  // Decode from JSON string
  const jsonString = '{"from":"A1","to":"B2"}'
  const move = yield* Schema.decodeUnknownEffect(MoveFromJson)(jsonString)

  // Encode back to JSON string
  const json = yield* Schema.encodeEffect(MoveFromJson)(move)
  return json
})
```

Use the `FromJson` schema (not the base schema) for both decode and encode when working with JSON strings.

## Common schema fields

| Schema | TypeScript Type | Notes |
|--------|----------------|-------|
| `Schema.String` | `string` | |
| `Schema.Number` | `number` | |
| `Schema.Int` | `number` | Integer validation |
| `Schema.Boolean` | `boolean` | |
| `Schema.Date` | `Date` | Accepts a Date object |
| `Schema.DateFromString` | `Date` | Decodes an ISO string |
| `Schema.DateTimeUtc` | `DateTime.Utc` | Effect DateTime |
| `Schema.String.check(Schema.isUUID())` | `string` | UUID format validation |
| `Schema.NonEmptyString` | `string` | Min length 1 |
| `Schema.NullOr(S)` | `T \| null` | Nullable |
| `Schema.Array(S)` | `readonly T[]` | Array of schema |
| `Schema.Struct({...})` | `{...}` | Object shape |
| `Schema.Redacted(S)` | `Redacted<T>` | Hidden in logs |
| `Schema.Defect()` | `unknown` | Wraps unknown errors |

### Validation combinators

Illustrative fragment. Import Schema from effect.

<!-- fragment: Import Schema from effect. -->
```typescript
// String constraints
Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(255)))

// Number constraints
Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
)

// Pattern matching
Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z]+$/)))

// Optional fields
Schema.Struct({
  name: Schema.String,
  bio: Schema.optional(Schema.String),
})
```
