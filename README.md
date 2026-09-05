# Effect skills and host integrations

The [effect-ts skill](skills/effect-ts/SKILL.md) guides implementation and review with the TypeScript Effect library. It resolves the consuming version, reads matching source, and selects topic references. The examples target the release in [version compatibility](skills/effect-ts/references/version-compatibility.md). Other releases require their own API checks.

The [effect-audit skill](skills/effect-audit/SKILL.md) adds a focused review workflow. It separates defects from design recommendations, records confirmed-correct patterns, and requires evidence for each finding. Review is its default outcome; remediation follows the user's authorized scope. It reuses the existing Effect references and adds no service-design methodology.

## Skills-only installation

From a checkout of the revision you want to use:

```bash
npx skills add . --skill effect-ts
```

Choose your agent and installation scope in the installer. See the [skills CLI documentation](https://github.com/vercel-labs/skills) for supported agents and options. For manual installation, copy the entire `skills/effect-ts` directory to the host's documented skill location, including `references/`.

To include the audit skill, also copy the entire `skills/effect-audit` directory, including its `LICENSE`, beside `effect-ts`. Keep those directory names and the sibling layout so shared reference links resolve. The audit skill is not a standalone copy of the API references.

This installs instructions and references. It adds no executable tools, hooks, or status bar. The agent uses its existing file, shell, and documentation capabilities. Explicit invocation syntax and automatic selection depend on the host.

## Pi integration

From this repository's root:

```bash
pi install .
```

Pi loads the extension and skills through the `pi` paths in [package.json](package.json). See [Pi package installation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md) for scope and remote-source options.

The extension reports the installed Effect version and suggests a topic reference after a matching file read. It provides documentation commands and scaffold generation:

| Pi entry | Capability |
| --- | --- |
| `/effect:docs <topic>` | Load a reference. Call without a topic to discover the current topic list. |
| `/effect:service <Name>` | Produce a service scaffold with implementation placeholders. |
| `/effect:test <Name>` | Produce a test scaffold with application tests marked as skipped. |
| `effect_docs` | Agent-callable reference lookup. |
| `effect_scaffold` | Agent-callable service, schema, error, or test scaffold generation. |

The extension's registrations own the command and topic lists. Scaffolds require the supported installed Effect release. Generated code still needs the consuming application's implementation and tests.

## Claude Code integration

Load the checkout as a local plugin when launching Claude Code in the consuming project:

```bash
claude --plugin-dir /path/to/effectts-skills
```

Replace the path with your checkout. Current Claude Code supports component discovery from default directories without a manifest. This repository contains skills and [hook configuration](hooks/hooks.json), but no marketplace manifest. See [Claude Code's local plugin documentation](https://code.claude.com/docs/en/plugins#test-your-plugins-locally) for loading and distribution options.

SessionStart supplies the shared workflow for the supported installed Effect release. PreToolUse supplies a matching topic reference for existing TypeScript files on Read, Edit, or Write. SessionEnd clears session deduplication state. A new file with no existing content may produce no topic match. These hooks do not register the Pi commands or scaffold tools.

## Version detection and limits

The host integrations resolve installed Effect metadata near the consuming package. Unsupported or unresolved installations receive version guidance. Detection handles ordinary node_modules layouts, hoisting, and symlinks; layouts without node_modules remain unresolved. Companion compatibility still needs the skill's version workflow.

Host pattern detection is heuristic. A matching identifier in an Effect package can belong to another library, and an alias can hide an Effect API. Confirm the import and requested behavior before applying a suggested reference.

The [skill entry point](skills/effect-ts/SKILL.md#select-a-reference) owns topic selection. It links to service composition, schema decisions and encoding, errors, testing, HTTP, CLI, config, process lifetimes, and setup guidance.

## Validation

Use the validation script declared in [package.json](package.json). The [validation guide](validation/README.md) describes API checks, executable behavior, integration simulations, and manual invocation review. Live Pi and Claude Code loading and delivery remain unverified; simulated registration and hook subprocess tests do not establish those host behaviors.

[Audit evaluations](validation/audit-evaluations.md) records the four review cases, compiler and runtime results, false positives, and the distinction between manual skill application and executed tests.

## Attribution

This repository builds on [joelhooks/effectts-skills](https://github.com/joelhooks/effectts-skills). Its original patterns draw from:

- [kitlangton/effect-solutions](https://github.com/kitlangton/effect-solutions), by Kit Langton, also published at [effect.solutions](https://effect.solutions).
- [Effect-TS/effect](https://github.com/Effect-TS/effect), the official source used for version-specific API verification.
- [artimath/effect-skills](https://github.com/artimath/effect-skills), MIT, for schema decisions, process and scope patterns, layer behavior, and error and test techniques.

The audit skill adapts Artimath's `effect-deep-audit` and `effect-deslopify-idiomatic` at [revision 1a75ab7](https://github.com/artimath/effect-skills/tree/1a75ab75712ea5008c3266813df364fd2dcbc3d7), inspected on 2026-09-05. It retains finding categories, confirmed-correct records, fix dependencies, and regression testing. It replaces universal schema, mapper, file-size, and idiom prescriptions with decisions based on requirements and demonstrated consequences. It does not import the SDD workflow. The complete upstream [MIT copyright and permission notice](skills/effect-audit/LICENSE) accompanies the adaptation.

The package declares the MIT license.
