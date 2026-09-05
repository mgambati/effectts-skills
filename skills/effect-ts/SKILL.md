---
name: effect-ts
description: "Implement, debug, or review TypeScript using the Effect library, identified by effect or @effect/* dependencies. Use for Effect services and layers, Effect Schema, typed errors, @effect/vitest, and Effect HTTP, CLI, config, or resource lifetimes. Resolve the consuming version before applying this v4 guidance."
---

# Effect implementation and review

## Shared workflow

1. Establish the target. Read the consuming repository's instructions and the package that owns the code. Identify the requested behavior and existing conventions. Apply this skill to the Effect library; a generic schema, service, or CLI task alone does not establish that scope.
2. Resolve compatibility and source with [version compatibility](references/version-compatibility.md). Finish when the exact consuming version and each changed API's signature and relevant behavior are verified. If evidence is missing, state the gap and keep compatibility unverified.
3. Select references below for the decisions the task actually needs. For a task spanning topics, read each relevant reference. Preserve working alternatives that meet the requirements; explain a structural change in terms of behavior, boundaries, or resource ownership.
4. Implement or review against those requirements. Treat examples as demonstrations whose domain constraints and application implementations need adapting. For a review, verify each finding against current code before proposing a fix.
5. Validate through the consuming package's existing scripts and relevant behavior tests. Read commands from its manifest and repository guidance. Finish by reporting changes or findings, the Effect version checked, validation results, and remaining gaps. Separate compilation from executed behavior.

## Select a reference

- [Services and layers](references/services-and-layers.md). Read when defining service contracts, capturing dependencies, composing layers, or deciding resource sharing.
- [Schema decisions](references/schema-decisions.md). Read when choosing records or variants, adding brands or validation, comparing keys, or replacing an existing type model.
- [Data modeling](references/data-modeling.md). Read when implementing schema fields, computed properties, variant matching, dates, or JSON encoding. For representation or branding choices, first read Schema decisions.
- [Error handling](references/error-handling.md). Read when defining expected failures, choosing recovery granularity, handling defects, or encoding external errors.
- [Testing](references/testing.md). Read when using @effect/vitest, choosing clocks or test resource lifetimes, or overriding services and configuration in tests.
- [HTTP clients](references/http-clients.md). Read when building Effect HTTP requests, decoding responses, classifying status failures, or choosing retries and timeouts.
- [CLI](references/cli.md). Read when implementing commands, arguments, flags, subcommands, or command execution with Effect's CLI package.
- [Config](references/config.md). Read when loading environment configuration, validating defaults, substituting providers, or handling secrets.
- [Processes and scopes](references/processes.md). Read when forking fibers, managing child processes, or defining acquisition and cleanup lifetimes.
- [Setup](references/setup.md). Read when changing TypeScript or module configuration, or evaluating the optional Effect language service.
