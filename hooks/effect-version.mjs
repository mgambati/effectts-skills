import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export const SUPPORTED_EFFECT_VERSION = "4.0.0-rc.112";

// Resolve from the consuming package, never from this plugin's dependencies.
export function effectProjectStatus(cwd) {
  let directory = resolve(cwd);
  while (!existsSync(join(directory, "package.json"))) {
    const parent = dirname(directory);
    if (parent === directory) return { detected: false, supported: false };
    directory = parent;
  }
  const manifest = join(directory, "package.json");
  let dependencies;
  try {
    const pkg = JSON.parse(readFileSync(manifest, "utf8"));
    dependencies = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  } catch {
    return { detected: false, supported: false };
  }
  const declared = Object.keys(dependencies).some((name) => name === "effect" || name.startsWith("@effect/"));
  let version;
  try {
    const resolved = createRequire(manifest).resolve("effect/package.json");
    version = JSON.parse(readFileSync(resolved, "utf8")).version;
  } catch {
    // An unresolved install is not evidence of a supported version.
  }
  const detected = declared || typeof version === "string";
  const supported = version === SUPPORTED_EFFECT_VERSION;
  return {
    detected, supported, version,
    message: supported
      ? `Effect ${version}. Check relevant @effect/* peer dependencies before using examples.`
      : `Effect ${version ?? "version unresolved"}. This skill supports ${SUPPORTED_EFFECT_VERSION} only. Read references/version-compatibility.md, inspect the consuming package's lockfile and installed dependencies, and use matching official source and docs. For v3, use v3 documentation. Scaffolds require the supported release; changing the project's version requires task authorization.`,
  };
}
