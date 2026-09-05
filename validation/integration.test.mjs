import { afterEach, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { extension } from "./extension-host.mjs";
import * as compatibility from "../hooks/effect-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = [];
afterEach(() => temporary.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));
function project(version, range = "^4.0.0-rc.112") {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "effect-skill-check-"));
  temporary.push(cwd);
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ dependencies: { effect: range } }));
  if (version) {
    fs.mkdirSync(path.join(cwd, "node_modules/effect"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "node_modules/effect/package.json"), JSON.stringify({ name: "effect", version }));
  }
  return cwd;
}
function hook(name, cwd, source, extra = {}) {
  const file = path.join(cwd, "example.ts");
  if (source) fs.writeFileSync(file, source);
  return JSON.parse(execFileSync(process.execPath, [path.join(root, "hooks", name)], {
    cwd,
    input: JSON.stringify({ cwd, tool_input: { file_path: file }, ...extra }),
    env: { ...process.env, EFFECT_SESSION_STATE_DIR: path.join(cwd, ".hook-state") },
    encoding: "utf8",
  }));
}

it("resolves the installed version instead of a manifest range", () => {
  const supported = project("4.0.0-rc.112", "*");
  expect(compatibility.effectProjectStatus(supported).supported).toBe(true);
  const newer = project("4.0.0-rc.113");
  expect(compatibility.effectProjectStatus(newer).supported).toBe(false);
  const missing = project(undefined, "4.0.0-rc.112");
  expect(compatibility.effectProjectStatus(missing)).toMatchObject({ detected: true, supported: false });
});

it("session hook routes v3 and unresolved installations to version guidance", () => {
  for (const version of ["3.19.0", "4.0.0-rc.113", undefined]) {
    const result = hook("session-start.mjs", project(version));
    expect(result.hookSpecificOutput.additionalContext).toContain("use matching official source and docs");
    expect(result.hookSpecificOutput.additionalContext).not.toContain("class Users");
  }
  expect(hook("session-start.mjs", project("4.0.0-rc.112")).hookSpecificOutput.additionalContext).toContain("Context.Service");
});

it("read hook recognizes v4 services and processes and declines v3 injection", () => {
  const cwd = project("4.0.0-rc.112");
  expect(hook("pretooluse-inject.mjs", cwd, "class Users extends Context.Service<Users, {}>()('Users') {}").hookSpecificOutput.additionalContext).toContain('topic="services-and-layers.md"');
  expect(hook("pretooluse-inject.mjs", cwd, "import { ChildProcess } from 'effect/unstable/process'").hookSpecificOutput.additionalContext).toContain('topic="processes.md"');
  expect(hook("pretooluse-inject.mjs", project("3.19.0"), "Effect.forkDaemon(work)").hookSpecificOutput.additionalContext).not.toContain("<effect-reference");
});

function context(cwd) {
  return { cwd, ui: { setStatus() {}, notify() {} } };
}
it("extension gates every scaffold entry and recognizes current patterns", async () => {
  const app = extension();
  const unsupported = context(project("3.19.0"));
  await app.events.session_start({}, unsupported);
  await app.commands["effect:service"].handler("Users", unsupported);
  await app.commands["effect:test"].handler("Users", unsupported);
  expect(app.messages).toEqual([]);
  await expect(app.tools.effect_scaffold.execute("id", { type: "service", name: "Users" })).rejects.toThrow("supports");

  const supported = context(project("4.0.0-rc.112"));
  await app.events.session_start({}, supported);
  for (const type of ["service", "schema", "error", "test"]) {
    const result = await app.tools.effect_scaffold.execute("id", { type, name: "Users" });
    expect(result.content[0].text).toContain("4.0.0-rc.112");
  }
  const result = await app.events.tool_result({
    toolName: "read", input: { path: "example.ts" },
    content: [{ type: "text", text: "import { ChildProcess } from 'effect/unstable/process'; const child = ChildProcess.make('git', ['status']);" }],
  }, supported);
  expect(result.content.at(-1).text).toContain("/effect:docs processes");
});

it("hook deduplication survives separate processes and resets with session context", () => {
  const cwd = project("4.0.0-rc.112");
  const input = { session_id: "session-a" };
  const code = "Context.Service; Schema.Struct({});";
  expect(hook("pretooluse-inject.mjs", cwd, code, input).hookSpecificOutput).toMatchObject({
    hookEventName: "PreToolUse",
    additionalContext: expect.stringContaining('topic="services-and-layers.md"'),
  });
  expect(hook("pretooluse-inject.mjs", cwd, code, input).hookSpecificOutput.additionalContext).toContain('topic="data-modeling.md"');
  expect(hook("pretooluse-inject.mjs", cwd, code, input)).toEqual({});
  expect(hook("pretooluse-inject.mjs", cwd, code, { session_id: "session-b" }).hookSpecificOutput).toBeDefined();
  hook("session-start.mjs", cwd, undefined, input);
  expect(hook("pretooluse-inject.mjs", cwd, code, input).hookSpecificOutput).toBeDefined();
  hook("session-end.mjs", cwd, undefined, input);
  expect(fs.readdirSync(path.join(cwd, ".hook-state"))).toHaveLength(1); // session-b remains
});

it("version detection respects nested packages, hoisting and malformed manifests", () => {
  const cwd = project("4.0.0-rc.112");
  const nested = path.join(cwd, "packages/app");
  fs.mkdirSync(path.join(nested, "src"), { recursive: true });
  fs.writeFileSync(path.join(nested, "package.json"), JSON.stringify({ dependencies: { effect: "*" } }));
  expect(compatibility.effectProjectStatus(path.join(nested, "src")).supported).toBe(true);
  fs.mkdirSync(path.join(nested, "node_modules/effect"), { recursive: true });
  fs.writeFileSync(path.join(nested, "node_modules/effect/package.json"), JSON.stringify({ version: "3.19.0" }));
  expect(compatibility.effectProjectStatus(nested)).toMatchObject({ supported: false, version: "3.19.0" });
  fs.writeFileSync(path.join(nested, "package.json"), "bad json");
  expect(compatibility.effectProjectStatus(nested)).toMatchObject({ detected: false, supported: false });
});

it("extension deduplicates reference aliases, advances topics, and resets per session", async () => {
  const app = extension();
  const ctx = context(project("4.0.0-rc.112"));
  const read = { toolName: "read", input: { path: "example.ts" }, content: [{ type: "text", text: "Context.Service; Schema.Struct({});" }] };
  await app.events.session_start({}, ctx);
  await app.commands["effect:docs"].handler("layers", ctx);
  expect(app.messages[0].content).toContain("# Services & Layers");
  const first = await app.events.tool_result(read, ctx);
  expect(first.content.at(-1).text).toContain("/effect:docs data-modeling");
  expect(await app.events.tool_result(read, ctx)).toBeUndefined();
  await app.events.session_start({}, ctx);
  expect((await app.events.tool_result(read, ctx)).content.at(-1).text).toContain("/effect:docs services");
  await app.events.session_start({}, ctx);
  expect(await app.events.tool_result({ ...read, isError: true }, ctx)).toBeUndefined();
  await app.tools.effect_docs.execute("id", { topic: "layers" });
  expect((await app.events.tool_result(read, ctx)).content.at(-1).text).toContain("/effect:docs data-modeling");
});

it.each([
  ["Context.Reference", "services-and-layers"],
  ["Schema.Struct({})", "data-modeling"],
  ["Schema.TaggedError", "error-handling"],
  ["it.effect", "testing"],
  ["HttpClient", "http-clients"],
  ["Flag.boolean", "cli"],
  ["Config.schema", "config"],
  ["ChildProcess.make", "processes"],
])("read hook selects the reference for %s", (code, topic) => {
  const result = hook("pretooluse-inject.mjs", project("4.0.0-rc.112"), code);
  expect(result.hookSpecificOutput.additionalContext).toContain(`topic="${topic}.md"`);
});

it("parallel hook processes claim a reference once", async () => {
  const cwd = project("4.0.0-rc.112");
  const file = path.join(cwd, "example.ts");
  fs.writeFileSync(file, "Context.Service");
  const input = JSON.stringify({ cwd, session_id: "parallel", tool_input: { file_path: file } });
  const run = () => new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [path.join(root, "hooks/pretooluse-inject.mjs")], {
      cwd, env: { ...process.env, EFFECT_SESSION_STATE_DIR: path.join(cwd, ".hook-state") },
    }, (error, stdout) => error ? reject(error) : resolve(JSON.parse(stdout)));
    child.stdin.end(input);
  });
  const results = await Promise.all([run(), run(), run()]);
  expect(results.filter(result => result.hookSpecificOutput)).toHaveLength(1);
});

it("hooks handle malformed input and non-Effect projects without injecting", () => {
  const cwd = project();
  fs.writeFileSync(path.join(cwd, "package.json"), "{}");
  expect(hook("session-start.mjs", cwd)).toEqual({});
  expect(hook("pretooluse-inject.mjs", cwd, "Context.Service")).toEqual({});
  for (const name of ["session-start.mjs", "pretooluse-inject.mjs", "session-end.mjs"]) {
    expect(execFileSync(process.execPath, [path.join(root, "hooks", name)], { input: "bad json", encoding: "utf8" })).toBe("{}");
  }
});

it("version detection follows workspace symlinks and reads changed installed metadata", () => {
  const cwd = project("4.0.0-rc.112");
  const linked = project();
  fs.mkdirSync(path.join(linked, "node_modules"));
  fs.symlinkSync(path.join(cwd, "node_modules/effect"), path.join(linked, "node_modules/effect"));
  expect(compatibility.effectProjectStatus(linked).supported).toBe(true);
  fs.writeFileSync(path.join(cwd, "node_modules/effect/package.json"), JSON.stringify({ version: "4.0.0-rc.113" }));
  expect(compatibility.effectProjectStatus(linked)).toMatchObject({ supported: false, version: "4.0.0-rc.113" });
});

it("extension blocks references for a nested unsupported package", async () => {
  const app = extension();
  const ctx = context(project("4.0.0-rc.112"));
  const nested = path.join(ctx.cwd, "legacy");
  fs.mkdirSync(path.join(nested, "node_modules/effect"), { recursive: true });
  fs.writeFileSync(path.join(nested, "package.json"), JSON.stringify({ dependencies: { effect: "3.19.0" } }));
  fs.writeFileSync(path.join(nested, "node_modules/effect/package.json"), JSON.stringify({ version: "3.19.0" }));
  await app.events.session_start({}, ctx);
  expect(await app.events.tool_result({
    toolName: "read", input: { path: "legacy/index.ts" },
    content: [{ type: "text", text: "Context.Service" }],
  }, ctx)).toBeUndefined();
});
