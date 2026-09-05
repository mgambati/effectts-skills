# Schema Decision Matrix

Adapted from [artimath/effect-skills](https://github.com/artimath/effect-skills) (MIT), updated for Effect v4.

## Decision Tree

```
Is the type used as a key in HashMap/HashSet?
  YES -> Schema.Class (implement Equal/Hash)
  NO  |
      v
Does it need computed properties or methods?
  YES -> Schema.Class
  NO  |
      v
Is it part of a discriminated union (OR type)?
  YES -> Schema.TaggedClass + Schema.Union
  NO  |
      v
Use Schema.Struct
```

## Quick Reference

| Use Schema.Class when... | Use Schema.Struct when... | Use Schema.TaggedClass when... |
|--------------------------|---------------------------|-------------------------------|
| Needs Equal/Hash symbols | Plain DTO, no behavior | Part of a discriminated union |
| Used as HashMap/HashSet key | No identity semantics | Needs automatic `_tag` field |
| Has computed properties/methods | Decoded and passed around | Pattern matched with Match.valueTags |
| Needs PrimaryKey symbol | Simple config or state | One variant of several options |

**Default to Schema.Struct.** Most types are DTOs without behavior.

## Schema.Struct (Most Common)

For DTOs, config objects, state containers:

<!-- check: schema-struct -->
```typescript
import { Effect, Schema } from "effect"

const Limits = Schema.Struct({
  steps: Schema.Number,
  rows: Schema.Number,
  bytes: Schema.Number,
})
type Limits = typeof Limits.Type

const PrincipalId = Schema.NonEmptyString.pipe(Schema.brand("PrincipalId"))

// Nested
const Capability = Schema.Struct({
  issuer: PrincipalId,
  holder: PrincipalId,
  limits: Limits,
})
type Capability = typeof Capability.Type

// With optional + default
export const Config = Schema.Struct({
  timeout: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.succeed(5000))),
  retries: Schema.Number.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(3)),
    Schema.withConstructorDefault(Effect.succeed(3)),
  ),
})
```

Decoding defaults fill missing or undefined fields. For constructor defaults, also use `Schema.withConstructorDefault`. These are separate operations in this release.

## Schema.Class (When Behavior Needed)

Use when the type needs custom equality, hashing, methods, or PrimaryKey:

<!-- check: schema-class -->
```typescript
import { Equal, Hash, Schema } from "effect"

class RunnerAddress extends Schema.Class<RunnerAddress>("RunnerAddress")({
  host: Schema.NonEmptyString,
  port: Schema.Int,
}) {
  [Equal.symbol](that: RunnerAddress): boolean {
    return this.host === that.host && this.port === that.port
  }

  [Hash.symbol]() {
    return Hash.string(`${this.host}:${this.port}`)
  }

  get endpoint(): string {
    return `${this.host}:${this.port}`
  }
}
```

## Schema.TaggedClass (Discriminated Unions)

For union variants with automatic `_tag` discrimination:

<!-- check: schema-tagged -->
```typescript
import { Match, Schema } from "effect"

const RecordId = Schema.NonEmptyString.pipe(Schema.brand("RecordId"))

class Appended extends Schema.TaggedClass<Appended>()("Appended", {
  recordId: RecordId,
}) {}

class AlreadyExists extends Schema.TaggedClass<AlreadyExists>()("AlreadyExists", {
  recordId: RecordId,
}) {}

class Quarantined extends Schema.TaggedClass<Quarantined>()("Quarantined", {
  reason: Schema.String,
}) {}

const AppendResult = Schema.Union([Appended, AlreadyExists, Quarantined])
type AppendResult = typeof AppendResult.Type

// Exhaustive match
const handle = (result: AppendResult) =>
  Match.valueTags(result, {
    Appended: ({ recordId }) => `appended ${recordId}`,
    AlreadyExists: ({ recordId }) => `exists ${recordId}`,
    Quarantined: ({ reason }) => `quarantined: ${reason}`,
  })
```

## Branded Types (Always Add Real Constraints)

Don't brand bare `Schema.String`. Add actual validation:

<!-- check: schema-brands -->
```typescript
import { Effect, Schema } from "effect"

// BAD: brand without constraints
const UnvalidatedUserId = Schema.String.pipe(Schema.brand("UserId"))

// GOOD: brand with real constraints
export const UserId = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^usr_[a-z0-9]+$/)),
  Schema.brand("UserId")
)
type UserId = typeof UserId.Type

// GOOD: numeric brand with range
export const Port = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  Schema.brand("Port")
)
type Port = typeof Port.Type
```

## Migration Patterns

### Interface + Schema to single Schema

Illustrative fragment. Before and after alternatives; supply a CasId schema and type and import Schema.

<!-- fragment: Before and after alternatives; supply a CasId schema and type and import Schema. -->
```typescript
// BEFORE (duplicated)
interface LegacyVaultEntry { readonly casId: CasId; readonly mediaType: string }
const VaultEntrySchema = Schema.Struct({ casId: CasId, mediaType: Schema.String })

// AFTER (single source of truth)
const VaultEntry = Schema.Struct({ casId: CasId, mediaType: Schema.String })
type VaultEntry = typeof VaultEntry.Type
```

### Phantom type to Schema.brand

Illustrative fragment. Before and after alternatives; import Schema and choose one WorkflowId definition.

<!-- fragment: Before and after alternatives; import Schema and choose one WorkflowId definition. -->
```typescript
// BEFORE (compile-time only, no runtime validation)
type LegacyWorkflowId = string & { readonly _tag: "WorkflowId" }

// AFTER (runtime validation)
const WorkflowId = Schema.NonEmptyString.pipe(Schema.brand("WorkflowId"))
type WorkflowId = typeof WorkflowId.Type
```

### String literal union to TaggedClass

Illustrative fragment. Before and after alternatives; import Schema and choose one Result definition.

<!-- fragment: Before and after alternatives; import Schema and choose one Result definition. -->
```typescript
// BEFORE (no narrowing, no per-variant data)
interface LegacyResult { status: "success" | "failure"; data?: unknown; error?: string }

// AFTER (proper discrimination)
class Success extends Schema.TaggedClass<Success>()("Success", {
  data: Schema.Unknown,
}) {}
class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}
const Result = Schema.Union([Success, Failure])
type Result = typeof Result.Type
```

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Schema.Class for simple DTOs | Use Schema.Struct unless needs behavior |
| String literal union in Struct | Use TaggedClass for variants |
| Separate interface + schema | Single schema as source of truth |
| Schema.Class without methods | Prefer Struct for plain records |
| Phantom `& { _tag }` | Use Schema.brand with real constraints |
| `as Type` casts | Use Schema.decodeUnknown |
| Bare `Schema.String.pipe(Schema.brand(...))` | Add real constraints: NonEmptyString, check(isPattern(...)) |
