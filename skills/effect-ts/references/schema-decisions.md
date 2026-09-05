# Schema decisions

Adapted from [artimath/effect-skills](https://github.com/artimath/effect-skills), MIT. API behavior follows the pinned [official schema and equality source](version-compatibility.md#evidence-for-this-release).

## Choose a representation

Start with the required values and operations. Preserve an existing representation when it meets those requirements. For new plain records, prefer `Schema.Struct` unless a class capability is useful. This is a design default, not an Effect requirement.

| Requirement | Suitable representation | Decision criteria |
| --- | --- | --- |
| Plain record with decoding or encoding | `Schema.Struct` | Supports fields, checks, defaults, and `.make` without class instances. |
| Constructor API, methods, getters, class extension, or instance identity | `Schema.Class` | A class can be useful without methods when callers rely on `new`, class identity, or an established class API. |
| Finite status values without variant-specific fields | `Schema.Literals` | Keep a literal union when the alternatives carry no different data. |
| Variants with different fields | `Schema.Union` of `Schema.TaggedStruct` or structs with literal discriminants | Supports narrowing and matching while retaining plain records. |
| Variants needing class capabilities | `Schema.TaggedClass` with `Schema.Union` | Adds `_tag` and class construction. Tagged classes are one option for unions. |
| Values used as Effect HashMap or HashSet keys | Choose equality semantics first | In this v4 release plain objects compare and hash structurally. A class is not required merely to use a record as a key. |

For custom equality, hashing, or a protocol method such as PrimaryKey, a class is a convenient implementation. It is not the only way to implement a protocol. Equal values must produce equal hashes. Keep keys stable while stored, and distinguish Effect collections from native JavaScript Map and Set, whose object keys use reference identity.

## Plain records and defaults

This record example separates decoding defaults from constructor defaults:

<!-- check: schema-struct -->
```typescript
import { Effect, Schema } from "effect"

export const Limits = Schema.Struct({
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

Decoding defaults fill missing or undefined fields. Add `Schema.withConstructorDefault` when `.make` also needs a default. A decoding transformation does not run merely because a typed value is constructed.

## Classes and custom behavior

This class provides an endpoint getter and explicit equality by host and port:

<!-- check: schema-class -->
```typescript
import { Equal, Hash, Schema } from "effect"

export class RunnerAddress extends Schema.Class<RunnerAddress>("RunnerAddress")({
  host: Schema.NonEmptyString,
  port: Schema.Int,
}) {
  [Equal.symbol](that: Equal.Equal): boolean {
    return that instanceof RunnerAddress && this.host === that.host && this.port === that.port
  }

  [Hash.symbol]() {
    return Hash.string(`${this.host}:${this.port}`)
  }

  get endpoint(): string {
    return `${this.host}:${this.port}`
  }
}
```

Use custom equality only when it matches the domain contract. The example accepts other RunnerAddress instances with equal fields; ordinary structural record equality needs no such implementation.

## Tagged variants

These variants demonstrate class construction and a plain-record alternative. `Match.valueTags` works with a compatible `_tag` union; it does not require classes. A normal `switch` is also suitable for narrowing.

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

// Equivalent data-only variants can use TaggedStruct.
export const Queued = Schema.TaggedStruct("Queued", { recordId: RecordId })
export const Rejected = Schema.TaggedStruct("Rejected", { reason: Schema.String })
export const QueueResult = Schema.Union([Queued, Rejected])

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

`TaggedStruct.make` supplies `_tag` when omitted. Decoding or encoding a tagged struct requires the tag in the input. Choose another encoded representation only when the boundary contract calls for it.

## Nominal brands and runtime validation

Use a brand when confusing otherwise identical TypeScript types would cause a domain error. Plain primitives remain suitable when the distinction adds no useful protection.

`Schema.brand` changes the TypeScript type and adds schema metadata. It adds no runtime checks. A brand over `Schema.String` is valid when any string is allowed. It does not validate an ID format, email address, or URL.

Add base schemas and `Schema.check` predicates for constraints the domain actually requires. Validate unknown data through a decoder at the boundary. Typed construction checks the schema's type-side constraints by default; it does not establish facts absent from that schema. An assertion or disabled constructor checks bypass this protection.

<!-- check: schema-brands -->
```typescript
import { Schema } from "effect"

// Opaque ID: any string is permitted by this contract.
export const ExternalId = Schema.String.pipe(Schema.brand("ExternalId"))

// This local ID contract requires the usr_ prefix and lowercase suffix.
export const UserId = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^usr_[a-z0-9]+$/)),
  Schema.brand("UserId")
)
type UserId = typeof UserId.Type

// This port contract requires an integer in the TCP/UDP port range.
export const Port = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  Schema.brand("Port")
)
type Port = typeof Port.Type
```

Here, `ExternalId` accepts the empty string. `UserId` rejects strings outside its declared pattern, and `Port` rejects non-integers and values outside the range. Do not invent a format for opaque provider IDs. An application requiring email or URL validation must define or reuse that contract separately from its brand.

## Changing an existing model

Change representation to satisfy a concrete requirement. Account for callers using constructors, methods, equality, and encoded forms before migrating.

### Schema-derived types

Infer the TypeScript type from the schema when both describe the same contract. Keep an independently owned interface when integrating an external contract; verify schema compatibility instead of duplicating it without a check.

<!-- fragment: Before and after alternatives; supply a CasId schema and type and import Schema. -->
```typescript
// BEFORE (duplicated)
interface LegacyVaultEntry { readonly casId: CasId; readonly mediaType: string }
const VaultEntrySchema = Schema.Struct({ casId: CasId, mediaType: Schema.String })

// AFTER (single source of truth)
const VaultEntry = Schema.Struct({ casId: CasId, mediaType: Schema.String })
type VaultEntry = typeof VaultEntry.Type
```

### Add a boundary decoder

An existing phantom type can remain when compile-time distinction is sufficient. This alternative adds a decoder and a nonempty-string constraint because the boundary requires them. The brand itself supplies neither check.

<!-- fragment: Before and after alternatives; import Schema and choose one WorkflowId definition. -->
```typescript
// Existing compile-time distinction
type LegacyWorkflowId = string & { readonly _tag: "WorkflowId" }

// Add decoding when the boundary requires a nonempty string.
const WorkflowId = Schema.NonEmptyString.pipe(Schema.brand("WorkflowId"))
type WorkflowId = typeof WorkflowId.Type
```

### Require per-variant data

A literal status remains suitable on its own. Replace unrelated optional fields when particular statuses require particular payloads. Tagged structs, structs with literal fields, and tagged classes can all express that contract. This example uses classes:

<!-- fragment: Before and after alternatives; import Schema and choose one Result definition. -->
```typescript
// Independent optional fields permit success without data.
interface LegacyResult { status: "success" | "failure"; data?: unknown; error?: string }

// Use per-variant fields when the contract requires those combinations.
class Success extends Schema.TaggedClass<Success>()("Success", {
  data: Schema.Unknown,
}) {}
class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}
const Result = Schema.Union([Success, Failure])
type Result = typeof Result.Type
```
