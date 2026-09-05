import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const copy = mkdtempSync(join(tmpdir(), "effect-invalid-example-"));
try {
  for (const directory of ["skills", "hooks", "extensions", "validation"]) {
    cpSync(join(root, directory), join(copy, directory), {
      recursive: true,
      filter: source => !["node_modules", "generated"].includes(basename(source)),
    });
  }
  symlinkSync(join(root, "validation/node_modules"), join(copy, "validation/node_modules"), "dir");
  const skill = join(copy, "skills/effect-ts/SKILL.md");
  const original = readFileSync(skill, "utf8");
  const invalid = original.replace('import { Context, Effect, Layer, Schema } from "effect"',
    'import { Context, Effect, Layer, Schema, InvalidEffectApi } from "effect"');
  if (invalid === original) throw new Error("The negative probe's target import changed");
  writeFileSync(skill, invalid);
  const result = spawnSync(process.execPath, ["check.mjs"], {
    cwd: join(copy, "validation"), encoding: "utf8", timeout: 30000,
  });
  const output = result.stdout + result.stderr;
  if (result.status !== 1 || !output.includes("TS2305") || !output.includes("InvalidEffectApi")) {
    throw new Error(`Expected TS2305 for InvalidEffectApi; got ${result.status}:\n${output}`);
  }
  console.log("Negative proof passed: published core-service import InvalidEffectApi caused TS2305 and exit 1.");
} finally {
  rmSync(copy, { recursive: true, force: true });
}
console.log("Temporary invalid example removed. Working documentation is unchanged.");
