#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resetSession } from "./session-state.mjs";

try { resetSession(JSON.parse(readFileSync("/dev/stdin", "utf8"))); }
catch { /* Session shutdown does not depend on cache cleanup. */ }
process.stdout.write("{}");
