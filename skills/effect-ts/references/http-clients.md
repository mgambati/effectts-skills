# HTTP Clients

## Table of Contents

- [Minimal Example](#minimal-example)
- [Building Requests](#building-requests)
- [Response Decoding](#response-decoding)
- [Client Middleware](#client-middleware)
- [Error Handling](#error-handling)
- [Retries](#retries)
- [Worked Example: Typed API Service](#worked-example-typed-api-service)
- [Quick Reference](#quick-reference)

## Minimal Example

<!-- check: http-minimal -->
```typescript
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http"
import { Effect, Schema } from "effect"

const Repo = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  full_name: Schema.String,
  stargazers_count: Schema.Number,
})

const program = Effect.gen(function* () {
  const response = yield* HttpClient.get("https://api.github.com/repos/Effect-TS/effect")
  const repo = yield* HttpClientResponse.schemaBodyJson(Repo)(response)
  console.log(`${repo.full_name}: ${repo.stargazers_count} stars`)
})

program.pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise)
```

- `HttpClient.get` returns an Effect requiring `HttpClient` in context
- `HttpClientResponse.schemaBodyJson` decodes and validates the JSON body
- `FetchHttpClient.layer` provides the implementation using `fetch`

## Building Requests

### Headers

Illustrative fragment. Generator body; import Effect and the HTTP modules shown.

<!-- fragment: Generator body; import Effect and the HTTP modules shown. -->
```typescript
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

const request = HttpClientRequest.get("https://api.github.com/repos/Effect-TS/effect").pipe(
  HttpClientRequest.setHeader("Accept", "application/vnd.github.v3+json"),
  HttpClientRequest.bearerToken("ghp_xxxx"),
)
const response = yield* HttpClient.execute(request)
```

Helpers: `setHeader`, `setHeaders`, `bearerToken`, `basicAuth`, `acceptJson`.

### Query Parameters

Illustrative fragment. Import HttpClientRequest from effect/unstable/http.

<!-- fragment: Import HttpClientRequest from effect/unstable/http. -->
```typescript
const request = HttpClientRequest.get("https://api.github.com/search/repositories").pipe(
  HttpClientRequest.setUrlParam("q", "effect language:typescript"),
  HttpClientRequest.setUrlParam("sort", "stars"),
)
```

### Request Body

Use `HttpClientRequest.schemaBodyJson` (returns an Effect because encoding can fail):

Illustrative fragment. Generator body; provide owner and repo strings and import Schema and HTTP modules.

<!-- fragment: Generator body; provide owner and repo strings and import Schema and HTTP modules. -->
```typescript
const CreateIssue = Schema.Struct({ title: Schema.String, body: Schema.String })

const request = yield* HttpClientRequest.post(`https://api.github.com/repos/${owner}/${repo}/issues`).pipe(
  HttpClientRequest.schemaBodyJson(CreateIssue)({ title: "Bug", body: "Description" })
)
const response = yield* HttpClient.execute(request)
```

## Response Decoding

### Schema-validated JSON body

Illustrative fragment. Generator body; provide the User schema and import the HTTP modules.

<!-- fragment: Generator body; provide the User schema and import the HTTP modules. -->
```typescript
const response = yield* HttpClient.get("https://api.github.com/users/effect-ts")
const user = yield* HttpClientResponse.schemaBodyJson(User)(response)
```

### Status code matching

Illustrative fragment. Generator body; provide response, User, username and a UserNotFound error constructor.

<!-- fragment: Generator body; provide response, User, username and a UserNotFound error constructor. -->
```typescript
const result = yield* HttpClientResponse.matchStatus(response, {
  "2xx": HttpClientResponse.schemaBodyJson(User),
  404: () => Effect.fail(new UserNotFound(username)),
  orElse: (r) => Effect.fail(new Error(`Unexpected: ${r.status}`)),
})
```

### Filter 2xx only

Illustrative fragment. Generator body; provide response and User and import the HTTP modules.

<!-- fragment: Generator body; provide response and User and import the HTTP modules. -->
```typescript
yield* HttpClientResponse.filterStatusOk(response) // fails on non-2xx
const user = yield* HttpClientResponse.schemaBodyJson(User)(response)
```

## Client Middleware

Use `HttpClient.mapRequest` for transformations applied to all requests:

<!-- check: http-middleware -->
```typescript
import { Effect, Layer, flow } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http"

const GitHubClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient
    return baseClient.pipe(
      HttpClient.mapRequest(
        flow(
          HttpClientRequest.prependUrl("https://api.github.com"),
          HttpClientRequest.bearerToken("ghp_xxxx"),
          HttpClientRequest.setHeader("Accept", "application/vnd.github.v3+json"),
        )
      )
    )
  })
).pipe(Layer.provide(FetchHttpClient.layer))
```

## Error Handling

<!-- check: http-errors -->
```typescript
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"

const Data = Schema.Struct({ value: Schema.String })
const program = Effect.gen(function* () {
  const response = yield* HttpClient.get("https://api.example.com/data")
  yield* HttpClientResponse.filterStatusOk(response)
  return yield* HttpClientResponse.schemaBodyJson(Data)(response)
}).pipe(
  Effect.catchTag("HttpClientError", (error) => {
    const reason = error.reason
    if (reason._tag === "StatusCodeError") {
      return Effect.fail(`HTTP ${reason.response.status}`)
    }
    return Effect.fail(`HTTP client failure: ${reason._tag}`)
  }),
)
```

`HttpClientError` wraps a reason such as `TransportError`, `StatusCodeError`, or `DecodeError`. Inspect `error.reason` or use `Effect.catchReason`. Schema validation adds `Schema.SchemaError` to the error channel. Status filtering is explicit; a successful transport does not imply a 2xx response.

## Retries

Manual retry with schedule:

Illustrative fragment. Supply program and import Effect and Schedule.

<!-- fragment: Supply program and import Effect and Schedule. -->
```typescript
const withRetry = program.pipe(
  Effect.retry(Schedule.max([Schedule.exponential("100 millis"), Schedule.recurs(3)]))
)
```

Built-in transient retry (rate limiting, timeouts, 5xx):

<!-- check: http-retry -->
```typescript
import { Effect, Layer } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"

const ResilientClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    return client.pipe(HttpClient.retryTransient({ times: 3 }))
  })
).pipe(Layer.provide(FetchHttpClient.layer))
```

## Worked Example: Typed API Service

<!-- check: http-service -->
```typescript
import { FetchHttpClient, HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { Effect, Layer, Schema, Context } from "effect"

const UserId = Schema.Number.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  login: Schema.String,
  name: Schema.NullOr(Schema.String),
  public_repos: Schema.Number,
}) {}

class Repo extends Schema.Class<Repo>("Repo")({
  id: Schema.Number,
  name: Schema.String,
  full_name: Schema.String,
  stargazers_count: Schema.Number,
}) {}

export class GitHubApi extends Context.Service<
  GitHubApi,
  {
    readonly getUser: (username: string) => Effect.Effect<User, HttpClientError.HttpClientError | Schema.SchemaError>
    readonly getRepo: (owner: string, repo: string) => Effect.Effect<Repo, HttpClientError.HttpClientError | Schema.SchemaError>
    readonly listRepos: (username: string) => Effect.Effect<ReadonlyArray<Repo>, HttpClientError.HttpClientError | Schema.SchemaError>
  }
>()("GitHubApi") {
  static layer = Layer.effect(
    GitHubApi,
    Effect.gen(function* () {
      const baseClient = yield* HttpClient.HttpClient
      const client = baseClient.pipe(
        HttpClient.mapRequest(HttpClientRequest.prependUrl("https://api.github.com"))
      )

      const getUser = Effect.fn("GitHubApi.getUser")(function* (username: string) {
        const response = yield* client.get(`/users/${username}`)
        yield* HttpClientResponse.filterStatusOk(response)
        return yield* HttpClientResponse.schemaBodyJson(User)(response)
      })

      const getRepo = Effect.fn("GitHubApi.getRepo")(function* (owner: string, repo: string) {
        const response = yield* client.get(`/repos/${owner}/${repo}`)
        yield* HttpClientResponse.filterStatusOk(response)
        return yield* HttpClientResponse.schemaBodyJson(Repo)(response)
      })

      const listRepos = Effect.fn("GitHubApi.listRepos")(function* (username: string) {
        const response = yield* client.get(`/users/${username}/repos`)
        yield* HttpClientResponse.filterStatusOk(response)
        return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Repo))(response)
      })

      return { getUser, getRepo, listRepos }
    })
  )

  static live = GitHubApi.layer.pipe(Layer.provide(FetchHttpClient.layer))
}

// Usage
const program = Effect.gen(function* () {
  const github = yield* GitHubApi
  const user = yield* github.getUser("effect-ts")
  const repo = yield* github.getRepo("Effect-TS", "effect")
  console.log(`${user.login}: ${user.public_repos} repos`)
  console.log(`${repo.full_name}: ${repo.stargazers_count} stars`)
})

const main = program.pipe(Effect.provide(GitHubApi.live))
// At the entry point: Effect.runPromise(main)
```

## Quick Reference

| Concept | API |
|---------|-----|
| Simple GET | `HttpClient.get(url)` |
| Execute request | `HttpClient.execute(request)` |
| Build request | `HttpClientRequest.get`, `.post`, `.put`, `.patch`, `.del` |
| Set headers | `HttpClientRequest.setHeader`, `.bearerToken`, `.basicAuth` |
| Query params | `HttpClientRequest.setUrlParam`, `.setUrlParams` |
| JSON body | `HttpClientRequest.schemaBodyJson(Schema)(data)` |
| Decode response | `HttpClientResponse.schemaBodyJson(Schema)(response)` |
| Status matching | `HttpClientResponse.matchStatus(response, { ... })` |
| Filter 2xx | `HttpClientResponse.filterStatusOk(response)` |
| Base URL | `HttpClient.mapRequest(HttpClientRequest.prependUrl(url))` |
| Retry transient | `HttpClient.retryTransient({ times: 3 })` |
| Provide client | `Effect.provide(FetchHttpClient.layer)` |
