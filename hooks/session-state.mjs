import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SUPPORTED_EFFECT_VERSION } from "./effect-version.mjs";

function directory(input) {
  if (typeof input.session_id !== "string" || !input.session_id) return undefined;
  const key = createHash("sha256").update(JSON.stringify([
    input.session_id, resolve(input.cwd || process.cwd()), SUPPORTED_EFFECT_VERSION,
  ])).digest("hex");
  return join(process.env.EFFECT_SESSION_STATE_DIR || join(tmpdir(), `effect-skill-${process.getuid?.() ?? "user"}`), key);
}

export function resetSession(input) {
  const dir = directory(input);
  if (dir) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* Context still loads if the cache is unavailable. */ }
  }
}

// Exclusive creation prevents concurrent hook processes from claiming the same ref.
// Without session metadata or writable storage, prefer repeated context to omission.
export function claimReference(input, ref) {
  const dir = directory(input);
  if (!dir) return true;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, ref), "", { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    return error.code !== "EEXIST";
  }
}
