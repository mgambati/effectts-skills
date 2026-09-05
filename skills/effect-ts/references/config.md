# Config

## Table of Contents

- [How Config Works](#how-config-works)
- [Basic Usage](#basic-usage)
- [Config Service Pattern](#config-service-pattern)
- [Config Primitives](#config-primitives)
- [Defaults and Fallbacks](#defaults-and-fallbacks)
- [Validation with Schema](#validation-with-schema)
- [Config Providers](#config-providers)
- [Redacted Secrets](#redacted-secrets)

## How Config Works

By default, `Config` reads from environment variables. Override with `ConfigProvider`:
- **Production**: environment variables (default)
- **Tests**: in-memory maps or `Layer.succeed` with test values
- **Development**: JSON files or hardcoded values

## Basic Usage

<!-- check: config-basic -->
```typescript
import { Config, Effect } from "effect"

const program = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("API_KEY")
  const port = yield* Config.int("PORT")
  yield* Effect.log(`Starting on port ${port}`)
})
```

Override the provider:

<!-- check: config-basic -->
```typescript
import { ConfigProvider, Layer } from "effect"

const testConfigLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ API_KEY: "test-key", PORT: "3000" })
)

Effect.runPromise(program.pipe(Effect.provide(testConfigLayer)))
```

## Config Service Pattern

Use a config service when several operations share validated startup settings or tests need to replace those settings together. Direct Config reads remain suitable for a small operation or values intentionally resolved on each run:

<!-- check: config-service -->
```typescript
import { Config, Effect, Layer, Redacted, Context } from "effect"

export class ApiConfig extends Context.Service<
  ApiConfig,
  {
    readonly apiKey: Redacted.Redacted
    readonly baseUrl: string
    readonly timeout: number
  }
>()("@app/ApiConfig") {
  static readonly layer = Layer.effect(
    ApiConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("API_KEY")
      const baseUrl = yield* Config.string("API_BASE_URL").pipe(
        Config.withDefault("https://api.example.com")
      )
      const timeout = yield* Config.int("API_TIMEOUT").pipe(
        Config.withDefault(30000)
      )
      return { apiKey, baseUrl, timeout }
    })
  )

  // Tests: inline values, no ConfigProvider needed
  static readonly testLayer = Layer.succeed(ApiConfig, {
    apiKey: Redacted.make("test-key"),
    baseUrl: "https://test.example.com",
    timeout: 5000,
  })
}
```

Use `Layer.succeed` with fixed values when testing consumers of the config service. Use `ConfigProvider.fromUnknown` when testing config parsing itself.

## Config Primitives

Illustrative fragment. Config constructors; import Config and Schema from effect.

<!-- fragment: Config constructors; import Config and Schema from effect. -->
```typescript
Config.string("MY_VAR")           // string
Config.number("PORT")             // number
Config.int("MAX_RETRIES")         // integer
Config.boolean("DEBUG")           // boolean
Config.redacted("API_KEY")        // hidden in logs
Config.url("API_URL")             // URL
Config.duration("TIMEOUT")        // Duration
Config.schema(Config.Array(Schema.String), "TAGS") // comma-separated array
```

## Defaults and Fallbacks

Illustrative fragment. Generator body using Config from effect.

<!-- fragment: Generator body using Config from effect. -->
```typescript
// Default only when missing; invalid values still fail
const port = yield* Config.int("PORT").pipe(
  Config.withDefault(3000)
)

// Optional values (returns Option<string>)
const optionalKey = yield* Config.option(Config.string("OPTIONAL_KEY"))
```

## Validation with Schema

Use `Config.schema` for type-safe validation:

<!-- check: config-schema -->
```typescript
import { Config, Effect, Schema } from "effect"

export const Port = Schema.NumberFromString.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  Schema.brand("Port")
)
type Port = typeof Port.Type

const Environment = Schema.Literals(["development", "staging", "production"])

const program = Effect.gen(function* () {
  const port = yield* Config.schema(Port, "PORT")     // branded Port
  const env = yield* Config.schema(Environment, "ENV") // validated enum
})
```

## Config Providers

<!-- check: config-providers -->
```typescript
import { ConfigProvider, Layer } from "effect"

// From object
ConfigProvider.layer(ConfigProvider.fromUnknown({ API_KEY: "key", PORT: "3000" }))

// From JSON
ConfigProvider.layer(ConfigProvider.fromUnknown({ API_KEY: "key", PORT: 8080 }))

// Prefixed env vars (reads APP_API_KEY, APP_PORT, etc.)
ConfigProvider.layer(ConfigProvider.fromEnv().pipe(ConfigProvider.nested("APP")))
```

## Redacted Secrets

Use `Config.redacted` for secret strings, or `Config.schema` with a Redacted schema when the secret needs another parser. Redaction hides the wrapped value in normal logging; extract it only where the consumer needs the raw secret:

<!-- check: config-redacted -->
```typescript
import { Config, Effect, Redacted } from "effect"

const program = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("API_KEY")

  // Extract value when needed
  const headers = { Authorization: `Bearer ${Redacted.value(apiKey)}` }

  // Hidden in logs
  yield* Effect.log(apiKey) // Output: <redacted>
})
```

Use `Schema.RedactedFromValue(Schema.String)` in config schemas:

Illustrative fragment. Uses Port from schema validation plus Context, Config, Effect, Layer, Redacted and Schema imports.

<!-- fragment: Uses Port from schema validation plus Context, Config, Effect, Layer, Redacted and Schema imports. -->
```typescript
class DatabaseConfig extends Context.Service<
  DatabaseConfig,
  { readonly host: string; readonly port: number; readonly password: Redacted.Redacted }
>()("@app/DatabaseConfig") {
  static readonly layer = Layer.effect(DatabaseConfig, Effect.gen(function* () {
    const host = yield* Config.schema(Schema.String, "DB_HOST")
    const port = yield* Config.schema(Port, "DB_PORT")
    const password = yield* Config.schema(Schema.RedactedFromValue(Schema.String), "DB_PASSWORD")
    return { host, port, password }
  }))
}
```
