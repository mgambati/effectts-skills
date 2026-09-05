# Version compatibility

This skill supports `effect@4.0.0-rc.112`. The companion packages checked here are `@effect/platform-node`, `@effect/platform-bun`, and `@effect/vitest`, all at `4.0.0-rc.112`. The validation project pins the full dependency set and lockfile in `validation/`.

## Identify the consuming version

Start in the workspace package that owns the target file. Read its `package.json`, the workspace lockfile, and the installed package metadata. Resolve `effect/package.json` relative to that workspace package, for example with Node's `createRequire` anchored to its manifest. Check package manager dependency output when hoisting, aliases, catalogs, or multiple versions make the resolution ambiguous.

Record the installed version, not just a range such as `^4.0.0-rc.112`. Check relevant `@effect/*` installed versions and their peer dependency ranges too. The extension's version detection is a convenience; it does not validate every workspace package or companion dependency.

For v3, use that project's installed v3 release and official v3 source and docs. These references are v4 guidance. For any other v4 release, prerelease, unresolved installation, or conflicting lockfile and installed state, verify the APIs against the actual target before adapting these examples. Keep the current version unless the task authorizes a migration.

## Fetch matching documentation

Use the configured Context7 workflow. Resolve the official library first, then query the version ID returned by that lookup. Keep each query about one concept and include the exact installed version.

```bash
npx ctx7@latest library Effect "Effect 4.0.0-rc.112 schema defaults and Date migration semantics"
npx ctx7@latest docs /effect-ts/effect/effect_4.0.0-rc.112 "How do schema decoding defaults and constructor defaults work in Effect 4.0.0-rc.112?"
```

The version ID above was returned by the lookup for this release. Resolve again for another version; never invent an ID. Stay within the configured three-command limit per question. If Context7 lacks the exact version, use matching official source. A result linked to `main`, or a migration page's v3 example, is not evidence of the supported v4 signature.

Run lookup commands with network access. If a quota error occurs, report it and suggest `npx ctx7@latest login` or `CONTEXT7_API_KEY`. If a sandbox causes a network error, use the environment's permitted network-enabled execution path. Report an unavailable source instead of claiming compatibility from memory.

## Verify against official source

For this release, the official tag `effect@4.0.0-rc.112` resolves to commit `2600f62f4532026928454dcea8d1c48557b3f942`. Inspect the installed npm package's `src/` and declarations for the delivered API, and the tagged repository for migration guides, tests, and examples.

Use a temporary source checkout or a verified local mirror. Verify its origin and revision before trusting it. A default-branch clone is not version matching. Avoid changing an existing checkout with unrelated work. Keep downloaded source outside product commits.

```bash
git clone --depth 1 --branch effect@4.0.0-rc.112 https://github.com/Effect-TS/effect.git /tmp/effect-rc112-source
git -C /tmp/effect-rc112-source rev-parse HEAD
rg 'export.*TaggedError|withDecodingDefaultType' /tmp/effect-rc112-source/packages/effect/src/Schema.ts
```

Choose an unused destination if that temporary directory exists. For other installed releases, resolve and verify their official tag or published source revision. If no matching source is available, state the gap and leave that version unverified.

## Evidence for this release

All links below identify the verified commit.

| Topic | Official evidence |
| --- | --- |
| Services and fiber-local values | [Service migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/services.md), [FiberRef migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/fiberref.md) |
| Schemas, dates, defaults, redaction | [Schema migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/schema.md), [Schema source](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Schema.ts) |
| Forks and scopes | [Fork migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/forking.md), [Scope migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/scope.md) |
| Child processes | [ChildProcess](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/process/ChildProcess.ts), [ChildProcessSpawner](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/process/ChildProcessSpawner.ts) |
| HTTP requests, status, errors | [HTTP source directory](https://github.com/Effect-TS/effect/tree/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/http) |
| CLI parsing and execution | [CLI source directory](https://github.com/Effect-TS/effect/tree/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/cli) |
| Config providers and fallback | [Config](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Config.ts), [ConfigProvider](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/ConfigProvider.ts) |
| Testing | [Vitest source](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/vitest/src/index.ts), [test clock](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/testing/TestClock.ts) |
| Errors, layers, schedules | [Error migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/error-handling.md), [Layer](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Layer.ts), [Schedule](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Schedule.ts) |

## Example coverage

`validation/check.mjs` extracts TypeScript fences and compiles complete examples and grouped worked examples against exact dependencies. It also executes the actual scaffold generators and compiles their output. Each fence has a check marker or an explicit illustrative-fragment label. Unclassified fences fail validation.

A complete module can still require a runtime service or platform at its application boundary. Typechecking does not imply that a network call, Bun runtime, or application placeholder has run. Consult `validation/README.md` for reproducible checks and the runtime tests performed.
