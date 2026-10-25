# Architecture and contracts

The public runtime adapts local queue, ownership, task/result fingerprints, evidence validation,
timeouts and recovery from an existing private implementation. Configuration, service integration,
demo fixtures and documentation were rewritten for this release. The build report records exact
source fingerprints and which files were retained. No private state or history was transferred.

Installation root supplies code, generic roles, procedures and strict worker schema. The explicit
configuration supplies workspaceRoot, stateDir, reportDir, registry, policy, timezone, provider
and notifications. Paths resolve relative to the config file, with `--config` preceding
`AI_OS_CONFIG` and the shipped example. `AI_OS_STATE_DIR` overrides state only; `AI_OS_CODEX_BIN`
selects the optional executable. There is no workspace autodiscovery. Workspace, state and reports
must be disjoint; default runtime state rejects synced locations and repository containment.

The demo builds isolated roots automatically. `AI_OS_DEMO_TMP` explicitly selects disposable fixture
scratch space for constrained environments; it permits synced scratch SQLite, refuses live providers
and OS notifications, and removes all temporary data. That exception is printed in the transcript.
Tests use this explicit disposable fixture mode. It is not normal durable operational storage.

## Execution

The saved task specifies immutable ID, project, role, goal, exact sources, acceptance, output name,
read-only/outbound flags and timeout. This release deliberately accepts only the supplied maintenance
report contract. Three roles are read-only; role defaults are explicit and the selected runtime provider
is configured separately. Registry statuses fail closed. Source paths reject escapes, symlinks and
sensitive filenames. The manifest binds every source byte to a SHA-256.

`execute(task, inputManifest, sandbox, hooks, signal)` returns an envelope with provider label,
observed usage (or null), computed report and strict worker result. Workers report observations;
the host verifies exact criteria, source citations, expected report, order and artifact bytes.
CLI snapshots contain only the three sources and generic policy/rules; no private workspace discovery.
The optional provider adds a strict output schema and never receives the independent expected report.

SQLite uses WAL, full synchronization and immediate transactions. A coordinator lease binds a random
owner reference to host/process identity; alive, foreign or unknown ownership refuses takeover.
One tick advances at most two tasks. Pausing persists and stops new tasks; it does not terminate
already running work. Read-only workers do not have a project edit path.

The normal state path is queued → running → verifying → prepared. A host-saved receipt is hashed in
SQLite before preparation. On restart, its sources, policy, contract and artifact must still match.
A crash before that attestation, an unknown running task, or invalid evidence blocks without replay.
Prepared evidence is audited on subsequent ticks; later tamper or a project hold revokes preparation.
There is no guarantee during periods with no ticks, and no protection against an attacker editing
both database and artifacts with the same local user privileges.

## Notifications and supplied capabilities

Outbox identity is derived from event plus outcome. Quiet hours and a daily cap apply before preview
or OS delivery. An attempted effect is reserved durably as unknown before calling the adapter.
Noop records disabled, console records preview, and Reminders may record accepted, failed or unknown.
Uncertain attempts are never automatically replayed. Notification output contains only opaque
references and fixed outcome text. Accepted is not a phone receipt. A superseded pending success
cannot later alert after an evidence failure; a previously accepted alert cannot be recalled.

Model reasoning, secure login, provider sandboxing, native sessions, device synchronization and
scheduling belong to their providers/OS. This repository adds no cloud host, scheduler, remote pairing,
business approval adapter, external write, authenticated phone command or model fallback.
