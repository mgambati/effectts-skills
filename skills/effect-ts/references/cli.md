# Command-Line Interfaces

## Table of Contents

- [Installation](#installation)
- [Minimal Example](#minimal-example)
- [Arguments and Flags](#arguments-and-flags)
- [Subcommands](#subcommands)
- [Worked Example: Task Manager](#worked-example-task-manager)
- [Quick Reference](#quick-reference)

## Installation

```bash
bun add --exact effect@4.0.0-rc.112 @effect/platform-bun@4.0.0-rc.112
```

For Node.js, use `@effect/platform-node@4.0.0-rc.112` instead.

## Minimal Example

<!-- check: cli-minimal -->
```typescript
import { Argument, Command, Flag } from "effect/unstable/cli"
import { BunServices, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

const name = Argument.string("name").pipe(Argument.withDefault("World"))
const shout = Flag.boolean("shout").pipe(Flag.withAlias("s"))

const greet = Command.make("greet", { name, shout }, ({ name, shout }) => {
  const message = `Hello, ${name}!`
  return Console.log(shout ? message.toUpperCase() : message)
})

const cli = Command.run(greet, { version: "1.0.0" })

cli.pipe(
  Effect.provide(BunServices.layer),
  BunRuntime.runMain
)
```

`Command.run` reads arguments from Stdio and returns an Effect. For explicit argument arrays, use `Command.runWith(command, { version })(args)` with only user arguments.

Built-in `--help` and `--version` work automatically. Every command should have `Command.withDescription` for useful help output.

## Arguments and Flags

Arguments are positional. Flags are named options. Use `--` when a positional value might otherwise be parsed as an option.

### Arguments

Illustrative fragment. Uses TaskId from the task manager below.

<!-- fragment: Uses TaskId from the task manager below. -->
```typescript
import { Argument } from "effect/unstable/cli"

Argument.string("file")                              // required text
Argument.string("output").pipe(Argument.optional)    // optional
Argument.string("format").pipe(Argument.withDefault("json")) // default
Argument.string("files").pipe(Argument.variadic())   // zero or more
Argument.string("files").pipe(Argument.atLeast(1))   // one or more
Argument.integer("id").pipe(Argument.withSchema(TaskId)) // schema-validated
```

### Flags

<!-- check: cli-flags -->
```typescript
import { Flag } from "effect/unstable/cli"

Flag.boolean("verbose").pipe(Flag.withAlias("v"))     // boolean
Flag.string("output").pipe(Flag.withAlias("o"))       // text
Flag.string("config").pipe(Flag.optional)             // optional text
Flag.choice("format", ["json", "yaml", "toml"])       // enum
Flag.integer("count").pipe(Flag.withDefault(10))      // integer with default
```

Add descriptions for help output:

Illustrative fragment. Combinators to apply to an Argument or Flag.

<!-- fragment: Combinators to apply to an Argument or Flag. -->
```typescript
Argument.withDescription("The task description")
Flag.withDescription("Show all tasks including completed")
```

## Subcommands

Illustrative fragment. Uses the task argument and imports from the minimal example.

<!-- fragment: Uses the task argument and imports from the minimal example. -->
```typescript
const add = Command.make("add", { task }, ({ task }) =>
  Console.log(`Adding: ${task}`)
).pipe(Command.withDescription("Add a new task"))

const list = Command.make("list", {}, () =>
  Console.log("Listing tasks...")
).pipe(Command.withDescription("List all tasks"))

const app = Command.make("tasks").pipe(
  Command.withDescription("A simple task manager"),
  Command.withSubcommands([add, list])
)
```

## Worked Example: Task Manager

### Schema

<!-- check: cli-tasks -->
```typescript
import { Array, Option, Schema } from "effect"

export const TaskId = Schema.Number.pipe(Schema.brand("TaskId"))
type TaskId = typeof TaskId.Type

export class Task extends Schema.Class<Task>("Task")({
  id: TaskId,
  text: Schema.NonEmptyString,
  done: Schema.Boolean,
}) {
  toggle() { return new Task({ ...this, done: !this.done }) }
}

export class TaskList extends Schema.Class<TaskList>("TaskList")({
  tasks: Schema.Array(Task),
}) {
  static Json = Schema.fromJsonString(TaskList)
  static empty = new TaskList({ tasks: [] })

  get nextId(): TaskId {
    if (this.tasks.length === 0) return TaskId.make(1)
    return TaskId.make(Math.max(...this.tasks.map((t) => t.id)) + 1)
  }

  add(text: string): [TaskList, Task] {
    const task = new Task({ id: this.nextId, text, done: false })
    return [new TaskList({ tasks: [...this.tasks, task] }), task]
  }

  toggle(id: TaskId): [TaskList, Option.Option<Task>] {
    const index = this.tasks.findIndex((t) => t.id === id)
    if (index === -1) return [this, Option.none()]
    const updated = this.tasks[index].toggle()
    const tasks = this.tasks.map((task, i) => i === index ? updated : task)
    return [new TaskList({ tasks }), Option.some(updated)]
  }
}
```

### Service

<!-- check: cli-tasks -->
```typescript
import { Effect, FileSystem, Layer, PlatformError, Context } from "effect"

export class TaskRepo extends Context.Service<TaskRepo, {
  readonly list: (all?: boolean) => Effect.Effect<ReadonlyArray<Task>, Schema.SchemaError | PlatformError.PlatformError>
  readonly add: (text: string) => Effect.Effect<Task, Schema.SchemaError | PlatformError.PlatformError>
  readonly toggle: (id: TaskId) => Effect.Effect<Option.Option<Task>, Schema.SchemaError | PlatformError.PlatformError>
  readonly clear: () => Effect.Effect<void, Schema.SchemaError | PlatformError.PlatformError>
}>()("TaskRepo") {
  static layer = Layer.effect(TaskRepo, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = "tasks.json"

    const load = Effect.gen(function* () {
      const content = yield* fs.readFileString(path)
      return yield* Schema.decodeEffect(TaskList.Json)(content)
    }).pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(TaskList.empty)))

    const save = (list: TaskList) => Effect.gen(function* () {
      const json = yield* Schema.encodeEffect(TaskList.Json)(list)
      yield* fs.writeFileString(path, json)
    })

    return {
      list: Effect.fn("TaskRepo.list")(function* (all?: boolean) {
        const taskList = yield* load
        return all ? taskList.tasks : taskList.tasks.filter((t) => !t.done)
      }),
      add: Effect.fn("TaskRepo.add")(function* (text: string) {
        const list = yield* load
        const [newList, task] = list.add(text)
        yield* save(newList)
        return task
      }),
      toggle: Effect.fn("TaskRepo.toggle")(function* (id: TaskId) {
        const list = yield* load
        const [newList, task] = list.toggle(id)
        yield* save(newList)
        return task
      }),
      clear: Effect.fn("TaskRepo.clear")(function* () {
        yield* save(TaskList.empty)
      }),
    }
  }))
}
```

The repository treats a missing file as an empty list. Read, write, and schema failures remain typed errors so corrupt data is not silently replaced.

### Commands

<!-- check: cli-tasks -->
```typescript
import { Argument, Command, Flag } from "effect/unstable/cli"
import { Console, Effect, Option } from "effect"

const addCmd = Command.make("add", {
  text: Argument.string("task").pipe(Argument.withDescription("The task description")),
}, ({ text }) =>
  Effect.gen(function* () {
    const repo = yield* TaskRepo
    const task = yield* repo.add(text)
    yield* Console.log(`Added task #${task.id}: ${task.text}`)
  })
).pipe(Command.withDescription("Add a new task"))

const listCmd = Command.make("list", {
  all: Flag.boolean("all").pipe(Flag.withAlias("a"), Flag.withDescription("Include completed")),
}, ({ all }) =>
  Effect.gen(function* () {
    const repo = yield* TaskRepo
    const tasks = yield* repo.list(all)
    if (tasks.length === 0) return yield* Console.log("No tasks.")
    for (const task of tasks) {
      yield* Console.log(`${task.done ? "[x]" : "[ ]"} #${task.id} ${task.text}`)
    }
  })
).pipe(Command.withDescription("List pending tasks"))

const toggleCmd = Command.make("toggle", {
  id: Argument.integer("id").pipe(Argument.withSchema(TaskId)),
}, ({ id }) =>
  Effect.gen(function* () {
    const repo = yield* TaskRepo
    const result = yield* repo.toggle(id)
    yield* Option.match(result, {
      onNone: () => Console.log(`Task #${id} not found`),
      onSome: (task) => Console.log(`Toggled: ${task.text} (${task.done ? "done" : "pending"})`),
    })
  })
).pipe(Command.withDescription("Toggle a task's done status"))

const clearCmd = Command.make("clear", {}, () =>
  Effect.gen(function* () {
    yield* (yield* TaskRepo).clear()
    yield* Console.log("Cleared all tasks.")
  })
).pipe(Command.withDescription("Clear all tasks"))

const app = Command.make("tasks").pipe(
  Command.withDescription("A simple task manager"),
  Command.withSubcommands([addCmd, listCmd, toggleCmd, clearCmd]),
)
```

### Entry point

<!-- check: cli-tasks -->
```typescript
import { BunServices, BunRuntime } from "@effect/platform-bun"

const cli = Command.run(app, { version: "1.0.0" })
const mainLayer = Layer.provideMerge(TaskRepo.layer, BunServices.layer)

const main = cli.pipe(Effect.provide(mainLayer))
// At the Bun entry point: BunRuntime.runMain(main)
```

### Version from package.json

Illustrative fragment. Replace the task manager entry point and use the consuming package.json.

<!-- fragment: Replace the task manager entry point and use the consuming package.json. -->
```typescript
import pkg from "./package.json" with { type: "json" }
const cli = Command.run(app, { version: pkg.version })
```

Requires `"resolveJsonModule": true` in tsconfig.

## Quick Reference

| Concept | API |
|---------|-----|
| Define command | `Command.make(name, config, handler)` |
| Positional args | `Argument.string`, `.integer`, `.optional`, `.variadic()` |
| Named flags | `Flag.boolean`, `.string`, `.choice`, `.integer` |
| Flag alias | `Flag.withAlias("v")` |
| Descriptions | `Argument.withDescription`, `Flag.withDescription`, `Command.withDescription` |
| Schema validation | `Argument.withSchema(BrandedType)` |
| Subcommands | `Command.withSubcommands([...])` |
| Run CLI | `Command.run(cmd, { version })` |
| Bun platform | `BunServices.layer` + `BunRuntime.runMain` |
| Node platform | `NodeServices.layer` + `NodeRuntime.runMain` |
