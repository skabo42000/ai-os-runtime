# Public offline evaluation

Observed October 25, 2026, on Node 24.21.0 and npm 11.19.0. This public build has its own evidence;
no private system test totals or device receipts count toward it. The final `npm test` run passed
62/62 tests, with zero failures, cancellations or skips. See [the demo transcript](demo-transcript.md)
for the exact demo output.

The scripted demo and failure driver ran with explicit disposable scratch state because the managed
build sandbox forbids writes to the system temporary directory. This mode permits synced fixture
scratch state only, refuses real providers/OS notifications and deletes each isolated workspace.
A later unrestricted check on macOS (same day, Node 24.21.0) copied the tree into a fresh folder with a space in its path and ran `npm ci`, `npm run demo`, `npm run demo:failures` and `npm test` using the normal system temporary directory: all passed, 62/62 tests, about 5 seconds in total. A fresh source
copy with spaces in its path was run from a different working directory using the same explicit mode;
that is a local copy check, not an anonymous remote clone or a normal-host storage check.

Fixture version 1 inputs are fixed fictional records. Important SHA-256 fingerprints:

| Input | SHA-256 |
| --- | --- |
| source/requests.json | efffb520cdb27ee484d08b48f684fd79ab7e42092e12e7f0c5db85ed8649aeb5 |
| source/policy.md | 321ee19d029e8d6dd5c711eb912dfc6e7c1ffefa41fbc8b27fe61fca7bb46383 |
| source/injection.txt | 714eae46286db2d941a866068f3b2b1cf01dbec82b6a6a2d736b172daf5ec83e |
| expected/report.json | 6576c615c50571bf2b54fc1f03726dec454b5a93081c0d5c351d7999a8407c19 |
| verified generated report | 30856e8c5e6ed518398978054e6daf7bb812f6c697ad40060a72944a8b266397 |

The generated report and expected JSON have different formatting; comparison parses their values,
while each artifact hash checks its actual bytes. The build report also fingerprints all fixture files
and executable/configuration inputs as a version bundle.

## Scenario ledger

| Scenario | Observation and evidence | Result / limit |
| --- | --- | --- |
| Normal task | 1/1 report independently verified with three source IDs; actual transcript | Offline pass, scripted worker |
| Duplicate trigger | Same event reused; worker invocation count stays 1 | Offline pass in one database |
| Restart after result | Saved-result demo plus real child process exit/reopen test; 0 extra launches | Offline pass; not host reboot proof |
| Host offline | No scheduler supplied; pending state is durable between explicit ticks | Power/reboot behavior unavailable |
| Missing required source | 1/1 scenario blocked, 0 launches; criterion unavailable | Failure-handling pass; task incomplete |
| External text override | Fixed injection passed only as source bytes; no new actions | Fixture pass; model resistance unmeasured |
| Approval for old version | No executable approval contract; source/task hashes checked | External approval integration unavailable |
| Replayed/expired approval | No inbound approval endpoint or action adapter | Unavailable; queue dedup is not approval auth |
| Lost external-write response | No business-write adapter | Unavailable; notifier unknown attempts held in offline tests |
| Subscription exhausted | Injected quota and unknown-login failures each block with no retry/fallback | Offline handling pass; actual account quota unavailable |
| Ordinary success | Noop disabled by default; explicit console preview is deduplicated | Offline pass; no phone receipt |
| Material decision | Blocked state and safe outbox reference retained | Offline pass; real owner reply/resumption unavailable |
| Wrong sender/device | No inbound phone endpoint; no public sender-verification implementation | Unavailable |
| Pause/cancel | Pause survives reopen and stops new stages; timeout blocks late completion | Offline pass; running side effects are not cancelled by pause |

The failure driver checks 10/10 expected blocked outcomes. Missing sources, held projects, artifact,
source and policy tamper, interruption, malformed/contradictory checks, quota and unknown auth remain
failures of their underlying tasks. They never become successful work because the demonstration
expected them. Separate tests cover receipt tamper, owner conflicts, late timeout, read-only status,
quiet hours, daily caps, uncertain notifications, credential filtering and POSIX process-tree cleanup.

## Unknowns and reproduction

Run `npm ci`, `npm run demo`, `npm run demo:failures`, and `npm test` on Node 24+. No runtime packages,
provider calls or network are needed. The exact captured invocations are in the build report.

No live model, CLI account, actual macOS notification, device receipt, phone instruction loop, Windows
process cleanup, scheduler, power recovery, hosted CI or customer/production use was verified.
Configured sandbox flags are not evidence of current CLI integration behavior. Usage remains null
for scripted work; no costs, quota balance, savings or real-use success rate was measured.
