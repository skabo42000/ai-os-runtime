# Optional phone and notification routes

The default adapter is noop: it records disabled delivery. Console records a local preview.
Neither sends to a phone. Native provider app access is separate from this service's outbox and
is not configured here. Execution still requires an awake host and an available selected provider.

The optional `scripts/work-reminders.mjs` port uses macOS Reminders through an argument-only
AppleScript call. To select it, set notifications.adapter to reminders in a local configuration,
choose notifications.list and retain a deliberate timezone, quietStart, quietEnd and dailyCap.
It requires macOS, OS consent and the operator's existing device synchronization configuration.
This repository does not pair devices, change consent settings or install launchd.

The core reserves each event/outcome before the effect. It holds during configured quiet hours,
caps daily attempts and keeps pending/failed/unknown state in SQLite across restarts. Failed or
uncertain attempts do not auto-retry. A local OS success is **accepted**, never device-received.
Message text contains an opaque reference and fixed status only, with no task source data.

Offline tests use injected command stubs for accepted, failed and timed-out calls, plus unsupported
OS refusal. No actual Reminders command, iPhone receipt, notification-to-reply loop or same-task
resumption through a phone was tested for the public build. A private implementation informed this
port, but its earlier device observations are not evidence for this public version.

There is no inbound endpoint, sender verification, approval expiry/replay execution or business
action adapter. Those capabilities remain unavailable until separately implemented and observed.
