# Effect v4 compatibility validation

Supported version: `4.0.0-rc.112`. The skill's [version reference](../skills/effect-ts/references/version-compatibility.md) records the official source revision and migration guides.

Run from the repository root:

```bash
npm ci --prefix validation
npm --prefix validation run check
npm --prefix validation test
```

Use Node 22 or newer. The checked dependency set is exact in `package.json` and `package-lock.json`: Effect and its Node, Bun, and Vitest companion packages at `4.0.0-rc.112`, Vitest `4.1.11`, and TypeScript `5.9.3`.

## What the checks cover

`check.mjs` reads every TypeScript fence in the skill and references. It rejects unclassified fences. Currently it checks 83 blocks: 51 complete or grouped examples and 32 illustrative fragments. The CLI task manager and event-registration example each combine consecutive blocks into one module.

Complete examples compile as written, with repeated named imports merged across grouped blocks. Illustrative fragments remain visibly labeled in their reference files. `fragments.mjs` supplies typed application contracts and generator wrappers for them; it does not replace their Effect calls. These fixtures check API compatibility, not the consuming application's behavior. The before-and-after modeling fragments name their legacy declarations separately so both alternatives can compile.

The checker executes the four generator functions from `extensions/effect-context.ts` and compiles their actual returned TypeScript. Service methods remain application placeholders. The generated test skeleton uses skipped tests until the consuming project wires its service and assertions. The schema generator uses `DateFromString` so its JSON codec accepts ISO dates.

Generated files and the per-block `inventory.json` live in `generated/`, which Git ignores. Validation compiles with strict mode and exact optional property types. It checks dependency metadata against the supported version and typechecks the behavior tests too. Library declaration checking is skipped; no example errors are suppressed.

Vitest runs the actual extracted testing examples and focused behavior checks for:

- Schema defaults, constructor defaults, branded constraints, and Date JSON round trips.
- Config parsing, missing-only defaults, redaction, arrays, and environment prefixes.
- HTTP success, schema failures, 404 mapping, status failures, and transport failures using a supplied fetch implementation.
- Task repository persistence, toggling, and preserving corrupt-file errors.
- Concurrent process stdin/stdout/stderr handling and cleanup through explicit stop or owner scope closure.
- Installed-version resolution, hook routing, scaffold guards, and extension pattern detection.

## Corrections recorded in this slice

Services use `Context.Service`. Schema classes supply their self types; errors use `Schema.TaggedError`; constructors use `.make`; defect codecs call `Schema.Defect()`. Validation predicates use `Schema.check`. Decoding defaults and constructor defaults are explicit. Date and redacted schemas preserve their intended encoded inputs.

HTTP services declare transport and schema errors, check status codes, and inspect the nested `HttpClientError.reason`. Config arrays use schemas and object providers use `fromUnknown`. CLI execution uses the Effect returned by `Command.run`; filesystem failures remain in the task repository's contract. `Schedule.max` combines bounded retry policies. Testing uses `Context.Reference` with `Effect.provideService` and the current logger layer API.

Process examples use `ChildProcess` and `ChildProcessSpawner`, `Scope.provide`, and current fork APIs. Output collection belongs to the task's scope, both output pipes drain concurrently, and acquisition failure retains cleanup ownership. Hook and extension detectors recognize current APIs. Legacy names remain only as migration detection patterns.

## Limits

The Bun entry points typecheck but have not run under Bun. Pi registration and callbacks run against a small host mock; this does not replace an installed Pi or Claude Code session. The optional Effect language service is outside the pinned dependency set. Its setup guide directs agents to verify the installed plugin's compatibility before using it.

No live external HTTP service is required. Generated service implementations and the 32 labeled illustrative fragments still require application-specific work. No compatibility claim extends to other Effect releases.
