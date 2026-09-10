---
status: accepted
---

# Offer search-by-meaning setup once, not once per folder

Setting up search by meaning was offered per folder, and a decline was stored
per folder. `main` deleted both accessors of that folder-scoped skip and
replaced the model: the offer appears once, at the first folder activation,
and a completed or declined choice is remembered across every later folder and
relaunch. The replacement adopts the new model.

## Why this is a decision and not a port

The stored shape changes. A per-folder boolean becomes one application-level
preference, so the two models cannot both be true and there is no correct
automatic translation from a set of per-folder skips into a single answer.
Task 63 already merged the server side; this record fixes what the renderer
implements on top of it.

It also rewrites a journey. J01's primary flow no longer carries a deliberate
AI Index step during onboarding, and the first-value sequence now reaches the
workspace before the offer appears at all.

## The model

The offer is presented once, at the first folder activation, and never again
after the user completes or declines it. Declining costs no local
functionality and never blocks Wiki Pages from being built. Three manual
routes back remain: the By meaning search mode, a persistent Files-panel
action, and Settings.

A stored folder-scoped skip from the previous model is not migrated. It is
ignored, and the user sees the invitation once on the next first activation.
Silently inferring a global decline from one folder's skip would answer a
question the user was never asked at that scope.

## Consequences

Onboarding stops being able to gate first value behind a retrieval choice,
which is the point. The cost is that a user who declined early has no
contextual re-prompt later; the three manual routes are the whole recovery,
so they must stay discoverable rather than buried in Settings.

Task 66 implements this and updates J01 and its coverage row in the same
change.
