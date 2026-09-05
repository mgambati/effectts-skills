# Project setup

## Preserve the consuming toolchain

Read the owning manifest, lockfile, TypeScript configuration, and build scripts before changing setup. Use the project's package manager and test runner. Choose dependencies through [version compatibility](version-compatibility.md), including companion peer ranges.

## Module configuration

Choose settings for the runtime and build pipeline that will execute the code. Effect does not require every project to use the same tsconfig.

- Bundled applications should follow the bundler's supported module and resolution settings. Preserve a working configuration unless the requested change requires an adjustment.
- Code emitted by TypeScript for Node should use settings matching the targeted Node module semantics. For NodeNext ESM, coordinate the owning package's `type` field and relative import extensions.
- Libraries should account for their published JavaScript and declaration consumers. Declaration output, project references, and composite builds depend on that packaging plan.

Keep type safety settings from the consuming repository. Read this repository's validation configuration for the compiler options used to check its examples; copying those options is not a prerequisite for Effect.

## Optional Effect language service

The [Effect language service](https://github.com/Effect-TS/language-service) adds Effect-specific editor diagnostics. Verify its release supports the consuming Effect and TypeScript versions before adding it. It is outside this skill's validated dependency set.

Use the installed language service's documentation for plugin options, editor integration, and any build-time patching. Editor diagnostics and compiler enforcement are separate integration choices. Add build-time enforcement only when the project wants that policy, and preserve existing install lifecycle scripts.
