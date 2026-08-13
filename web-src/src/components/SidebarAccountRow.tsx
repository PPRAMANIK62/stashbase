import { useRef, useState } from 'react';
import { BugIcon, DiscordIcon, ExternalLinkIcon, SettingsIcon, UserIcon } from '../icons';
import { DISCORD_INVITE_URL, openExternalUrl } from '../lib/externalLink';
import { Menu, type MenuItem } from './Menu';
import { openSettings } from './SettingsModal';
import { Button } from './ui/button';

/**
 * Bottom chrome row of the sidebar (Cursor's account/settings strip
 * position): WHO you are on the left, the app's small utility cluster on
 * the right.
 *
 * **Anonymous is a finished state, not a missing one.** Browsing, editing,
 * preview, and exact text search are local computations and must never be
 * gated behind a remote login, so the app has a working identity before
 * anyone signs in and says so plainly. The row never carries a standing
 * sign-in badge, dot, or index-readiness marker: recommending the hosted
 * path is the first-run setup dialog's job and it happens once, while
 * persistent chrome only ever states facts.
 *
 * Clicking the identity opens a MENU; it never jumps straight into sign-in.
 * Signing in leaves the app for a browser round trip, and an action that
 * takes the user somewhere else does not fire from an unguarded click on
 * what reads as a label — someone clicking a status row is usually asking
 * "what is this", not starting an auth flow. A direct jump also gets the
 * asymmetry backwards, guarding the cheap glance and letting the expensive
 * departure through. And the menu keeps the gesture identical once accounts
 * exist: signing in changes what the menu CONTAINS, never what the row does.
 *
 * Signed out the menu holds sign-in ALONE. A one-item menu is usually a
 * button in costume, but this one carries the thing a direct jump has
 * nowhere to put — what signing in actually buys — which is the whole
 * reason it exists, not a filler second row. AI Index state stays out:
 * `EmbeddingSetupCallout` sits directly above this row and owns that
 * prompt, so a source line here would be two prompts 8px apart, and once a
 * key is configured it would be pure status whose only action is the
 * Settings gear 60px to its right. Signed in, that line earns its place —
 * nothing else on screen reports hosted quota.
 *
 * Settings anchors the row's far-right edge. It loses its text label in the
 * trade, which is the real cost of putting identity on the sidebar's one
 * bottom line — the gear in the bottom-right corner is the near-universal
 * Settings position (Cursor, VS Code, Slack, Linear), it keeps its tooltip,
 * and the command palette still answers "Open Settings". Discord and Report
 * Bug remain adjacent immediately before it as the help/feedback group.
 */
export function SidebarAccountRow() {
  const identityRef = useRef<HTMLButtonElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);

  const items: MenuItem[] = [
    {
      label: 'Sign in to StashBase',
      /* Leading external-link mark, the same one `Open in New Window` uses:
       * a click that hands the user to another surface says so first. Drawn
       * now rather than added with the flow later, so the item never changes
       * shape under someone who has learned it. */
      icon: <ExternalLinkIcon />,
      /* The reason the menu exists. A direct jump has nowhere to say this,
       * and "what do I get" is the actual question of anyone still signed
       * out — not "how do I sign in". Same promise the setup dialog's
       * recommended card makes, in the same words. */
      detail: 'Free monthly AI Index usage',
      /* Dimmed AND marked until the account system ships: either alone
       * reads as the other — a fade with no mark looks broken, a mark with
       * no fade looks clickable. */
      shortcut: 'Coming soon',
      disabled: true,
      onSelect: () => {},
    },
  ];

  return (
    /* Taller than a list row on purpose. This is the sidebar's floor, and
     * the New Chat block caps its top with 8px above / 12px below the same
     * 28px control — a bottom strip clamped to 4px/6px made the panel look
     * like it ran out of room rather than ended. The two caps now breathe
     * within 2px of each other. */
    <div className="flex flex-none items-center gap-1 border-t border-border px-1.5 pt-2 pb-2.5">
      <button
        ref={identityRef}
        type="button"
        /* Hover brightens the TEXT only — no filled row surface. This strip
         * is app chrome pinned under the dock's section bands, not a list
         * row, and a hover pill here read as a fourth selectable item in
         * the stack. */
        className="group/account flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-base text-muted-foreground"
        title="Account"
        aria-haspopup="menu"
        aria-expanded={!!menuAnchor}
        onClick={() => {
          if (menuAnchor) { setMenuAnchor(null); return; }
          const rect = identityRef.current?.getBoundingClientRect();
          if (rect) setMenuAnchor(rect);
        }}
      >
        {/* A real avatar chip, not a resized glyph: the circle is the mark
          * and the person is its CONTENT, which is why the inner glyph runs
          * under the standalone utility cluster — it has to fit inside the
          * identity container. It also has to survive contact with an
          * account: signed in, the same circle carries a monogram, and only
          * a container can do that.
          *
          * The circle OVERFLOWS its layout slot, 22px drawn from a 16px box.
          * At 16px it was the faintest mark in a row of 16px glyphs — the
          * row's own subject reading as its smallest element — but growing
          * the slot would push the label off the dock's shared gutter. So
          * the box stays 16px for layout and the circle bleeds 3px each
          * side into padding that is already empty. 22px is the ceiling
          * that gutter allows: past it the circle closes on the label and
          * the row tightens again, so a larger avatar means giving up the
          * alignment with Library above, not finding more room.
          *
          * Round, alone in a sidebar of rounded-md rows and rounded-xl
          * boxes. The shape is the whole signal — it says "identity" before
          * the label is read, so the row is never mistaken for one more
          * navigable item in the stack above it. */}
        <span className="relative inline-flex size-4 flex-none items-center justify-center">
          <span className="absolute inset-[-3px] rounded-full bg-muted" aria-hidden="true" />
          <UserIcon className="relative size-3.5" />
        </span>
        {/* Lands on the dock's shared 38px label gutter, same as Library,
          * the section headers, and New Chat.
          *
          * `text-placeholder`, a step below the section labels above it, and
          * the existing third text role rather than a new one: this slot
          * holds no user-specific value yet, which is the same thing an
          * empty field's hint says. At secondary weight "Anonymous" reads
          * as a filled-in account name, the exact confusion that role
          * exists to prevent. It also buys the signed-in state its
          * indicator for free — a real name renders at
          * `text-muted-foreground`, so the ink steps up on its own with no
          * dot, badge, or colour spent.
          *
          * Hover (and an open menu) lifts it one step to the resting weight
          * of a real name. That is the row's only affordance, so it has to
          * move under the pointer; the momentary overlap with the signed-in
          * colour costs nothing, since the string still reads "Anonymous"
          * and hover only exists while a pointer sits on it. */}
        <span className={
          'min-w-0 truncate transition-colors '
          + (menuAnchor ? 'text-muted-foreground' : 'text-placeholder group-hover/account:text-muted-foreground')
        }>
          Anonymous
        </span>
      </button>
      {/* Community, Report Bug, Settings — one utility cluster on the row's
        * right end. These sparse, persistent actions use the next optical
        * step above dense section-header controls: 28px targets with 16px
        * glyphs, large enough to read without making the row loose. */}
      {/* Community — the app's only in-product route to a human, so it stays
        * in persistent chrome rather than behind the account menu. */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Join the StashBase Discord"
        title="Join the StashBase Discord"
        className="flex-none text-muted-foreground"
        onClick={() => { openExternalUrl(DISCORD_INVITE_URL); }}
      >
        <DiscordIcon className="size-4" />
      </Button>
      {/* Report Bug — PLACEHOLDER: disabled and dimmed until the report flow
        * exists; only then does it get a click handler and hover states. */}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label="Report a bug (coming soon)"
        title="Report a bug (coming soon)"
        className="flex-none text-muted-foreground"
      >
        <BugIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        title="Settings"
        className="flex-none text-muted-foreground"
        onClick={() => { openSettings(); }}
      >
        <SettingsIcon className="size-4" />
      </Button>
      {menuAnchor && (
        /* Anchored to the identity's left edge, under the thing it belongs
          * to — the utility cluster on the right is a different subject.
          * base-ui flips the popup above the row on its own, which is what
          * always happens here: this strip is the last thing in the window.
          * No minWidth: the promise line is longer than the label it
          * explains, so the content already clears the popup's own floor and
          * a number here would only be a second one to keep in sync. */
        <Menu
          anchor={{ rect: menuAnchor, align: 'left' }}
          items={items}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
}
