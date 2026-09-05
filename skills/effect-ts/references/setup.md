# Project Setup

## Table of Contents

- [Effect Language Service](#effect-language-service)
- [TypeScript Configuration](#typescript-configuration)
- [Module Settings by Project Type](#module-settings-by-project-type)
- [Reference Repositories](#reference-repositories)
- [Development Workflow](#development-workflow)

## Effect Language Service

The Effect Language Service provides editor diagnostics and compile-time type checking. It catches errors TypeScript alone cannot detect.

### Install

```bash
bun add -d @effect/language-service
```

Add to `tsconfig.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Effect-TS/language-service/refs/heads/main/schema.json",
  "compilerOptions": {
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

The `$schema` field enables autocomplete and validation for plugin options.

### Editor Setup

Your editor must use the **workspace** TypeScript version.

**VS Code / Cursor:**

```json
// .vscode/settings.json
{
  "typescript.tsdk": "./node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

Then F1, "TypeScript: Select TypeScript version", "Use workspace version".

**JetBrains:** Settings, Languages & Frameworks, TypeScript, select workspace version.

### Build-Time Diagnostics

Patch TypeScript for CI enforcement:

```bash
bunx effect-language-service patch
```

Persist across installs:

```json
{
  "scripts": { "prepare": "effect-language-service patch" }
}
```

## TypeScript Configuration

### Key Settings

```jsonc
{
  "compilerOptions": {
    // Build performance
    "incremental": true,
    "composite": true,

    // Module system
    "target": "ES2022",
    "module": "NodeNext",
    "moduleDetection": "force",

    // Import handling
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true,

    // Type safety
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noImplicitOverride": true,

    // Development
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,

    // Effect
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

### Why These Settings

- **incremental + composite**: Fast rebuilds, monorepo project references
- **ES2022 + NodeNext**: Modern JS, proper ESM/CJS resolution
- **verbatimModuleSyntax**: Preserves `import type` exactly
- **rewriteRelativeImportExtensions**: Allows `.ts` in imports
- **strict + exactOptionalPropertyTypes**: Maximum type safety
- **skipLibCheck**: Faster builds (skip node_modules checking)

## Module Settings by Project Type

### Bundled Apps (Vite, Webpack, esbuild)

```jsonc
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

TypeScript acts as type-checker only. Bundler handles module transformation.

### Libraries and Node.js Apps

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext"
  }
}
```

Required for npm packages, Node.js apps, and CLI tools. Enforces Node.js module resolution rules.

Additional library settings:

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "composite": true,
    "declarationMap": true
  }
}
```

**Rule of thumb:** Build tool compiling your code? Use `preserve` + `bundler`. TypeScript compiling your code? Use `NodeNext`.

## Source and validation workflow

Follow [version and source lookup](version-compatibility.md) before choosing dependencies or consulting an Effect checkout. Read the consuming package's scripts for its typecheck and test commands.

The examples in this skill compile with TypeScript 5.9.3 and strict type checking. For NodeNext ESM, set `"type": "module"` in the owning package and follow Node's relative import extension rules. For bundled code, use the bundler's module settings.

The language service is optional and is not included in this slice's compatibility guarantee. Verify its installed release supports the consuming Effect and TypeScript versions before installing or patching TypeScript. The configuration and patch commands above describe integration points, not a validated plugin version.
