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

## Where the choice is stored

The answer is a durable server-side preference, not browser storage. `main`
keeps its flag in `localStorage`, and its own fallback comment concedes that a
hardened WebView can reject the write so "the setup can reappear on a later
launch". A one-time invitation that can silently become a repeat invitation is
not the behavior this decision adopts.

The server already owns the right home. `OnboardingPreferences` in
`shared/preferences.ts` exists to record "which one-time notices a user has
already seen, versioned so a later revision of a notice can show again without
reusing a dismissed flag", and `/api/onboarding` already reads and writes it.
The invitation stores the revision it answered. A later revision of the offer
can therefore show again deliberately, by raising the constant, rather than by
accident.

The replacement renderer uses no browser storage anywhere, so adopting
`localStorage` here would have been its first exception, and for the one kind
of state the architecture already routes through a server-owned port. Writing
the preference validates the request against a registered wire schema; before
this change the route spread an unvalidated body into the durable config.

The cost is a deliberate divergence: a user moving between the legacy renderer
and the replacement sees the invitation once more, because the two read
different stores. `web-src` is inert reference material scheduled for deletion,
so that window closes at cutover.

## How it is presented

The invitation is a non-blocking notice in the strip above the workspace, not a
dialog. This decision's own reasoning is that onboarding must stop gating first
value behind a retrieval choice, and a modal standing between a reader and the
files they just opened is exactly that gate; J01 requires reaching a first
result "without completing unnecessary setup". `main` uses a dialog, and the
replacement deliberately does not.

The strip already carries what the window says about things the reader did not
ask about directly, so the offer joins it rather than adding a third surface.
It sits last, because a refusal of something the reader did try is more urgent
than an offer of something they have not asked for. Taking it up opens the
Settings section that owns the two sources; declining reads as **Not now**.

The offer holds until both the stored answer and the active folder's readiness
have answered. Treating an unknown readiness as "not configured" would show the
invitation for a moment and then withdraw it from a reader who is already set
up.

## Consequences

Onboarding stops being able to gate first value behind a retrieval choice,
which is the point. The cost is that a user who declined early has no
contextual re-prompt later; the three manual routes are the whole recovery,
so they must stay discoverable rather than buried in Settings.

Task 66 implements this and updates J01 and its coverage row in the same
change.
