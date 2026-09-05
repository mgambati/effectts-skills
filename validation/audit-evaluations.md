# Effect audit evaluations

Evaluated on 2026-09-05 against the four cases in [audit-cases](audit-cases), added to the working tree based on repository revision `ceb70a1b35ad8ca9d1891ad63e227062d2bef5f7`. The scope covers all five fixture files and their stated contracts. No application code was audited in this slice.

## Method and version evidence

The author manually applied [effect-audit](../skills/effect-audit/SKILL.md) to each case, traced the candidate, checked the shared references, and classified the outcome. The author also wrote and executed compiler and behavior tests. These are manual review decisions backed by executable evidence, not independent or blinded agent evaluations. No live host invocation or automatic skill-selection test ran.

The installed package metadata, manifest, and lockfile agree on Effect `4.0.0-rc.112`. The full validator also checks the exact companion pins, including `@effect/vitest`, against the installed packages. This run used Node `24.20.0`, TypeScript `5.9.3`, and Vitest `4.1.11` on macOS.

Inspected installed `effect/src/Effect.ts` for lazy construction and `runPromise`'s environment requirement, and `effect/src/Layer.ts` for layer construction and dependency provision. The [version reference](../skills/effect-ts/references/version-compatibility.md) identifies matching official source. Executed tests establish the fixture behavior and JSON contract at the installed release.

## Findings

| ID | Location | Classification and consequence | Evidence | Proportionate correction |
| --- | --- | --- | --- | --- |
| A1 | `audit-cases/delivery.ts:5` | Correctness defect, high impact for this contract. Running `deliver` acknowledges delivery while never recording it. | The delivery contract expects one record before acknowledgement. Execution returns `acknowledged` with no records, so the contract assertion fails. Installed `Effect.sync` documentation confirms lazy evaluation. | Sequence the operation with `yield*`. The same contract passes for this correction in `audit.test.ts`. |
| A2 | `audit-cases/wiring-entry.ts:4`, through `wiring.ts:14` | Correctness defect, build blocking. The runnable entry point retains an `Endpoint` requirement after providing `ClientLive`. | The compiler produces exactly one TS2345 diagnostic at the entry point, identifying `Endpoint`. It produces zero diagnostics when the boundary supplies `EndpointLive`. | Supply `EndpointLive` at the application composition boundary. The corrected boundary compiles. A runtime test also composes `ClientLive` with `Layer.provide(EndpointLive)` and returns the expected URL. |

A1 and A2 have no prerequisite relationship. The faulty fixtures remain intact as negative cases. Corrections run inside the evaluation tests; no remediation was needed for the two correct cases. The missing-layer entry point was compiled, not executed with a cast or suppressed diagnostic.

## Confirmed-correct records

These records apply to the fixture code reviewed on the date and Effect version above. Recheck them if their implementation or contracts change.

| Location | Candidate considered | Decision and evidence |
| --- | --- | --- |
| `audit-cases/profile.ts:10-16` | Independent response schema and manual `toPublicUser` mapper | Keep both. The public contract combines names and excludes storage credentials. The executed test checks the exact mapped fields before encoding, the exact JSON fields, and successful decoding. Deriving the response directly from a storage model would not establish this transformation. |
| `audit-cases/total.ts:4-6` | Effect returned through combinators without a generator or tracing wrapper | Keep it. The returned Effect reaches the runtime. Execution checks no eager read, one read per run, repeated execution, mixed-sign addition, and the empty input result. The fixture contract requires no span. |
| `audit-cases/wiring.ts:7-10` | A reusable layer retains a dependency | Keep the layer's dependency declaration. Its caller must provide `Endpoint`; the defect is at the runnable boundary. The composed layer passes the execution test. |

Manual review reported two defects and zero defects on the two clean controls. False positives on those controls were **0 of 2**. There were no observed missed defects among the two deliberately faulty cases. Those counts describe this authored exercise, not measured agent precision or recall. No architecture or idiom recommendation had a demonstrated benefit within these contracts.

## Executed validation

| Check | Result |
| --- | --- |
| Skill creator's `quick_validate.py skills/effect-audit` | Passed frontmatter, naming, and placeholder checks. System Python initially lacked PyYAML; reran successfully in an isolated temporary virtual environment with PyYAML. |
| `npm test -- audit.test.ts audit-types.test.mjs skill-links.test.mjs`, run in `validation` | Seven tests passed: four behavior tests, one compiler test, and two skill entry-point link checks. |
| Root `npm run validate` | Passed the deliberate invalid-import proof, typechecked 82 Markdown blocks and four generated scaffolds, and ran 63 passing tests. Three existing application placeholders remained skipped. |
| Local references | Executed checks resolved relative files and heading anchors in both skill entry points. Shared Effect references were also compiled by the existing validator. |
| Upstream license comparison | SHA-256 matched the downloaded upstream license byte for byte: `2cfb4f7b2cf7b603fa2001bc70499791aba8a97e3cea94016b3f1eb29aea4ab7`. |

The first targeted Vitest command ran from the repository root and found no tests because the configuration expects `validation` as its working directory. The corrected command above executed the tests. That failed attempt counts as no evaluation.

## Manual structure and source review

Checked the skill's invocation description, review default, remediation condition, finding evidence requirements, confirmed-correct records, and shared reference routing against writing-for-agents, SKILL-MECHANICS.md, and unslop. The audit is separately discoverable for review requests. It adds no API examples or service-design workflow. The original `skills/effect-ts` directory remains unchanged.

Inspected Artimath's repository tree, `effect-deep-audit`, `effect-deslopify-idiomatic`, SDD's audit reference, and license at [revision 1a75ab7](https://github.com/artimath/effect-skills/tree/1a75ab75712ea5008c3266813df364fd2dcbc3d7). The new skill adapts methodology from the first two audit skills. Current upstream still prescribes Drizzle-derived responses, mapper removal, and size limits. This adaptation makes those decisions depend on contracts and consequences. The inspected audit files did not contain a numeric service or method deletion quota; the new workflow explicitly makes completion independent of a deletion quota.

The skill's attribution links pin the adapted sources. Its bundled [LICENSE](../skills/effect-audit/LICENSE) retains Artimath's full MIT copyright, permission, and warranty notice. The repository README also identifies the adaptation and its limits.

## Remaining limits

- Manual application cannot establish autonomous finding discovery, reliable invocation, or review-only behavior in a live agent. No independent evaluator ran.
- The executed cases cover one Effect prerelease and small synchronous or in-memory contracts. Other versions, real databases, network calls, resource cleanup, and performance findings remain untested here.
- Dependency ordering and optional architecture recommendations received instruction inspection only. No dependent remediation sequence was executed.
- Link checks use the repository's sibling layout. Installing both skill directories is documented; actual installation and host discovery remain unverified.
