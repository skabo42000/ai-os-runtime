# Configuration and manual operation

The demo requires no setup. Real local operation requires an explicit nonsecret configuration.
Copy `config/runtime.example.json` to ignored `config/runtime.local.json`. Choose an existing
workspace containing the fictional fixture contract, and absolute **local, unsynced** stateDir and
reportDir outside that workspace and repository. Set projectsFile/policyFile deliberately. Paths
are relative to the selected config file, never to the process working directory. Keep scheduling
false. This release only verifies the maintenance-report contract, including independent expectations.

CLI selection order is `--config FILE`, `AI_OS_CONFIG`, shipped example. The example intentionally
has null state/report settings and fails with a named missing setting. Environment overrides:
`AI_OS_STATE_DIR` (state only), `AI_OS_CODEX_BIN` (optional installed executable), and
`AI_OS_DEMO_TMP` (disposable, fixture-only demo scratch directory). No credentials go in JSON.

For the programmatic API, save and enqueue an explicit task:

```js
import { loadConfig, readJson } from './scripts/project-paths.mjs';
import { WorkController } from './scripts/work-controller.mjs';
const config = loadConfig({ file: 'config/runtime.local.json' });
const controller = new WorkController(config);
try {
  const task = readJson('fixtures/demo/brief.json');
  controller.enqueue('maintenance:review:001', task);
} finally { controller.close(); }
```

```sh
node scripts/check-work-eligibility.mjs harbor --config config/runtime.local.json
node scripts/work-service.mjs --config config/runtime.local.json
node scripts/work-service-status.mjs --config config/runtime.local.json
```

The service advances one queued task per invocation, then flushes the outbox and writes a local
status digest. An empty queue invokes no worker. It does not install or run a scheduler. Status
opens SQLite read-only and labels the last-tick age; cached digest files are not live health proof.

Use `controller.pause(true)` to persist a pause; `controller.pause(false)` explicitly resumes new
stages. Neither clears blocked work. Review its source, receipt and outcome in local state before
creating a new task ID and event. Never edit a saved brief or erase uncertainty to force a retry.
Do not delete a live owner row: live, foreign and unknown owners must be reconciled conservatively.

For optional Codex selection, install and sign into the CLI using its ChatGPT login workflow outside
the demo. Configure an explicit supported model/effort; this build has not verified account access
or current CLI flags. API and unknown authentication are refused, not replaced by a paid route.
For optional Reminders, see [phone limits](../docs/phone.md); no OS call happens by default.
