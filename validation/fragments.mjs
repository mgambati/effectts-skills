// Typed application dependencies for illustrative Markdown fragments.
// The checker compiles the original fragment body; these declarations supply only missing context.
const core = 'import { Config, ConfigProvider, Console, Context, Effect, Layer, Option, Redacted, Schema, Schedule } from "effect";\n';
const test = core + 'import { it, expect } from "@effect/vitest";\n';
const http = core + 'import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";\n';
const cli = core + 'import { Argument, Command, Flag } from "effect/unstable/cli";\n';
const user = 'const User = Schema.Struct({ name: Schema.String });\n';
const response = 'declare const response: HttpClientResponse.HttpClientResponse;\n';
const testService = `class MyService extends Context.Service<MyService, {
  readonly process: (input: string) => Effect.Effect<string, { readonly _tag: "ValidationError" }>;
  readonly doThing: (input: string) => Effect.Effect<string, { readonly _tag: "ValidationError" }>;
}>()("Fixture/MyService") {}
declare const TestLayer: Layer.Layer<MyService>;
declare const testLayer: Layer.Layer<MyService>;
const badInput = "bad";
`;
const layers = `class Database extends Context.Service<Database, {}>()("Fixture/Database") {}
class MyService extends Context.Service<MyService, {}>()("Fixture/MyService") { static layer: Layer.Layer<MyService, never, Database> }
class UserRepo extends Context.Service<UserRepo, {}>()("Fixture/UserRepo") { static layer: Layer.Layer<UserRepo, never, Database> }
class OrderRepo extends Context.Service<OrderRepo, {}>()("Fixture/OrderRepo") { static layer: Layer.Layer<OrderRepo, never, Database> }
declare const DatabaseLayer: Layer.Layer<Database>;
declare const Postgres: { readonly layer: (options: { url: string; poolSize: number }) => Layer.Layer<Database> };
`;
export const fixtures = {
  'cli.md:2': { prelude: cli + 'const TaskId = Schema.Int.pipe(Schema.brand("TaskId"));' },
  'cli.md:4': { prelude: cli },
  'cli.md:5': { prelude: cli + 'const task = Argument.string("task");' },
  'cli.md:10': { prelude: cli + 'const app = Command.make("tasks");' },
  'config.md:4': { prelude: core },
  'config.md:5': { prelude: core, generator: true },
  'config.md:9': { prelude: core + 'const Port = Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })), Schema.brand("Port"));' },
  'data-modeling.md:2': { prelude: core },
  'data-modeling.md:6': { prelude: core },
  'error-handling.md:3': { prelude: core + 'declare const program: Effect.Effect<string, Error>;' },
  'error-handling.md:4': { prelude: core + 'declare const program: Effect.Effect<string, { readonly _tag: "HttpError"; readonly statusCode: number; readonly message: string }>;' },
  'error-handling.md:5': { prelude: core + 'declare const program: Effect.Effect<string, { readonly _tag: "HttpError" } | { readonly _tag: "ValidationError" }>;' },
  'error-handling.md:6': { prelude: core + 'declare const loadConfig: Effect.Effect<{ port: number }, Error>;' },
  'error-handling.md:10': { prelude: test + testService },
  'http-clients.md:2': { prelude: core, generator: true },
  'http-clients.md:3': { prelude: http },
  'http-clients.md:4': { prelude: http + 'const owner = "Effect-TS", repo = "effect";', generator: true },
  'http-clients.md:5': { prelude: http + user, generator: true },
  'http-clients.md:6': { prelude: http + user + response + 'const username = "user"; class UserNotFound extends Error {}', generator: true },
  'http-clients.md:7': { prelude: http + user + response, generator: true },
  'http-clients.md:10': { prelude: core + 'declare const program: Effect.Effect<string, Error>;' },
  'schema-decisions.md:5': { prelude: core + 'const CasId = Schema.NonEmptyString.pipe(Schema.brand("CasId")); type CasId = typeof CasId.Type;' },
  'schema-decisions.md:6': { prelude: core },
  'schema-decisions.md:7': { prelude: core },
  'services-and-layers.md:5': { prelude: core + `class UserService extends Context.Service<UserService, { readonly getUser: () => Effect.Effect<void> }>()("Fixture/UserService") {}
class Logger extends Context.Service<Logger, { readonly info: (message: string) => Effect.Effect<void> }>()("Fixture/Logger") {}
declare const userServiceLayer: Layer.Layer<UserService>;
declare const databaseLayer: Layer.Layer<never>;
declare const loggerLayer: Layer.Layer<Logger>;
declare const configLayer: Layer.Layer<never>;` },
  'services-and-layers.md:6': { prelude: core + layers },
  'services-and-layers.md:7': { prelude: core + layers },
  'services-and-layers.md:8': { prelude: test + 'class Counter extends Context.Service<Counter, { readonly get: () => Effect.Effect<number> }>()("Fixture/Counter") { static layer: Layer.Layer<Counter> }' },
  'testing.md:3': { prelude: test + 'declare const processData: (input: string) => Effect.Effect<string>;' },
  'testing.md:6': { prelude: test + 'class Database extends Context.Service<Database, { readonly query: (sql: string) => Effect.Effect<readonly string[]> }>()("Fixture/Database") {}' },
  'testing.md:8': { prelude: test },
  'testing.md:13': { prelude: test + testService },
};
