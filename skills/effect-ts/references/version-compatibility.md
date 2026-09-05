# Version compatibility

The examples target `effect@4.0.0-rc.112`. The validation manifest and lockfile own the exact companion and toolchain versions. When maintaining the full repository, read `validation/README.md`; a skills-only installation does not include that project.

## Identify the consuming version

Start in the workspace package that owns the target file. Read its `package.json`, the workspace lockfile, and the installed package metadata. Resolve `effect/package.json` relative to that workspace package, for example with Node's `createRequire` anchored to its manifest. Check package manager dependency output when hoisting, aliases, catalogs, or multiple versions make the resolution ambiguous.

Record the installed version, not just a range such as `^4.0.0-rc.112`. Check relevant `@effect/*` installed versions and their peer dependency ranges too. The extension's version detection is a convenience; it does not validate every workspace package or companion dependency.

For v3, use that project's installed v3 release and official v3 source and docs. These references are v4 guidance. For any other v4 release, prerelease, unresolved installation, or conflicting lockfile and installed state, verify the APIs against the actual target before adapting these examples. Keep the current version unless the task authorizes a migration.

## Find matching source and documentation

1. Start with the consuming installation's package source and declarations. Resolve them through that package's own environment, including its package manager loader when necessary. A workspace root's installation may differ from the package being edited.
2. Follow any repository documentation-lookup instructions. If Context7 is available, resolve the official library, then query the returned version ID for the installed release and the API in question. Use only IDs returned by the lookup. If the exact version is absent, use the matching published source. Check the revision behind each result; a default-branch link or a migration guide's old example is not evidence for the target signature.
3. When the installed package lacks needed tests or migration material, locate a matching official release tag or published source revision. For this reference release, `effect@4.0.0-rc.112` resolves to `2600f62f4532026928454dcea8d1c48557b3f942`. For another release, establish its mapping before downloading source.
4. Use an existing mirror only after verifying its origin and revision. Otherwise create an isolated checkout under an unused temporary or cache directory supplied by the environment. Fetch the verified tag or revision from the official Effect repository and confirm the checkout's HEAD matches it. Preserve existing checkouts and keep downloaded source outside product commits.
5. Read the relevant implementation, exported signature, and tests. Finish when they establish the behavior being changed at the consuming version. Record the version and evidence used. If source or network access is unavailable, report the gap and leave the affected API unverified.

A docs CLI is optional for skills-only use. Use the host's available file and documentation tools under its network policy. Report lookup failures; for Context7 quota errors, follow its authentication guidance. A source mirror or cached release can satisfy the workflow without network access when its provenance and revision are verifiable.

## Evidence for this release

All links below identify the verified commit.

| Topic | Official evidence |
| --- | --- |
| Services and fiber-local values | [Service migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/services.md), [FiberRef migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/fiberref.md) |
| Schemas, dates, defaults, redaction | [Schema migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/schema.md), [Schema source](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Schema.ts) |
| Equality and hash keys | [Equality migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/equality.md), [Equal](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Equal.ts), [Hash](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Hash.ts) |
| Forks and scopes | [Fork migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/forking.md), [Scope migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/scope.md) |
| Child processes | [ChildProcess](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/process/ChildProcess.ts), [ChildProcessSpawner](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/process/ChildProcessSpawner.ts) |
| HTTP requests, status, errors | [HTTP source directory](https://github.com/Effect-TS/effect/tree/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/http) |
| CLI parsing and execution | [CLI source directory](https://github.com/Effect-TS/effect/tree/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/unstable/cli) |
| Config providers and fallback | [Config](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Config.ts), [ConfigProvider](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/ConfigProvider.ts) |
| Testing | [Vitest source](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/vitest/src/index.ts), [test clock](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/testing/TestClock.ts) |
| Errors, layers, schedules | [Error migration](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/migration/error-handling.md), [Layer](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Layer.ts), [Schedule](https://github.com/Effect-TS/effect/blob/2600f62f4532026928454dcea8d1c48557b3f942/packages/effect/src/Schedule.ts) |

## Example coverage

For maintenance checks, fence markers, runtime coverage, and host limits, read `validation/README.md` in the full repository. Compilation verifies signatures; it does not establish that a network call, runtime, or application placeholder has run.
