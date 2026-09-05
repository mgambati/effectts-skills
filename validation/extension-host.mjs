import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as compatibility from "../hooks/effect-version.mjs";

// Executes the extension's registration and callbacks. Pi rendering and permissions
// remain host responsibilities; unexpected runtime imports fail this adapter.
export function extension() {
  const filename = fileURLToPath(new URL("../extensions/effect-context.ts", import.meta.url));
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }, reportDiagnostics: true });
  if (compiled.diagnostics.length) throw new Error("Extension has syntax errors");
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
