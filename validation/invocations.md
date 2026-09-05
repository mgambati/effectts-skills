# Invocation and reference review

Manual review of the skill description, workflow, and reference pointers. Each Effect case starts with version compatibility. The table records the expected path and checks that the published wording supports it. It does not measure a host's actual invocation behavior.

| Request and context | Expected selection | Manual result |
| --- | --- | --- |
| "Validate this Zod schema" in a package using Zod | No Effect skill | The description requires the Effect library. Schema alone is insufficient. |
| "Add a PostgreSQL schema migration" | No Effect skill | A database schema is outside the stated scope. |
| "Fix this React useEffect cleanup" without Effect dependencies | No Effect skill | React's hook name does not identify the TypeScript Effect library. |
| "Review this Schema.Struct" without import context | Inspect package and imports first | The shared workflow establishes the target before selecting references. |
| "Add HTTP retries" in an Effect package, but the target uses Axios | Confirm the target API; preserve Axios if it meets the task | Package presence and heuristic host hints do not make every HTTP client an Effect client. |
| "Keep these provider IDs opaque, but prevent mixing UserId and PostId" using Effect Schema | Schema decisions, nominal brands | Bare string brands are allowed. No invented prefix or UUID requirement. |
| "Reject invalid port numbers with Effect Schema" | Schema decisions; Config if loading environment values | Runtime checks enforce the contract; the brand adds only nominal distinction. |
| "Decode an Effect record with no methods" | Schema decisions; Data modeling for encoding | Struct is the starting choice; an existing constructor API can justify retaining Class. |
| "Add a computed display name to an Effect schema model" | Schema decisions, Data modeling | Class has a concrete use; computed behavior does not force unrelated models to migrate. |
| "Model success with data and failure with a reason" using Effect | Schema decisions, then Data modeling for matching | TaggedStruct or TaggedClass can satisfy the contract; classes are not mandatory. |
| "Represent pending, active, completed" using Effect Schema | Schema decisions | A literal union needs no variant classes. |
| "Use this plain record as an Effect HashMap key" on the supported v4 release | Schema decisions | Structural equality works; a class is needed only for an additional requirement. |
| "A service method needs the request's Scope" | Services and layers, Processes and scopes | The caller may retain the environment requirement; R = never is not imposed. |
| "Share a database across these Effect tests" | Testing; Services and layers for composition | Suite sharing is allowed with an explicit isolation policy. |
| "Fix Effect v3 schema decoding" | Version compatibility, then matching v3 source | The workflow preserves v3 unless migration is authorized. |
| "This workspace package uses another v4 prerelease" | Version compatibility from the owning package | A default-branch checkout or root package resolution is insufficient. |
| "Use the skill offline with a verified source mirror" | Version compatibility and task topics | A verified cached revision works without Context7 or host integrations. |
| "Generate a service" with only the skill installed | Shared workflow, Services and layers | The agent can write code with its available tools; the skill does not claim Pi's scaffold tool exists. |

The review found no unresolved contradiction in these paths. Live model selection, alias recognition, host discovery, and hook delivery remain unverified. Host integrations retain heuristic pattern detection, including possible false positives inside an Effect package.
