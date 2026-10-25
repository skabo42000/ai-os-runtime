# AI OS Runtime

AI OS is a local task queue that runs bounded agent work, checks the resulting evidence, and records exceptions for review. This repository is a sanitized portfolio runtime with fictional inputs.

## Try it in five minutes

Requires **Node.js 24+** and npm. From this repository:

```sh
node --version
npm ci
npm run demo
npm run demo:failures
```

The default demo uses a **scripted fixture worker** with the real SQLite controller and independent verifier. It needs no model account, keys, server or network. There are no npm dependencies. Node may print an experimental SQLite warning.

It prints `queued -> running -> verifying -> prepared`, a SHA-256 for a verified report, three fictional request IDs, duplicate suppression and saved-result recovery. The second command also checks ten controlled failures. Unexpected behavior exits nonzero; expected failures pass only their failure-handling assertions, while their task criteria remain unavailable.

Each run creates a fresh temporary workspace, separate SQLite state and output directory. The report is `<temporary output>/<event hash>/report.json`; the driver removes its temporary files after checking them. Printed paths are placeholders so the transcript is shareable. See the [actual transcript](docs/demo-transcript.md).

## What the demo proves

The fixture computes a report from three invented Harbor Workshop requests. The host separately checks its schema, exact acceptance checks, source links, priority order, expected values, source and policy fingerprints, and artifact hash. A worker saying “completed” is insufficient.

The demonstration covers duplicate suppression, saved-result recovery, missing sources, held projects, changed evidence and explicit blocked states. The injection sample remains data. This does not measure model answer quality or establish broad prompt-injection resistance.

## Architecture

```mermaid
flowchart LR
    T[Explicit trigger] --> M[Validated task and source manifest]
    M --> Q[SQLite queue]
    Q --> W[Selected worker]
    W --> V[Independent evidence checks]
    V --> P[Prepared or blocked]
    P --> O[Notification outbox]
    N[Optional native session access] -. awake host required .-> T
```

Stable event IDs prevent the same assignment from being enqueued twice in one database. Immutable task and source hashes bind results to inputs. A local coordinator lease prevents concurrent ticks; an interrupted task without an attested result remains blocked. Operational state stays outside source control. These are local preparation guarantees, not universal exactly-once external actions.

The runtime supplies task contracts, ownership, verification, recovery and outbox handling. Model reasoning, CLI authentication and sandboxing, native remote access and OS scheduling are supplied capabilities. Read [architecture and contracts](docs/architecture.md).

## Optional real agent use

The optional subscription Codex CLI adapter requires explicit configuration, an installed CLI and an existing ChatGPT login managed by that CLI. Set `provider` to `{"name":"codex","model":"YOUR_SELECTED_MODEL","effort":"low"}` in your local configuration. Select the installed executable with `AI_OS_CODEX_BIN` if necessary. No live provider was invoked for this build.

The adapter refuses API or unknown login status, uses a read-only source snapshot, disables extensions and web search, bounds execution time, and has no paid or model fallback. CLI flags and real account behavior require separate integration checks. The current verifier supports only this bounded maintenance-report contract. Other models, providers, business tasks and phone command execution are unavailable.

See [configuration and manual ticks](procedures/work-controller.md). The example config deliberately requires local state/report paths; it cannot silently discover another workspace. The demo supplies isolated paths automatically.

## Results and failures

On October 25, 2026, the public offline suite passed **62/62 tests** on Node 24.21.0. The fixture demo verified one report, suppressed a duplicate, reopened SQLite and recovered a saved result without another worker launch. All ten controlled failure cases blocked as expected. See [evaluation](docs/evaluation.md) for input fingerprints, commands, denominators and unavailable integrations.

These are tests of the public runtime with fictional input and scripted providers. They are not evidence of customer use, production reliability or hosted CI execution. No CI badge is shown.

## Personal-use case study

Built with AI coding agents (Claude Code and Codex). I specified the workflow and directed the build and checks. This release makes the queue mechanism inspectable without private operational records. The [case study](docs/personal-use.md) separates measured public fixtures from unmeasured personal-use outcomes; no time savings or independent coding mastery is inferred.

## Phone and operating limits

Execution requires an awake host and available selected provider. Console preview is not a phone notification. Native app access and service notification delivery are separate integrations.

Noop is the default. Console is local only. An optional macOS Reminders adapter records accepted, failed or uncertain attempts, with quiet hours, a daily cap and durable deduplication. An accepted OS request does not establish iPhone receipt. No scheduler is installed, no inbound phone endpoint exists, and no real device check was performed for this public build. Read [phone integration boundaries](docs/phone.md).

## Safety, maintenance and license

Sources are explicitly scoped and read-only; held or retired projects stop execution and invalidate reused evidence. Workers cannot authorize outbound actions. Pause persists and stops new stages. Review interrupted work and create a new event rather than retrying it blindly. Keep state, private input, raw provider output and local configuration out of public exports.

```sh
npm test
```

See [SECURITY.md](SECURITY.md) for threat limits and reporting, [controller operations](procedures/work-controller.md) for pause/recovery, and the [MIT license](LICENSE).
