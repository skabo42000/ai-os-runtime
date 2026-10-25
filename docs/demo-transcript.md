# Executed fictional demo transcript

October 25, 2026; Node 24.21.0. Captured command output, including measured elapsed time.
The restricted build sandbox used explicit disposable fixture scratch space.
Actual temporary host paths are never printed; the driver prints placeholders itself.

```sh
AI_OS_DEMO_TMP=.verification npm run demo
```

```text
> ai-os-runtime@0.1.0 demo
> node scripts/demo.mjs --verify

Fictional Harbor Workshop inputs; fixture worker = scripted; real SQLite queue and independent file verification.
No model/network calls. Notification delivery is disabled or a local console preview.
Disposable sandbox verification: synced scratch state permitted for fixtures only; live providers and OS notifications refused.
workspace=<temporary workspace>; state=<temporary local state>; output=<temporary output>
Queue: queued -> running -> verifying -> prepared
Verified artifact: <temporary output>/<event hash>/report.json; SHA-256=30856e8c5e6ed518398978054e6daf7bb812f6c697ad40060a72944a8b266397
high: Press A; source_id=REQ-001
normal: Cart B; source_id=REQ-002
low: Light C; source_id=REQ-003
Host verified: Exactly three requests in priority order with source IDs
Host verified: Report matches the independent expected fixture
Duplicate suppressed; reopened SQLite and reverified evidence; worker invocations=1, extra launches=0.
Notification preview: prepared; reference=b72164edf4cf; no external delivery
Restart after saved worker result: running -> verifying -> prepared; extra worker launches=0.
Injection sample remained source data; no outbound action or permission change.
Demo assertions passed; controlled failure scenarios=0; elapsed_ms=122.
```

```sh
AI_OS_DEMO_TMP=.verification npm run demo:failures
```

```text
> ai-os-runtime@0.1.0 demo:failures
> node scripts/demo.mjs --verify --failures

Fictional Harbor Workshop inputs; fixture worker = scripted; real SQLite queue and independent file verification.
No model/network calls. Notification delivery is disabled or a local console preview.
Disposable sandbox verification: synced scratch state permitted for fixtures only; live providers and OS notifications refused.
workspace=<temporary workspace>; state=<temporary local state>; output=<temporary output>
Queue: queued -> running -> verifying -> prepared
Verified artifact: <temporary output>/<event hash>/report.json; SHA-256=30856e8c5e6ed518398978054e6daf7bb812f6c697ad40060a72944a8b266397
high: Press A; source_id=REQ-001
normal: Cart B; source_id=REQ-002
low: Light C; source_id=REQ-003
Host verified: Exactly three requests in priority order with source IDs
Host verified: Report matches the independent expected fixture
Duplicate suppressed; reopened SQLite and reverified evidence; worker invocations=1, extra launches=0.
Notification preview: prepared; reference=b72164edf4cf; no external delivery
Restart after saved worker result: running -> verifying -> prepared; extra worker launches=0.
Controlled failure missing-source: blocked; task criteria=unavailable; not passed; launches=0; no automatic retry.
Controlled failure held-project: blocked; task criteria=unavailable; not passed; launches=0; no automatic retry.
Controlled failure modified-artifact: blocked; task criteria=unavailable; not passed; launches=1; no automatic retry.
Controlled failure interrupted-worker: blocked; task criteria=unavailable; not passed; launches=0; no automatic retry.
Controlled failure source-tamper: blocked; task criteria=unavailable; not passed; launches=0; no automatic retry.
Controlled failure policy-tamper: blocked; task criteria=unavailable; not passed; launches=0; no automatic retry.
Controlled failure malformed-check: blocked; task criteria=unavailable; not passed; launches=1; no automatic retry.
Controlled failure contradictory-check: blocked; task criteria=unavailable; not passed; launches=1; no automatic retry.
Controlled failure quota: blocked; task criteria=unavailable; not passed; launches=1; no automatic retry.
Controlled failure unknown-auth: blocked; task criteria=unavailable; not passed; launches=1; no automatic retry.
Injection sample remained source data; no outbound action or permission change.
Demo assertions passed; controlled failure scenarios=10; elapsed_ms=373.
```
