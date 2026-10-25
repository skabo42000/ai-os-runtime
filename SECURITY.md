# Security and local execution

This is a local portfolio runtime, not a multi-user security boundary or an exposed service.
Use fictional data first. Treat providers and installed adapters as trusted executable code.
Read-only source contracts and CLI sandbox flags do not isolate a malicious local user or
prove that an arbitrary provider cannot read unrelated host files. Do not expose the database,
output folder or CLI to an untrusted caller. No HTTP listener or inbound command port is supplied.

Never include credentials or private messages in task inputs or public reports. The optional CLI
manages its own secure login; this runtime does not open credential stores. Provider raw output
may contain sensitive data and stays in local ignored output. Safe demo exports use placeholders,
fixed fictional records, finite notification states and opaque references. An ignored file alone
does not make a screenshot or shared archive safe.

SQLite state must be local and outside synced storage. One database owns its own lease and event
namespace; separate databases do not share ownership. A valid saved result can be reconciled;
unknown work is held. No approval, external-write or blanket replay-safety guarantee is offered.

Before sharing, inspect the exact source inventory and rerun your own secret and privacy scan (for example gitleaks) on the exact tree you will publish.
Regex scans miss unknown formats and encoded data. No maintained secret scanner was available
in the build environment. Hosted CI and history scans have not run because no commit or publication
was requested.

There is no designated private reporting endpoint in this unpublished tree. Do not post sensitive
details publicly. Use a repository host's private vulnerability reporting only if its maintainer
has enabled it; otherwise request a private channel without including the vulnerable data.
