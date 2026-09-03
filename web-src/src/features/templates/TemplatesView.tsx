import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { readPreferredAgent } from '@/common/lib/agentPreference';
import { requestTemplate } from '@/common/lib/templateTrigger';
import { ArrowRightIcon } from '@/common/components/icons';
import { cn } from '@/common/lib/utils';
import { TEMPLATES, type Template, type TemplateCategory } from '@/features/templates/templates';
import './templates.css';

/**
 * The Templates gallery — the singleton `kind: 'templates'` tab.
 *
 * A tab, not a modal: picking a template starts an agent run the user will
 * watch in the chat panel beside it, so the gallery must not be a layer
 * that has to close first. Default export for the lazy chunk (MainPane
 * loads it through `lazyWithRetry` like the other rare panes).
 *
 * This surface is deliberately drawn in the MARKETING SITE's print
 * language — hairline-grid cells, mono index tiles, corner-tick frames,
 * square corners — because the same gallery ships on the site
 * (stashbase-web home-page.css is the reference). Everything is spelled
 * through the semantic tokens, so the idiom holds in dark; the square
 * frame is this one surface's voice, not a new app-wide corner step.
 *
 * "Use template" latches the preset prompt, then opens/focuses a blank chat
 * for the preferred agent. The ACTIVE session consumes the latch into an
 * editable composer draft (see templateTrigger for why latch + broadcast);
 * the user remains the party who sends it. With no folder open the actions
 * are disabled: templates are folder activations, the same constraint Build
 * Wiki always had.
 */

const SECTIONS: {
  category: TemplateCategory;
  title: string;
  detail: string;
}[] = [
  {
    category: 'start',
    title: 'Start a project.',
    detail: 'Give a brand-new folder its first pages.',
  },
  {
    category: 'organize',
    title: 'Organize this folder into a wiki.',
    detail: 'Turn the files already here into wiki pages that link back to them.',
  },
];

/** Blank cells that complete the last hairline row at one column count —
 *  the frame never ends mid-row, the way the site's grids never do. */
function fillerCells(columns: number, items: number): number {
  return (columns - (items % columns)) % columns;
}

export default function TemplatesView() {
  const state = useWorkspace();
  const { actions } = useAppActions();
  const folderOpen = Boolean(state.folderPath);

  function useTemplate(template: Template) {
    // Latch for the agent being activated, then open/focus its chat: the
    // session that ends up active for THIS agent consumes and sends.
    const agent = readPreferredAgent();
    requestTemplate(template.prompt, agent);
    actions.activateChatTab(agent);
  }

  return (
    <div className="scrollbar-quiet min-h-0 flex-1 overflow-auto">
      {/* The site's page column (--max), responding to its own width via
        * the container queries in templates.css. */}
      <div className="templates-page mx-auto w-measure-xl px-6 py-10">
        {/* No page-level kicker and no section eyebrows: the tab and the
          * sidebar row already say "Templates", and the headings carry the
          * structure — the mono-print accent lives on the cards instead.
          * Benefit-led headline at the site's display step: sentence case,
          * weight 400, a period. */}
        <h1 className="m-0 text-5xl font-normal tracking-tight text-foreground">
          Start faster with a template.
        </h1>
        <p className="m-0 mt-2 text-base text-muted-foreground">
          {folderOpen
            ? 'Every template drops one editable request into Chat.'
            : 'Open a folder first — templates build its wiki in place.'}
        </p>

        {SECTIONS.map((section, sectionIndex) => {
          const items = TEMPLATES.filter((template) => template.category === section.category);
          return (
            <section key={section.category}>
              {sectionIndex > 0 && (
                /* The site's hatched divider between printed sections. */
                <div aria-hidden className="templates-separator mt-10" />
              )}
              {/* The site's type ladder is deliberately steep — headings
                * clearly outrank body text (48/24/16 on the site maps to
                * 40/30/20 on the chrome ramp here). */}
              <h2 className="mt-10 mb-1 text-4xl font-normal tracking-tight text-foreground">
                {section.title}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">{section.detail}</p>
              {/* The site's resource grid: one hairline frame with corner
                * ticks, cells separated by the 1px grid gap showing the
                * border colour through — dividers, not per-card boxes. */}
              <ul className="templates-frame templates-grid mt-5 grid list-none gap-px bg-border p-0">
                {items.map((template) => {
                  return (
                    <li key={template.id} className="flex min-w-0">
                      {/* Raw button, same reasoning as the setup cards for
                        * search by meaning: the whole CARD is the target —
                        * multi-line, left-aligned, square-cornered, full
                        * opacity when disabled (the header line above
                        * already says why nothing is clickable). `Button`
                        * is a centred single-line -ui-cornered item;
                        * adopting it would start by cancelling display,
                        * height, alignment, wrapping, and corner. */}
                      <button
                        type="button"
                        disabled={!folderOpen}
                        onClick={() => useTemplate(template)}
                        className={cn(
                          'group flex flex-1 flex-col border-0 bg-background p-5 text-left transition-tint',
                          folderOpen ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
                        )}
                      >
                        {/* No index tile: the site numbers STEPS, which
                          * have an order — templates do not, so a count
                          * implied a ranking. The illustration is the
                          * card's anchor. Placeholder art on the site's
                          * dotted ground — a generic wireframe mini-card
                          * stands in until each template gets its real
                          * print-style illustration (see template-visual
                          * in templates.css). */}
                        <span aria-hidden className="template-visual grid h-32 w-full flex-none place-items-center border border-border">
                          <span className="block w-24 border border-border bg-card p-2">
                            <span className="block h-1 w-full bg-border" />
                            <span className="mt-1.5 block h-1 w-2/3 bg-border" />
                            <span className="mt-1.5 block h-1 w-full bg-border" />
                          </span>
                        </span>
                        <span className="mt-5 block text-2xl font-normal tracking-tight text-foreground">
                          {template.name}
                        </span>
                        <span className="mt-2 block flex-1 text-sm leading-relaxed text-muted-foreground">
                          {template.description}
                        </span>
                        <span className="mt-5 flex w-full items-center justify-between gap-3 font-mono text-2xs tracking-[0.12em] text-placeholder uppercase">
                          Use template
                          <ArrowRightIcon className="size-3.5 flex-none text-foreground transition-control group-hover:group-enabled:translate-x-0.5" />
                        </span>
                      </button>
                    </li>
                  );
                })}
                {/* Blank paper cells complete the hairline grid's last
                  * row; one set per column count, shown by the container
                  * query that picks the layout. */}
                {Array.from({ length: fillerCells(2, items.length) }, (_, index) => (
                  <li aria-hidden key={`filler-two-${index}`} className="templates-filler-two bg-background" />
                ))}
                {Array.from({ length: fillerCells(3, items.length) }, (_, index) => (
                  <li aria-hidden key={`filler-three-${index}`} className="templates-filler-three bg-background" />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
