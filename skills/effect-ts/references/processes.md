# Processes and scopes

Use these APIs only after the [version check](version-compatibility.md). Child processes live in `effect/unstable/process`; CLI argument parsing lives in `effect/unstable/cli`.

## Fiber lifetime

| API | Lifetime | Ownership |
| --- | --- | --- |
| `Effect.forkChild` | Current parent fiber | Parent interrupts children when it ends |
| `Effect.forkScoped` | Current scope | Scope interrupts the fiber |
| `Effect.forkIn(scope)` | Explicit scope | Caller owns scope closure |
| `Effect.forkDetach` | Independent of parent | Caller must retain and interrupt the fiber |

<!-- check: process-fibers -->
```typescript
import { Effect, Fiber } from "effect"

const joined = Effect.gen(function* () {
  const fiber = yield* Effect.forkChild(Effect.succeed(42))
  return yield* Fiber.join(fiber)
})

const scopedWorker = Effect.scoped(Effect.gen(function* () {
  yield* Effect.forkScoped(Effect.never)
}))

const detachedWorker = Effect.gen(function* () {
  const fiber = yield* Effect.forkDetach(Effect.never)
  yield* Fiber.interrupt(fiber)
})
```

Prefer a scope for background work with a known owner. Detaching does not register cleanup.

## Run a child process

Acquire a handle through `ChildProcessSpawner`. Provide `NodeServices.layer` at the boundary. Read piped stdout and stderr concurrently so a full pipe cannot block the child. `Stream.runCollect` returns an array in this release.

<!-- check: process-command -->
```typescript
import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { NodeServices } from "@effect/platform-node"

export const runCommand = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const process = yield* spawner.spawn(ChildProcess.make("git", ["status"], {
    stdin: "ignore", stdout: "pipe", stderr: "pipe",
  }))
  const [stdout, stderr, exitCode] = yield* Effect.all([
    process.stdout.pipe(Stream.decodeText(), Stream.runCollect),
    process.stderr.pipe(Stream.decodeText(), Stream.runCollect),
    process.exitCode,
  ], { concurrency: "unbounded" })
  return { exitCode, output: stdout.join(""), stderr: stderr.join("") }
}).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
```

Closing the scope terminates a still-running process. A nonzero exit is returned as an exit code; decide whether the command's contract should turn it into a typed failure.

## Write stdin

Feed an input stream through the command options. The spawner pumps it while output is drained, then closes stdin. This avoids waiting on a large write before reading output.

<!-- check: process-input -->
```typescript
import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { NodeServices } from "@effect/platform-node"

export const runWithInput = (command: string, input: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const process = yield* spawner.spawn(ChildProcess.make("bash", ["-c", command], {
      stdin: Stream.make(new TextEncoder().encode(input)),
      stdout: "pipe", stderr: "pipe",
    }))
    const [stdout, stderr, exitCode] = yield* Effect.all([
      process.stdout.pipe(Stream.decodeText(), Stream.runCollect),
      process.stderr.pipe(Stream.decodeText(), Stream.runCollect),
      process.exitCode,
    ], { concurrency: "unbounded" })
    return { exitCode, output: stdout.join(""), stderr: stderr.join("") }
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
```

Use a shell only for command strings whose interpretation you intend. For ordinary programs, pass the executable and argument array directly.

## Manually controlled background work

`Scope.provide(scope)` supplies a scope without closing it when the acquisition finishes. Register that scope with an outer owner before acquiring resources, so failure and interruption still close it. Fork collection into that same scope. Keep the fiber so its result and failure remain observable.

<!-- check: process-background -->
```typescript
import { Effect, Exit, Fiber, Scope, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

export const startBackground = (command: string) => Effect.gen(function* () {
  const scope = yield* Effect.acquireRelease(
    Scope.make(),
    (scope, exit) => Scope.close(scope, exit),
  )
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const process = yield* spawner.spawn(ChildProcess.make("bash", ["-c", command], {
    stdin: "ignore", stdout: "pipe", stderr: "pipe",
  })).pipe(
    Scope.provide(scope),
    Effect.onExit((exit) => Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void),
  )
  const result = yield* Effect.all([
    process.stdout.pipe(Stream.decodeText(), Stream.runCollect),
    process.stderr.pipe(Stream.decodeText(), Stream.runCollect),
    process.exitCode,
  ], { concurrency: "unbounded" }).pipe(Effect.forkIn(scope))
  return {
    process,
    scope,
    result,
    awaitResult: Fiber.join(result),
    stop: Scope.close(scope, Exit.void),
  }
})
```

The returned task survives the acquiring fiber while its outer scope remains open. Calling `stop` closes its own scope early. The outer owner also closes it on failure or interruption. `process.kill({ signal: "SIGTERM" })` is available for explicit signaling; scope closure also stops collection.

For resources outside the process library, use `Effect.acquireRelease(acquire, release)`. The release effect must handle expected cleanup failures, for example by logging them or deliberately converting an unrecoverable cleanup failure to a defect.

This example buffers output until completion. For long-running commands, consume chunks into a bounded store or stream them to a file.
