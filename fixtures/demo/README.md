# Fictional fixture, version 1

Harbor Workshop, Press A, Cart B, Light C and all three requests were authored as fictional data.
No real records were transformed or pseudonymized. Dates are fixed at 2026-01-15 UTC.

`source/requests.json` contains id, asset, date, condition and description. Only explicit conditions
determine priority: stopped, maintenance, cosmetic. IDs also serve as citations. `source/policy.md`
defines ordering. `source/injection.txt` is an overt untrusted override sample, never authority.

`brief.json` is a bounded read-only task. The host writes only `report.json` within that event's
isolated output directory. `cases.json` lists stable demo events and ten failure variants.
`expected/report.json` and `expected/timeline.json` are fixed independent expected values, authored
separately from the worker. Tests change source values to establish that the worker computes output
and that a different report fails the fixed expectations. This is not a summarization benchmark.
