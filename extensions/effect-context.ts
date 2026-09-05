import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import { effectProjectStatus, SUPPORTED_EFFECT_VERSION } from "../hooks/effect-version.mjs";

// Reference doc topics and their files
const TOPICS: Record<string, { file: string; label: string }> = {
  services: { file: "services-and-layers.md", label: "Services & Layers" },
  layers: { file: "services-and-layers.md", label: "Services & Layers" },
  "data-modeling": { file: "data-modeling.md", label: "Data Modeling" },
  schema: { file: "schema-decisions.md", label: "Schema Decisions" },
  errors: { file: "error-handling.md", label: "Error Handling" },
  testing: { file: "testing.md", label: "Testing" },
  http: { file: "http-clients.md", label: "HTTP Clients" },
  cli: { file: "cli.md", label: "CLI" },
  config: { file: "config.md", label: "Config" },
  processes: { file: "processes.md", label: "Processes & Scopes" },
  setup: { file: "setup.md", label: "Project Setup" },
  version: { file: "version-compatibility.md", label: "Version compatibility" },
};

// Pattern detection for smart injection
const PATTERNS: Record<string, { match: RegExp[]; topic: string }> = {
  services: {
    match: [/Context\.(Service|Reference)/, /ServiceMap\.Service/, /Layer\.effect/, /Layer\.sync/, /Layer\.scoped/],
    topic: "services",
  },
  schema: {
    match: [/Schema\.Class/, /Schema\.TaggedClass/, /Schema\.Struct/, /Schema\.brand/],
    topic: "data-modeling",
  },
  errors: {
    match: [/Schema\.TaggedErrorClass/, /Schema\.TaggedError/, /Effect\.catchTag/, /Schema\.Defect/],
    topic: "errors",
  },
  testing: {
    match: [/from ["']@effect\/vitest/, /it\.effect/, /it\.layer/, /it\.live/],
    topic: "testing",
  },
  http: {
    match: [/from ["']effect\/unstable\/http/, /HttpClient/, /HttpClientResponse/, /FetchHttpClient/],
    topic: "http",
  },
  cli: {
    match: [/from ["']effect\/unstable\/cli/, /Argument\./, /Flag\./],
    topic: "cli",
  },
  config: {
    match: [/Config\.redacted/, /Config\.schema/, /ConfigProvider/, /Config\.int\(/, /Config\.string\(/],
    topic: "config",
  },
  processes: {
    match: [/Scope\.make/, /Scope\.(provide|extend)/, /Effect\.fork(Child|Detach|In|Scoped|Daemon)/, /ChildProcess/, /Command\.start/],
    topic: "processes",
  },
};

function getSkillDir(extensionFile: string): string {
  // extensionFile is this file. Skill is at ../skills/effect-ts/
  return path.resolve(path.dirname(extensionFile), "..", "skills", "effect-ts");
}

function loadReference(skillDir: string, topic: string): string | null {
  const meta = TOPICS[topic];
  if (!meta) return null;
  const refPath = path.join(skillDir, "references", meta.file);
  try {
    return fs.readFileSync(refPath, "utf-8");
  } catch {
    return null;
  }
}

function detectPatterns(content: string): string[] {
  const detected = new Set<string>();
  for (const [, { match, topic }] of Object.entries(PATTERNS)) {
    for (const re of match) {
      if (re.test(content)) {
        detected.add(topic);
        break;
      }
    }
  }
  return [...detected];
}

export default function (pi: ExtensionAPI) {
  const skillDir = getSkillDir(__filename);
  let sessionCwd = process.cwd();
  let isEffectProject = false;
  const injectedTopics = new Set<string>();

  // --- Session start: detect Effect project ---
  pi.on("session_start", async (_event, ctx) => {
    sessionCwd = ctx.cwd;
    const status = effectProjectStatus(ctx.cwd);
    isEffectProject = status.supported;
    injectedTopics.clear();
    ctx.ui.setStatus("effect", status.detected ? `Effect ${status.version ?? "version unresolved"}` : undefined);
    if (status.detected && !status.supported) ctx.ui.notify(status.message!, "warning");
  });

  // --- Smart context injection on file reads ---
  pi.on("tool_result", async (event, ctx) => {
    if (!isEffectProject) return;
    if (event.toolName !== "read") return;
    const input = event.input as { path?: string } | undefined;
    if (input?.path && !effectProjectStatus(path.dirname(path.resolve(ctx.cwd, input.path))).supported) return;

    // Get the file content from the result
    const textContent = event.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    if (!textContent || textContent.length < 50) return;

    // Detect Effect patterns
    const topics = detectPatterns(textContent);
    const newTopics = topics.filter((t) => !injectedTopics.has(t));

    if (newTopics.length === 0) return;

    // Suggest one new reference per read.
    const toInject = newTopics.slice(0, 1);
    const hints: string[] = [];

    for (const topic of toInject) {
      const meta = TOPICS[topic];
      if (meta) {
        injectedTopics.add(topic);
        hints.push(`[Effect patterns detected: ${meta.label}. Use /effect:docs ${topic} for full reference.]`);
      }
    }

    if (hints.length > 0) {
      return {
        content: [
          ...event.content,
          { type: "text", text: "\n" + hints.join("\n") },
        ],
      };
    }
  });

  // --- /effect:docs <topic> command ---
  pi.registerCommand("effect:docs", {
    description: "Load Effect reference docs. Topics: " + Object.keys(TOPICS).join(", "),
    handler: async (args, ctx) => {
      const topic = args?.trim().toLowerCase();

      if (!topic) {
        const list = Object.entries(TOPICS)
          .map(([key, { label }]) => `  ${key.padEnd(14)} ${label}`)
          .join("\n");
        ctx.ui.notify(`Available topics:\n${list}`, "info");
        return;
      }

      const content = loadReference(skillDir, topic);
      if (!content) {
        ctx.ui.notify(`Unknown topic: ${topic}. Available: ${Object.keys(TOPICS).join(", ")}`, "error");
        return;
      }

      const meta = TOPICS[topic]!;
      pi.sendMessage(
        {
          customType: "effect-docs",
          content: `# Effect Reference: ${meta.label}\n\n${effectProjectStatus(ctx.cwd).message ?? "Resolve the consuming Effect version first."}\n\n${content}`,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Loaded: ${meta.label}`, "success");
      injectedTopics.add(topic);
    },
  });

  // --- /effect:service command ---
  pi.registerCommand("effect:service", {
    description: "Generate an Effect service scaffold",
    handler: async (args, ctx) => {
      const name = args?.trim() || "MyService";
      const status = effectProjectStatus(ctx.cwd);
      if (!status.supported) { ctx.ui.notify(status.message ?? `Requires Effect ${SUPPORTED_EFFECT_VERSION}`, "warning"); return; }
      const scaffold = generateServiceScaffold(name);
      pi.sendMessage(
        {
          customType: "effect-scaffold",
          content: `Here is a scaffold for the \`${name}\` service. Adapt it to your needs:\n\n\`\`\`typescript\n${scaffold}\n\`\`\``,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Service scaffold: ${name}`, "success");
    },
  });

  // --- /effect:test command ---
  pi.registerCommand("effect:test", {
    description: "Generate an Effect test scaffold",
    handler: async (args, ctx) => {
      const name = args?.trim() || "MyService";
      const status = effectProjectStatus(ctx.cwd);
      if (!status.supported) { ctx.ui.notify(status.message ?? `Requires Effect ${SUPPORTED_EFFECT_VERSION}`, "warning"); return; }
      const scaffold = generateTestScaffold(name);
      pi.sendMessage(
        {
          customType: "effect-scaffold",
          content: `Here is a test scaffold for \`${name}\`. Adapt it to your needs:\n\n\`\`\`typescript\n${scaffold}\n\`\`\``,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Test scaffold: ${name}`, "success");
    },
  });

  // --- effect_scaffold tool (LLM-callable) ---
  pi.registerTool({
    name: "effect_scaffold",
    label: "Effect Scaffold",
    description:
      "Generate idiomatic Effect v4 boilerplate. Creates service, schema, error, or test scaffolds checked against Effect 4.0.0-rc.112. Application-specific implementations remain placeholders.",
    promptSnippet: "Generate Effect v4 boilerplate (service, schema, error, test)",
    parameters: Type.Object({
      type: StringEnum(["service", "schema", "error", "test"] as const, {
        description: "Type of scaffold to generate",
      }),
      name: Type.String({ description: "Name for the generated type/service (PascalCase)" }),
    }),
    async execute(_toolCallId, params) {
      const status = effectProjectStatus(sessionCwd);
      if (!status.supported) throw new Error(status.message ?? `Requires Effect ${SUPPORTED_EFFECT_VERSION}`);
      let scaffold: string;
      switch (params.type) {
        case "service":
          scaffold = generateServiceScaffold(params.name);
          break;
        case "schema":
          scaffold = generateSchemaScaffold(params.name);
          break;
        case "error":
          scaffold = generateErrorScaffold(params.name);
          break;
        case "test":
          scaffold = generateTestScaffold(params.name);
          break;
      }
      return {
        content: [{ type: "text", text: scaffold }],
        details: { type: params.type, name: params.name },
      };
    },
  });

  // --- effect_docs tool (LLM-callable) ---
  pi.registerTool({
    name: "effect_docs",
    label: "Effect Docs",
    description:
      "Load Effect v4 reference documentation on a specific topic. Returns the full reference content for the requested topic.",
    promptSnippet: "Load Effect v4 reference docs (services, schema, errors, testing, http, cli, config, processes, setup)",
    parameters: Type.Object({
      topic: StringEnum(Object.keys(TOPICS) as [string, ...string[]], {
        description: "Topic to load",
      }),
    }),
    async execute(_toolCallId, params) {
      const content = loadReference(skillDir, params.topic);
      if (!content) {
        return {
          content: [{ type: "text", text: `Unknown topic: ${params.topic}` }],
          details: {},
        };
      }
      injectedTopics.add(params.topic);
      return {
        content: [{ type: "text", text: `${effectProjectStatus(sessionCwd).message ?? "Resolve the consuming Effect version first."}\n\n${content}` }],
        details: { topic: params.topic, label: TOPICS[params.topic]?.label },
      };
    },
  });
}

// --- Scaffold generators ---

function generateServiceScaffold(name: string): string {
  return `// Target: Effect 4.0.0-rc.112. Adapt application-specific placeholders.
import { Effect, Layer, Schema, Context } from "effect"

export const ${name}Id = Schema.String.pipe(Schema.brand("${name}Id"))
type ${name}Id = typeof ${name}Id.Type

export class ${name} extends Context.Service<
  ${name},
  {
    readonly findById: (id: ${name}Id) => Effect.Effect<unknown>
    readonly create: (data: unknown) => Effect.Effect<unknown>
  }
>()("@app/${name}") {
  static readonly layer = Layer.effect(
    ${name},
    Effect.gen(function* () {
      // yield* dependencies here

      const findById = Effect.fn("${name}.findById")(function* (id: ${name}Id) {
        // implementation
        return yield* Effect.succeed({ id })
      })

      const create = Effect.fn("${name}.create")(function* (data: unknown) {
        // implementation
        return yield* Effect.succeed(data)
      })

      return { findById, create }
    })
  )

  static readonly testLayer = Layer.sync(${name}, () => {
    const store = new Map<${name}Id, unknown>()

    const findById = (id: ${name}Id) => Effect.succeed(store.get(id))
    const create = (data: unknown) => Effect.sync(() => {
      // store data
      return data
    })

    return { findById, create }
  })
}`;
}

function generateSchemaScaffold(name: string): string {
  return `// Target: Effect 4.0.0-rc.112. Adapt application-specific placeholders.
import { Schema } from "effect"

export const ${name}Id = Schema.NonEmptyString.pipe(Schema.brand("${name}Id"))
type ${name}Id = typeof ${name}Id.Type

export class ${name} extends Schema.Class<${name}>("${name}")({
  id: ${name}Id,
  name: Schema.String,
  createdAt: Schema.DateFromString,
}) {
  get displayName() {
    return this.name
  }
}

// JSON encoding/decoding
export const ${name}FromJson = Schema.fromJsonString(${name})`;
}

function generateErrorScaffold(name: string): string {
  return `// Target: Effect 4.0.0-rc.112. Adapt application-specific placeholders.
import { Schema } from "effect"

class ${name}NotFoundError extends Schema.TaggedError<${name}NotFoundError>()(
  "${name}NotFoundError",
  {
    id: Schema.String,
    message: Schema.String,
  }
) {}

class ${name}ValidationError extends Schema.TaggedError<${name}ValidationError>()(
  "${name}ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

class ${name}Error extends Schema.TaggedError<${name}Error>()(
  "${name}Error",
  {
    cause: Schema.Defect(),
  }
) {}`;
}

function generateTestScaffold(name: string): string {
  return `// Target: Effect 4.0.0-rc.112. Adapt application-specific placeholders.
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
// import { ${name}, ${name}Id } from "../src/${name.toLowerCase()}"

describe("${name}", () => {
  // const testLayer = ${name}.testLayer

  it.effect.skip("creates an instance", () =>
    Effect.gen(function* () {
      // const svc = yield* ${name}
      // const result = yield* svc.create({ name: "test" })
      // expect(result).toBeDefined()
      // Replace with assertions against the service implementation.
    })
    // .pipe(Effect.provide(testLayer))
  )

  it.effect.skip("finds by id", () =>
    Effect.gen(function* () {
      // const svc = yield* ${name}
      // yield* svc.create({ id: "test-1", name: "Alice" })
      // const found = yield* svc.findById(${name}Id.make("test-1"))
      // expect(found).toBeDefined()
      // Replace with assertions against the service implementation.
    })
    // .pipe(Effect.provide(testLayer))
  )

  it.effect.skip("handles errors after defining a typed failure", () =>
    Effect.gen(function* () {
      // const svc = yield* ${name}
      // Add a failing operation and assert its declared error with Effect.flip.
      // Replace with assertions against the service implementation.
    })
    // .pipe(Effect.provide(testLayer))
  )
})`;
}
