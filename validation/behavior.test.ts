import { expect, it } from "@effect/vitest"
import { Config, ConfigProvider, Effect, Exit, FileSystem, Layer, PlatformError, Redacted, Schema } from "effect"
import { NodeServices } from "@effect/platform-node"
import { FetchHttpClient } from "effect/unstable/http"
import { Config as Defaults } from "./generated/schema-struct"
import { User } from "./generated/model-user"
import { ExampleFromJson } from "./generated/generateSchemaScaffold"
import { UserId } from "./generated/schema-brands"
import { ApiConfig } from "./generated/config-service"
import { Port } from "./generated/config-schema"
import { GitHubApi } from "./generated/http-service"
import { Users, Analytics } from "./generated/services-http"
import { TaskRepo } from "./generated/cli-repository"
import { runWithInput } from "./generated/process-input"
import { startBackground } from "./generated/process-background"

it.effect("decoding defaults apply to missing and undefined fields", () => Effect.gen(function* () {
  expect(Defaults.make({ timeout: 5000 })).toEqual({ timeout: 5000, retries: 3 })
  const decode = Schema.decodeUnknownEffect(Defaults)
  expect(yield* decode({})).toEqual({ timeout: 5000, retries: 3 })
  expect(yield* decode({ timeout: undefined })).toEqual({ timeout: 5000, retries: 3 })
  expect(Exit.isFailure(yield* Effect.exit(decode({ retries: "bad" })))).toBe(true)
}))

it.effect("branded IDs enforce their pattern", () => Effect.gen(function* () {
  expect(yield* Schema.decodeUnknownEffect(UserId)("usr_a123")).toBe("usr_a123")
  expect(Exit.isFailure(yield* Effect.exit(Schema.decodeUnknownEffect(UserId)("bad")))).toBe(true)
}))

it.effect("Date model round trips through JSON with an ISO string", () => Effect.gen(function* () {
  const json = Schema.fromJsonString(User)
  const input = '{"id":"user-1","name":"Alice","email":"alice@example.com","createdAt":"2026-09-05T00:00:00.000Z"}'
  const user = yield* Schema.decodeUnknownEffect(json)(input)
  expect(user.createdAt).toBeInstanceOf(Date)
  expect(JSON.parse(yield* Schema.encodeEffect(json)(user))).toEqual(JSON.parse(input))
}))

it.effect("generated schema scaffold round trips its Date through JSON", () => Effect.gen(function* () {
  const input = '{"id":"example-1","name":"Example","createdAt":"2026-09-05T00:00:00.000Z"}'
  const value = yield* Schema.decodeUnknownEffect(ExampleFromJson)(input)
  expect(value.createdAt).toBeInstanceOf(Date)
  expect(JSON.parse(yield* Schema.encodeEffect(ExampleFromJson)(value))).toEqual(JSON.parse(input))
}))

it.effect("config parses ports and redacted values and rejects invalid defaults", () => Effect.gen(function* () {
  const provider = ConfigProvider.fromUnknown({ API_KEY: "secret", PORT: "3000", DB_PASSWORD: "password" })
  expect(yield* Config.schema(Port, "PORT").parse(provider)).toBe(3000)
  const password = yield* Config.schema(Schema.RedactedFromValue(Schema.String), "DB_PASSWORD").parse(provider)
  expect(Redacted.value(password)).toBe("password")
  const config = yield* ApiConfig.pipe(Effect.provide(ApiConfig.layer), Effect.provide(ConfigProvider.layer(provider)))
  expect(config.timeout).toBe(30000)
  const invalid = ConfigProvider.fromUnknown({ API_KEY: "secret", API_TIMEOUT: "oops" })
  expect(Exit.isFailure(yield* Effect.exit(ApiConfig.pipe(Effect.provide(ApiConfig.layer), Effect.provide(ConfigProvider.layer(invalid)))))).toBe(true)
  const tags = yield* Config.schema(Config.Array(Schema.String), "TAGS").parse(ConfigProvider.fromEnv({ env: { TAGS: "a,b" } }))
  expect(tags).toEqual(["a", "b"])
  const prefixed = ConfigProvider.fromEnv({ env: { APP_PORT: "3000" } }).pipe(ConfigProvider.nested("APP"))
  expect(yield* Config.int("PORT").parse(prefixed)).toBe(3000)
}))

const mockHttp = (status: number, data: unknown) => FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, async () => new Response(JSON.stringify(data), { status }))),
)
const analytics = Layer.succeed(Analytics, { track: () => Effect.void })

it.effect("HTTP service retains schema, status and transport failures", () => Effect.gen(function* () {
  const get = GitHubApi.use((api) => api.getUser("alice"))
  const run = (status: number, data: unknown) => get.pipe(Effect.provide(GitHubApi.layer.pipe(Layer.provide(mockHttp(status, data)))))
  const user = yield* run(200, { id: 1, login: "alice", name: null, public_repos: 2 })
  expect(user.login).toBe("alice")
  expect((yield* Effect.flip(run(200, { invalid: true })))._tag).toBe("SchemaError")
  const statusError = yield* Effect.flip(run(500, {}))
  expect(statusError._tag).toBe("HttpClientError")
  if (statusError._tag === "HttpClientError") expect(statusError.reason._tag).toBe("StatusCodeError")
  const failedFetch = FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, async () => { throw new Error("offline") })))
  const transport = yield* Effect.flip(get.pipe(Effect.provide(GitHubApi.layer.pipe(Layer.provide(failedFetch)))))
  expect(transport._tag).toBe("HttpClientError")
  if (transport._tag === "HttpClientError") expect(transport.reason._tag).toBe("TransportError")
}))

it.effect("404 maps to the requested UserId while other HTTP failures remain typed", () => Effect.gen(function* () {
  const id = Schema.String.pipe(Schema.brand("UserId")).make("missing")
  const lookup = Users.use((users) => users.findById(id))
  const run = (status: number) => lookup.pipe(Effect.provide(Users.layer.pipe(Layer.provide(Layer.merge(mockHttp(status, {}), analytics)))))
  const missing = yield* Effect.flip(run(404))
  expect(missing._tag).toBe("UserNotFoundError")
  if (missing._tag === "UserNotFoundError") expect(missing.id).toBe(id)
  expect((yield* Effect.flip(run(500)))._tag).toBe("HttpClientError")
}))

it.effect("task repository writes, reloads, toggles and preserves corrupt-file errors", () => Effect.gen(function* () {
  let content: string | undefined
  const fsLayer = FileSystem.layerNoop({
    readFileString: () => content === undefined
      ? Effect.fail(PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "readFileString" }))
      : Effect.succeed(content),
    writeFileString: (_path, value) => Effect.sync(() => { content = value }),
  })
  const exercise = Effect.gen(function* () {
    const repo = yield* TaskRepo
    expect(yield* repo.list()).toEqual([])
    const task = yield* repo.add("buy milk")
    expect((yield* repo.list())[0].text).toBe("buy milk")
    yield* repo.toggle(task.id)
    expect(yield* repo.list()).toEqual([])
    expect((yield* repo.list(true))[0].done).toBe(true)
    content = "bad json"
    expect((yield* Effect.flip(repo.list()))._tag).toBe("SchemaError")
    expect(content).toBe("bad json")
  })
  yield* exercise.pipe(Effect.provide(TaskRepo.layer.pipe(Layer.provide(fsLayer))))
}))

it.live("stdin and both output pipes drain without blocking", () => Effect.gen(function* () {
  const input = "x".repeat(256 * 1024)
  const result = yield* runWithInput("cat; printf err >&2", input)
  expect(result.exitCode).toBe(0)
  expect(result.output).toBe(input)
  expect(result.stderr).toBe("err")
}))

it.live("background stop and owner scope close terminate the child", () => Effect.gen(function* () {
  const stopped = yield* startBackground("exec sleep 30")
  expect(yield* stopped.process.isRunning).toBe(true)
  yield* stopped.stop
  expect(yield* stopped.process.isRunning).toBe(false)
  const owned = yield* Effect.scoped(startBackground("exec sleep 30"))
  expect(yield* owned.process.isRunning).toBe(false)
}).pipe(Effect.provide(NodeServices.layer)))
