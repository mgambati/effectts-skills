---
name: effect-audit
description: "Audit existing TypeScript Effect code for evidence-backed defects, or assess its idioms and architecture when requested. Use for Effect code reviews and audit-led remediation. Ordinary implementation uses effect-ts."
license: MIT
---

# Effect audit

Review is the default outcome. Apply fixes only when the user's request authorizes remediation, within that scope. A request to assess idioms or architecture authorizes recommendations, not a rewrite. Service-design methodology is outside this skill.

This skill uses the existing `effect-ts/references` files. Install `effect-audit` and `effect-ts` as sibling directories. If a reference is missing, report the missing dependency and keep affected conclusions unverified until matching evidence is available.

## Review workflow

1. Bound the review. Read repository instructions, the owning package, and the requested files or diff. Identify the required behavior, public contracts, and relevant callers, providers, and tests. Record the reviewed scope and any inaccessible or omitted code before judging completeness.
2. Establish version evidence. Follow [version compatibility](../effect-ts/references/version-compatibility.md). Record the exact installed Effect and relevant companion versions. Verify each API-dependent candidate against matching source, declarations, or tests. These references target a specific v4 release; they do not establish compatibility with the consuming project by themselves. Separate application defects from unresolved version questions.
3. Trace candidates to consequences. Follow execution, error handling, resource ownership, layer construction, and schema boundaries as relevant to the scope. Searches produce candidates. Confirm imports and follow callers before deciding whether an Effect is discarded or a requirement remains unsatisfied at a runnable entry point. A returned Effect or a layer intentionally awaiting its caller's dependencies can be correct.
4. Adjudicate every candidate. Use the categories and evidence requirements below. Consult the existing [topic index](../effect-ts/SKILL.md#select-a-reference) only for the APIs involved. For layer wiring, read [providing layers](../effect-ts/references/services-and-layers.md#providing-layers). For data boundaries, read [schema decisions](../effect-ts/references/schema-decisions.md) and [data modeling](../effect-ts/references/data-modeling.md). Finish with each candidate confirmed as a finding, recorded as correct, or left as an explicit evidence gap.
5. Report the review. Lead with confirmed defects ordered by impact. Report architectural and idiomatic recommendations separately. Include confirmed-correct patterns, evidence gaps, the checked versions and scope, and validation actually run. If no defects are supported, say so and identify what was checked. A clean review needs no changes.

## Categories and evidence

Categories describe the issue; they do not assign severity. Rank severity by consequence, reachability, and affected users. A schema defect can be more urgent than a performance issue.

| Category | Evidence to seek |
| --- | --- |
| Correctness | A reachable path violates required behavior, such as an operation never executing, an unsatisfied runtime dependency, lost failures, or premature resource release. |
| Performance | Measurements or a concrete work count show unnecessary cost under a stated workload. Account for intentional caching, isolation, and repeated authorization checks. |
| Schema | Accepted inputs, encoded outputs, or constraints disagree with a documented domain or transport contract. Follow the full decode, transform, and encode path. |
| Architecture | A dependency or boundary violates a project requirement or creates a demonstrated operational problem. Otherwise present a design tradeoff as a recommendation. |
| Idiom | An alternative fits an established project convention or an explicitly requested style review. Correct alternatives remain optional unless their behavior violates a requirement. |

Each finding or recommendation needs:

- A stable ID, category, and disposition, either defect or recommendation. Give defects a severity justified by impact.
- A precise file and line location, plus the triggering input or execution path.
- The concrete consequence and the requirement it affects. For recommendations, state the expected benefit and tradeoff.
- Supporting evidence, such as a caller trace, inferred environment, compiler diagnostic, contract test, measurement, or version-matched implementation. Distinguish executed evidence from inspection and inference.
- A proportionate correction and how to verify it. State prerequisite finding IDs when fixes depend on one another.

Keep unsupported suspicions in evidence gaps with the missing check. Do not inflate them into findings.

For confirmed-correct candidates, record the location, the pattern questioned, and why the current behavior meets the requirement. Tie the record to the reviewed revision or code state and relevant version. Revisit it when that code, contract, or dependency changes. This record prevents repeated unnecessary changes without exempting stale code from review.

## Project decisions

Choose schema ownership from the public contract. Deriving a response from a database table fits some applications; an independent schema fits computed responses, external providers, or an API that evolves separately from storage. Judge manual mappers by their transformations, field exposure, and tests. Keep a mapper that deliberately translates representations or removes private fields.

Evaluate file boundaries, service counts, and method counts through cohesion, ownership, and actual maintenance or runtime problems. Size alone is a review cue. Propose splitting or removal only with a concrete benefit and a check of consumers and compatibility obligations. Completion depends on resolving the scoped review, never on a deletion quota.

Use observed semantics and project conventions to assess tracing, error representations, mutable state, and combinator choices. Library examples show possible designs. A difference from an example is not evidence of a defect.

## Authorized remediation

When remediation is authorized, choose the smallest correction that addresses each confirmed defect. Keep optional design recommendations separate unless the user's scope includes them.

Order dependent fixes by their actual prerequisites. Change a foundational contract before adapting its consumers, treating a contract and the consumers needed to restore compilation as one coherent change. Independent findings need no invented dependency graph.

Use the project's existing checks. Read [testing](../effect-ts/references/testing.md) when selecting Effect test facilities. For a reproducible bug, establish a regression test that fails for the reported consequence and passes after the correction. Use contract tests when a fix could change public data or dependency behavior. Compare implementations against the same contract when substitutability matters. Add tests for behavior, not to satisfy a framework or coverage quota.

After each coherent fix, run the relevant checks before moving to dependent work. Separate pre-existing failures from new regressions. Finish by reporting resolved finding IDs, remaining findings, changed files, and the commands and outcomes. Distinguish compilation, executed behavior, and manual inspection. Stop at the authorized slice.

## Attribution

Adapted from Artimath's [effect-deep-audit](https://github.com/artimath/effect-skills/blob/1a75ab75712ea5008c3266813df364fd2dcbc3d7/skills/effect-deep-audit/SKILL.md) and [effect-deslopify-idiomatic](https://github.com/artimath/effect-skills/blob/1a75ab75712ea5008c3266813df364fd2dcbc3d7/skills/effect-deslopify-idiomatic/SKILL.md). The [MIT license and copyright notice](LICENSE) accompany this skill. The adaptation retains review categories, confirmed-correct records, prerequisite ordering, and behavioral verification, with project requirements deciding corrections.
