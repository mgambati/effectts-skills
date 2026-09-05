import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import { fixtures } from './fragments.mjs';
import { SUPPORTED_EFFECT_VERSION } from '../hooks/effect-version.mjs';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dependencies = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8')).devDependencies;
for (const name of ['effect', '@effect/platform-node', '@effect/platform-bun', '@effect/vitest']) {
  if (dependencies[name] !== SUPPORTED_EFFECT_VERSION) throw new Error(`Unpinned or mismatched dependency: ${name}`);
  const installed = JSON.parse(fs.readFileSync(path.join(here, 'node_modules', name, 'package.json'), 'utf8')).version;
  if (installed !== dependencies[name]) throw new Error(`Installed version mismatch: ${name}`);
}
const generated = path.join(here, 'generated');
fs.rmSync(generated, { recursive: true, force: true });
fs.mkdirSync(generated, { recursive: true });
const skill = path.join(root, 'skills/effect-ts');
const files = [path.join(skill, 'SKILL.md'), ...fs.readdirSync(path.join(skill, 'references')).filter(x => x.endsWith('.md')).map(x => path.join(skill, 'references', x))];
const groups = new Map();
const inventory = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let count = 0;
  for (const match of source.matchAll(/(?:<!-- (check|fragment): ([^\n]+) -->\n)?```(?:typescript|ts)\n([\s\S]*?)```/g)) {
    count++;
    const [, kind, id, code] = match;
    if (!kind) throw new Error(`Unclassified example: ${file} #${count}`);
    inventory.push({ file: path.relative(root, file), block: count, kind, id });
    if (kind === 'check') groups.set(id, [...(groups.get(id) ?? []), code]);
    else {
      const key = `${path.basename(file)}:${count}`;
      const fixture = fixtures[key];
      if (!fixture) throw new Error(`Missing typed fixture: ${key}`);
      let body = code;
      let prelude = fixture.prelude + '\n';
      if (fixture.generator) {
        body = body.replace(/^import [^\n]+\n/gm, line => { prelude += line; return ''; });
        body = `const example = Effect.gen(function* () {\n${body}\n});`;
      }
      groups.set(`fragment-${path.basename(file, '.md')}-${count}`, [prelude, body]);
    }
  }
}
groups.set('cli-repository', groups.get('cli-tasks').slice(0, 2));
for (const [name, blocks] of groups) {
  // Grouped worked examples form one module; repeated identical imports are removed.
  const imports = new Map();
  let body = blocks.join('\n').replace(/^import \{([^}]+)\} from ([^\n]+)\n/gm, (_, names, mod) => {
    mod = mod.replace(/;$/, "");
    const set = imports.get(mod) ?? new Set();
    names.split(',').map(x => x.trim()).filter(Boolean).forEach(x => set.add(x));
    imports.set(mod, set);
    return '';
  });
  body = [...imports].map(([mod, names]) => `import { ${[...names].join(', ')} } from ${mod}`).join('\n') + '\n' + body + '\nexport {}\n';
  fs.writeFileSync(path.join(generated, `${name}.ts`), body);
}
// Execute the actual generator functions without loading the Pi host.
const extension = fs.readFileSync(path.join(root, 'extensions/effect-context.ts'), 'utf8');
const functions = extension.slice(extension.indexOf('// --- Scaffold generators ---'));
const generators = vm.runInNewContext(ts.transpile(functions + '\n({generateServiceScaffold, generateSchemaScaffold, generateErrorScaffold, generateTestScaffold})', { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }));
for (const [name, fn] of Object.entries(generators)) {
  fs.writeFileSync(path.join(generated, `${name}.ts`), fn('Example') + '\nexport {}\n');
}
fs.writeFileSync(path.join(generated, 'inventory.json'), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(generated, 'package.json'), JSON.stringify({type: 'module', version: '1.0.0'}));
const sourceFiles = fs.readdirSync(generated).filter(x => x.endsWith('.ts')).map(x => path.join(generated, x));
const localTests = fs.readdirSync(here).filter(x => x.endsWith('.test.ts') || x === 'vitest.config.ts').map(x => path.join(here, x));
const program = ts.createProgram([...sourceFiles, ...localTests], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true,
  exactOptionalPropertyTypes: true, noEmit: true, skipLibCheck: true,
  resolveJsonModule: true, allowSyntheticDefaultImports: true, types: ['node'], typeRoots: [path.join(here, 'node_modules/@types')],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: x => x, getCurrentDirectory: () => here, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  console.log(`Checked ${inventory.length} Markdown blocks: ${inventory.filter(x => x.kind === "check").length} complete/grouped and ${inventory.filter(x => x.kind === "fragment").length} illustrative with typed fixtures, plus 4 generated scaffolds. Inventory: generated/inventory.json.`);
}
