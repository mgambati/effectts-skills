import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    include: ["*.test.ts", "*.test.mjs", "generated/testing-{basic,clock,events,live,logging,reference,scoped}.ts"],
    testTimeout: 10000,
  },
})
