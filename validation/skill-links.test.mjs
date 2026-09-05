import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills")
const entries = fs.readdirSync(root).map(name => path.join(root, name, "SKILL.md"))

it.each(entries)("resolves local reference files and heading anchors in %s", entry => {
  const markdown = fs.readFileSync(entry, "utf8")
  for (const [, link] of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(link)) continue
    const [file, anchor] = link.split("#")
    const target = path.resolve(path.dirname(entry), file || path.basename(entry))
    expect(fs.statSync(target).isFile(), `${entry}: ${link}`).toBe(true)
    if (!anchor) continue
    const headings = [...fs.readFileSync(target, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)]
      .map(([, heading]) => heading.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-"))
    expect(headings, `${entry}: ${link}`).toContain(anchor)
  }
})
