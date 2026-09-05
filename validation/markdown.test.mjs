import { expect, it } from "vitest";
import { extractExamples, mergeBlocks } from "./markdown.mjs";

it.each(["ts", "typescript", "tsx"])("rejects an unclassified %s example", language => {
  expect(() => extractExamples(`\`\`\`${language}\nconst x = 1\n\`\`\`\n`, "guide.md")).toThrow("Unclassified");
});
it("reads tilde fences and CRLF and preserves the exact example body", () => {
  expect(extractExamples("<!-- check: example -->\r\n~~~typescript\r\nconst x = 1\r\n~~~\r\n", "guide.md"))
    .toEqual([{ kind: "check", label: "example", line: 3, extension: "ts", code: "const x = 1\n" }]);
});
it("rejects unsafe IDs and unclosed fences", () => {
  expect(() => extractExamples("<!-- check: ../escape -->\n```ts\nconst x = 1\n```", "guide.md")).toThrow("Invalid example ID");
  expect(() => extractExamples("<!-- check: sample -->\n```ts\nconst x = 1", "guide.md")).toThrow("Unclosed fence");
});
it("keeps fragments' exclusion reasons and imported API names", () => {
  const blocks = extractExamples("<!-- fragment: Needs a database implementation. -->\n```ts\nquery()\n```", "guide.md");
  expect(blocks[0].label).toBe("Needs a database implementation.");
  const result = mergeBlocks(['import { Effect } from "effect"\nconst a = 1', 'import { Effect, InvalidApi } from "effect"\nconst b = 2']);
  expect(result).toContain('import { Effect, InvalidApi } from "effect"');
  expect(result).toContain("const a = 1");
  expect(result).toContain("const b = 2");
});

it("classifies fences with info attributes instead of skipping them", () => {
  expect(() => extractExamples('```typescript title="example.ts"\ninvalid()\n```', "guide.md")).toThrow("Unclassified");
  expect(extractExamples('<!-- check: sample -->\n```TS title="example.ts"\nconst x = 1\n```', "guide.md")[0].code).toBe("const x = 1\n");
});
