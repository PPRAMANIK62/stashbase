# Gallery

The shop of ready-made Wikis: how its index is published and read, how a copy
becomes an ordinary Library folder, and where its reach outside the machine is
bounded. Product intent is
[Workspace](../design-docs/design/workspace.md) and
[Agent Panel](../design-docs/design/agent-panel.md);
[J13](../design-docs/user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery)
is the journey.

The Gallery is a feature slice of its own. It is not part of the Agent Panel,
and no Agent module may import it. [Agent Panel](agent-panel.md) owns only the
seam where the two meet.

## Trust boundary

The Gallery is the one product surface that reads a curated host on the public
internet. Two rules bound that reach and they are the reason this contract
exists.

The renderer never talks to the gallery host. Its CSP pins `connect-src` and
`img-src` to `'self'`, so both the published index and every screenshot cross
through the daemon. That is the design rather than a workaround: the proxy is
where the reach is bounded, and the renderer's own network posture stays
unchanged.

The image route is not a general proxy. It serves a request only when the
source URL starts with one of the gallery's own published prefixes, and answers
400 otherwise, so it cannot be bent into an open relay by a caller that reaches
the daemon.

Reading the shelf costs the user nothing and reveals nothing. No folder needs
to be open, no account signed in, and no Agent runtime installed. The Gallery is
read-only toward the user's data: it never places or sends composer text, and
its one prompt affordance is an explicit copy to the clipboard.

## The index contract

The whole service contract is one published JSON document. `schemaVersion` is a
literal rather than a minimum, so a shape this build does not understand fails
the parse whole. Entry objects strip unknown fields, because the index is
additive-only and one published by a newer gallery must still read here.

An entry whose own required fields are missing is refused rather than dropped.
One unusable entry means the publication is wrong, and quietly rendering the
rest would hide that from everyone, the publisher included.

Failure has one outcome, not three. Unreachable, malformed, and an unreadable
schema version all resolve to the bundled snapshot, so the Port answers `null`
for the whole class. Half an index is never an answer. The route reinforces
this by answering total upstream failure with a 200 envelope carrying an
unsupported schema version rather than a 5xx, because the renderer's behavior is
identical either way and a non-OK response would stamp a console error into
every offline session.

The bundled snapshot is a shipped copy of the index. It renders on the first
frame, so the shop never shows a spinner or an empty state, and it is the whole
answer offline. It is not seeded into the query cache, because a fresh cache
entry would mean the published index is never asked for.

## One shop, two frames

The shop's entire state is an open flag and a selected entry. Both entrances
write that same pair, so there is one index and one copy in flight per window
rather than a shop per surface.

A bare window derives the band on its welcome screen, which is what a bare
window is: the workspace layout hides the panes and shows the welcome screen
whenever no folder is open. A folder window reaches the same shop as an overlay
from its sidebar row. A band card opens that entry's page directly; the sidebar
row opens the shelf.

The welcome screen knows nothing about the Gallery. `no-sibling-feature-imports`
forbids one feature slice from importing another, so the band arrives as a slot
that composition fills, and the screen renders correctly without one.

## Taking a copy

A copy is not a Gallery mechanism. It is the Library's ordinary public
repository import into the folder home, followed by a window of its own, and
composition wires both. The destination and the name rules belong to the
Library; the window belongs to the desktop. The Port's `copy` answers the
published path so a caller can name what it made.

The entry's own name is used when the Library's naming rule accepts it, since
that is what the reader just read on the card, then the repository's derived
segment, then the entry name again as a last resort so the server owns the
refusal rather than the shop inventing a name. That order is `copyFolderName`
in the Gallery's domain rather than a condition at the composition root,
because it shipped inverted there: the Library's validator answers null for a
usable name, so a truthy answer was read as the name and every valid entry name
was discarded.

Two clicks cannot race one download into two copies: a copy in flight latches
until it settles.

A failed copy leaves the Library unchanged and reports one visible sentence on
the detail page, and the entry can be retried. The Gallery does not map the
Library's refusal ladder a second time; it names what did not happen and carries
the sentence it was given.

A copy the Library made but no window could show is still a folder in the
switcher, and the failure says exactly that rather than implying nothing
happened.

The window a copy opens in lands on the copy. Main creates the window for that
folder and the renderer claims it once, so the new window shows the copied
folder rather than the welcome screen.

The shop stays put when a copy succeeds. The reader is still in the shop,
looking at the next entry.

## Implementation Map

| Role | Stable entry points |
|---|---|
| Wire contract | `shared/protocols/http/gallery.ts`, the published index schema and its version gate |
| Daemon proxy | `server/routes/gallery.ts`, the index route with its short cache and the prefix-restricted image route |
| Feature surface | `renderer/src/features/gallery/public.ts` |
| Entry shape | `renderer/src/features/gallery/domain/entry.ts`, where an unpublished field is explicitly absent rather than missing |
| Copy naming rule | `copyFolderName` in `renderer/src/features/gallery/domain/entry.ts` |
| Bundled index | `renderer/src/features/gallery/domain/snapshot.ts` |
| Port | `renderer/src/features/gallery/application/ports.ts` |
| Index transport | `renderer/src/features/gallery/infrastructure/gallery-api.ts`, which also rewrites published screenshot URLs onto the proxy |
| Index state | `renderer/src/features/gallery/hooks/use-gallery.ts` |
| Copy state | `renderer/src/features/gallery/hooks/use-gallery-copy.ts` |
| Surfaces | `renderer/src/features/gallery/ui/shop.tsx` for the shelf, `renderer/src/features/gallery/ui/overlay.tsx` for the framed shop, `renderer/src/features/gallery/ui/detail.tsx` for one entry |
| Composition | `renderer/src/app/composition/gallery/use-gallery-shop.tsx`, the one place both entrances are wired |
| Copy wiring | the `gallery` block in `renderer/src/app/dependencies.ts`, over the Library's import and the folder-window channel |
| New-window channel | `shared/protocols/electron/library.ts` |

## Validation

```bash
pnpm test:protocols
pnpm test:library-files
pnpm test:renderer
```

`pnpm test:protocols` proves the index schema: the whole-parse-or-whole-fallback
rule, additive stripping, and refusal of an entry missing a required field.

`pnpm test:library-files` runs `server/routes/gallery.test.ts`, which proves
upstream proxying with its cache, the offline unsupported-schema envelope, and
the image route refusing a non-gallery host.

`pnpm test:renderer` runs the renderer half: the entry domain and its snapshot
enrichment, the index adapter's fallback and screenshot rewriting, the two
hooks including the copy latch, the story accessibility pass over the overlay,
and the composition test that proves both entrances write one shop.

A driven runtime pass is recorded in
[Journey Coverage](journey-coverage.md#j13-gallery-download).

## Known Gaps

- The index host carries a transition fallback to an older mirror while the
  primary asset host settles. Both prefixes are accepted by the image route, so
  the trust surface is two hosts rather than one until the fallback is removed.
- `Make a copy` has no driven runtime pass. It downloads a real public
  repository and registers a real folder, so it is proved by the Library's
  import evidence plus the copy latch rather than by driving it.
