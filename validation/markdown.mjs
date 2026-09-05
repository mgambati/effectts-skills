// Read fences line by line so nested Markdown text cannot hide an example.
export function extractExamples(source, file) {
  const lines = source.split(/\r?\n/);
  const examples = [];
  for (let index = 0; index < lines.length; index++) {
    const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/);
    if (!opening) continue;
    const start = index;
    const [, fence, info] = opening;
    const language = info.split(/\s+/)[0].toLowerCase();
    const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    while (++index < lines.length && !closing.test(lines[index])) {}
    if (index === lines.length) throw new Error(`Unclosed fence: ${file}:${start + 1}`);
    if (!["ts", "typescript", "tsx"].includes(language)) continue;
    const marker = lines[start - 1]?.match(/^<!-- (check|fragment): (.+) -->$/);
    if (!marker) throw new Error(`Unclassified example: ${file}:${start + 1}`);
    const [, kind, label] = marker;
    if (kind === "check" && !/^[a-z][a-z0-9-]*$/.test(label)) throw new Error(`Invalid example ID: ${label}`);
    examples.push({ kind, label, line: start + 2, extension: language === "tsx" ? "tsx" : "ts", code: lines.slice(start + 1, index).join("\n") + "\n" });
  }
  return examples;
}

export function mergeBlocks(blocks) {
  // Worked examples repeat named imports between sections. Keep every imported name.
  const imports = new Map();
  const body = blocks.join("\n").replace(/^import \{([^}]+)\} from ([^\n]+)\n/gm, (_, names, mod) => {
    mod = mod.replace(/;$/, "");
    const set = imports.get(mod) ?? new Set();
    names.split(",").map(x => x.trim()).filter(Boolean).forEach(x => set.add(x));
    imports.set(mod, set);
    return "";
  });
  return [...imports].map(([mod, names]) => `import { ${[...names].join(", ")} } from ${mod}`).join("\n") + "\n" + body + "\nexport {}\n";
}
