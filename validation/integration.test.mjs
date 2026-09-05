import { afterEach, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
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
function hook(name, cwd, source) {
  const file = path.join(cwd, "example.ts");
  if (source) fs.writeFileSync(file, source);
  return JSON.parse(execFileSync(process.execPath, [path.join(root, "hooks", name)], {
    cwd,
    input: JSON.stringify({ cwd, tool_input: { file_path: file } }),
    env: { ...process.env, EFFECT_SEEN_REFS: "" },
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

function extension() {
  const filename = path.join(root, "extensions/effect-context.ts");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  expect(compiled.diagnostics).toEqual([]);
  const exported = {};
  vm.runInNewContext(compiled.outputText, {
    exports: exported, __filename: filename, process,
    require(name) {
      if (name === "node:fs") return fs;
      if (name === "node:path") return path;
      if (name === "../hooks/effect-version.mjs") return compatibility;
      if (name === "@sinclair/typebox") return { Type: { Object: x => x, String: x => x } };
      if (name === "@mariozechner/pi-ai") return { StringEnum: x => x };
      throw new Error(`Unexpected host import: ${name}`);
    },
  });
  const events = {}, commands = {}, tools = {}, messages = [];
  exported.default({
    on: (name, fn) => { events[name] = fn },
    registerCommand: (name, command) => { commands[name] = command },
    registerTool: tool => { tools[tool.name] = tool },
    sendMessage: message => messages.push(message),
  });
  return { events, commands, tools, messages };
}
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
