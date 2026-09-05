import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, "audit-cases/wiring-entry.ts")

function diagnostics(source) {
  const options = {
    strict: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  host.readFile = file => file === entry ? source : readFile(file)
  return ts.getPreEmitDiagnostics(ts.createProgram([entry], options, host))
}

it("the runnable boundary rejects an unsatisfied Endpoint and accepts its provider", () => {
  const original = fs.readFileSync(entry, "utf8")
  const errors = diagnostics(original)
  expect(errors).toHaveLength(1)
  expect(errors[0].file.fileName).toBe(entry)
  expect(errors[0].code).toBe(2345)
  expect(ts.flattenDiagnosticMessageText(errors[0].messageText, "\n")).toContain("Endpoint")

  const corrected = original
    .replace('import { ready }', 'import { EndpointLive, ready }')
    .replace("runPromise(ready)", "runPromise(ready.pipe(Effect.provide(EndpointLive)))")
  expect(diagnostics(corrected)).toEqual([])
})
