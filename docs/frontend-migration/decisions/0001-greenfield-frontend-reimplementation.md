---
status: accepted
---

# Treat the frontend migration as a greenfield reimplementation

The replacement covers the complete frontend system and is governed by a new,
mechanically enforced architecture rather than legacy implementation parity.
Legacy code remains available to discover Shipping behavior, while approved
product outcomes and trust requirements remain constraints; frontend-facing
process and persistence Interfaces may be redesigned through explicit,
coordinated decisions when retaining them would compromise the target
architecture. This accepts additional migration and compatibility work to
avoid encoding legacy ownership and dependency mistakes into the replacement.
