# Validate examples and scaffolds

Run from the repository root with Node 22.12 or newer:

```bash
npm run validate
```

The command installs the lockfile, proves that an invalid published import fails, extracts and typechecks the documentation and scaffold output, then runs the behavior tests. CI runs this command on Node 24 and Linux. Process tests require Bash and standard Unix commands; local verification also runs on macOS.

The API repair established Effect `4.0.0-rc.112`. This setup retains its exact Effect, Node platform, Bun platform, testing, Vitest and TypeScript pins. `package.json` and the lockfile own the dependency versions. The checker rejects ranges and mismatches with the installed dependencies. [Version compatibility](../skills/effect-ts/references/version-compatibility.md) records the matching official Effect source.

## Documentation connection

The checker reads every TypeScript fence in `skills/effect-ts/SKILL.md` and its references. Complete examples compile with their published imports. The task manager, config basics and event tests group their marked blocks into modules; repeated named imports merge without dropping API names.

The [generated coverage report](coverage.md) lists complete or grouped examples, illustrative fragments, and each fragment's runtime exclusion reason. Fragments retain their published Effect calls and receive missing application types or generator wrappers from `fragments.mjs`. They are compatibility checks, not runnable applications.

Unclassified fences, accidental duplicate IDs, stale fragment fixtures and stale coverage reports fail the check. When editing a fence, keep its `check` ID or its concrete `fragment` reason immediately above it. After adding or moving examples, inspect the coverage changes produced by the `coverage:update` script in the validation manifest, then rerun validation. New runtime suites also need an entry in `vitest.config.ts`.

The checker regenerates ignored files in `validation/generated/`. `inventory.json` maps modules to source lines. TypeScript uses strict mode and exact optional property types. Library declarations use `skipLibCheck`; example errors have no suppression. `allowOnly: false` rejects accidentally focused runtime tests. The illustrative test-modifier fragment compiles but never runs.

## Runtime coverage

Tests import extracted documentation modules. Seven published testing suites run directly, including their assertions after scope closure and their repeated fresh-state tests.

| Area | Executed behavior |
| --- | --- |
| Services and layers | HTTP service provisioning, event orchestration, independent user/email stores and ticket counters across tests |
| Schemas and errors | Defaults, nominal brands and validated constraints, tagged structs, structural record keys and custom equality, Date JSON round trips, tagged error decoding and recovery |
| HTTP | Success, schema rejection, 404 mapping, other status failures and transport failures through supplied fetch implementations |
| CLI | Published task repository and command handlers, argument and flag parsing, omitted boolean defaults, invalid input, persistence, toggling and corrupt-file errors |
| Config | Parsing, missing-only defaults, redaction, arrays and environment prefixes |
| Resources | Temp-directory removal after a test, concurrent stdin/stdout/stderr, explicit stop, scope closure, interrupted owners and cleanup after acquisition failure |
| Testing | TestClock, live clock, logging, fiber-local overrides, fresh test layers and automatic scope cleanup |

The checker registers `extensions/effect-context.ts` with a small Pi adapter and calls the actual scaffold tool for service, schema, error and test output. All four returned modules compile. Behavior tests exercise service construction, schema round trips and tagged errors. The generated test suite loads and reports its three application placeholders as skipped. Service storage and domain methods still need consuming-project implementations.

## Hooks and extension

Subprocess tests run the Claude hooks with JSON input. Extension tests invoke registered callbacks, commands and tools through the adapter. They cover installed-version selection, unsupported and missing installs, nested packages, hoisting, symlinks, changed installations, reference routing, aliases, short reads, failed reads, concurrent hook calls and session reset.

Hooks read standard input through file descriptor `0`. Reopening `/dev/stdin` fails with `ENXIO` for Node child-process sockets on Linux, causing valid hook input to fall through to the empty response. The subprocess tests exercise this input path on CI.

Claude's [hook output protocol](https://code.claude.com/docs/en/hooks#json-output) defines `hookEventName` and `additionalContext`. Returning an `env` object does not persist deduplication. Hooks now claim reference files atomically in a temporary directory keyed by session, working directory and supported version. SessionStart resets those claims, including after compaction; SessionEnd removes them. Without session metadata or writable storage, hooks emit context again. Tests set `EFFECT_SESSION_STATE_DIR` to isolated temporary directories. An abrupt host exit can leave small cache files for the operating system's temporary-file cleanup.

Pi deduplicates by reference file, so `services` and `layers` share a claim. Version detection reads the nearest installed `node_modules/effect/package.json` afresh, including hoisted and symlinked installs. It avoids Node's cached resolution after dependency changes. Installations without `node_modules`, such as Yarn PnP, remain unresolved and receive version guidance.

## Failure proof and limits

The `prove:failure` script in the validation manifest copies the validation inputs into a temporary directory and inserts `InvalidEffectApi` into the published core-service import in the services reference. It requires checker exit code 1 and TypeScript diagnostic TS2305 for that import. It deletes the copy afterward. The main command then checks the correct working files and runs the tests.

Bun entry points compile but do not run under Bun. HTTP tests use local responses and make no external requests. Pi rendering, SDK type compatibility and callback delivery in a real Pi session remain unverified. Claude hook discovery and context delivery in a real Claude Code session also remain unverified. The mocked registration and subprocess tests do not establish those host behaviors. The GitHub workflow has been added but has not run on GitHub in this slice. Compatibility with other Effect releases and the optional Effect language service is outside this check.

## Instruction review

[Invocation examples](invocations.md) records a manual review of triggering and reference selection. It includes unrelated libraries, schema alternatives, resource ownership, version mismatches, and skills-only use. These are reasoning checks against the published instructions, not live agent invocation tests.

[Audit evaluations](audit-evaluations.md) records a manual application of the audit skill to four small cases. `audit.test.ts` executes behavior and public-data contracts. `audit-types.test.mjs` compiles an intentionally invalid entry point and an in-memory correction. That entry point stays outside the ordinary successful typecheck; the compiler test requires its specific missing-dependency diagnostic. `skill-links.test.mjs` checks local links and heading targets in both skill entry points. These tests verify the examples and references, not an agent's ability to discover findings or select the audit skill.
