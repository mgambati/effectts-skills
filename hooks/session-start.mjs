#!/usr/bin/env node
/**
 * SessionStart hook: detect Effect project and inject core patterns.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resetSession } from "./session-state.mjs";
import { effectProjectStatus } from "./effect-version.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadSkill() {
  const skillPath = join(pluginRoot, "skills", "effect-ts", "SKILL.md");
  try {
    const content = readFileSync(skillPath, "utf-8");
    // Strip frontmatter
    const match = content.match(/^---[\s\S]*?---\n([\s\S]*)$/);
    return match ? match[1].trim() : content;
  } catch {
    return null;
  }
}

let input;
try { input = JSON.parse(readFileSync(0, "utf-8")); }
catch { process.stdout.write("{}"); process.exit(0); }
resetSession(input);

const status = effectProjectStatus(input.cwd || process.env.CLAUDE_CWD || process.cwd());
if (status.detected) {
  const skill = status.supported ? loadSkill() : status.message;
  if (skill) {
    const output = {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `<effect-ts-patterns>\n${skill}\n</effect-ts-patterns>`,
      },
    };
    process.stdout.write(JSON.stringify(output));
  } else {
    process.stdout.write("{}");
  }
} else {
  process.stdout.write("{}");
}
