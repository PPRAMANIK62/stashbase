import { CheckIcon, ChevronDownIcon } from '@/common/components/icons';
import type { MenuItem } from '@/common/components/Menu';
import {
  MenuItem as MenuPrimitiveItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuSeparator,
  MenuSubmenuRoot,
  MenuSubmenuTrigger,
} from '@/common/components/ui/menu';
import { MenuSectionLabel } from '@/common/components/ui/menu-radio';
import { cn } from '@/common/lib/utils';

/** The one row vocabulary for `MenuItem[]` data — shared by ManagedMenu
 *  (detached-anchor menus) and the attached-trigger compositions that
 *  need CASCADING submenus (which detached roots cannot host; see the
 *  note in ui/menu.tsx). Row anatomy, the current/attention dot slot,
 *  and the checked glyph live here exactly once.
 *
 *  `returnFocusRef` is ManagedMenu's return-focus latch; attached
 *  compositions pass null and let Base UI's default focus return run. */
export function renderMenuItems(
  items: MenuItem[],
  returnFocusRef: { current: boolean } | null,
) {
  return items.map((item, index) => (
              item.separator
                ? <MenuSeparator key={`separator-${index}`} />
                : 'heading' in item && item.heading !== undefined
                ? <MenuSectionLabel key={`heading-${index}`}>{item.heading}</MenuSectionLabel>
                : item.items !== undefined
                ? (
                  /* Cascade: the child popup opens BESIDE this row while
                   * the parent stays up — Base UI owns the hover/arrow
                   * open. Only valid under an ATTACHED-trigger root. */
                  <MenuSubmenuRoot key={`${item.label}-${index}`}>
                    <MenuSubmenuTrigger disabled={item.disabled} title={item.title}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          {item.icon && (
                            <span className="shrink-0 [&_svg]:block [&_svg]:size-4" aria-hidden="true">
                              {item.icon}
                            </span>
                          )}
                          <span className="min-w-0 truncate">{item.label}</span>
                        </span>
                        {item.detail && (
                          <span className={cn('truncate text-xs text-muted-foreground', item.icon && 'pl-6')}>
                            {item.detail}
                          </span>
                        )}
                      </span>
                      <ChevronDownIcon className="ml-auto size-3.5 shrink-0 -rotate-90 text-muted-foreground" aria-hidden="true" />
                    </MenuSubmenuTrigger>
                    <MenuPortal>
                      <MenuPositioner side="right" align="start" sideOffset={2} collisionPadding={6}>
                        <MenuPopup className="flex max-h-overlay-md max-w-overlay-md flex-col">
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-quiet">
                            {renderMenuItems(item.items, returnFocusRef)}
                          </div>
                        </MenuPopup>
                      </MenuPositioner>
                    </MenuPortal>
                  </MenuSubmenuRoot>
                )
                : (
                  <MenuPrimitiveItem
                    key={`${item.label}-${index}`}
                    label={item.label}
                    disabled={item.disabled}
                    title={item.title}
                    /* Rows carrying `checked`/`current` are a single-select
                     * picker (the folder switcher marks exactly one row
                     * current), so they announce as `menuitemradio` with a
                     * real `aria-checked` instead of leaving the visual
                     * mark as the only signal. Spread rather than plain
                     * props: an explicit `role={undefined}` would override
                     * — and erase — the primitive's own `menuitem` role on
                     * command rows. */
                    {...(item.checked !== undefined || item.current !== undefined
                      ? { role: 'menuitemradio' as const, 'aria-checked': item.checked ?? item.current }
                      : undefined)}
                    className={item.danger
                      ? 'text-danger data-highlighted:bg-destructive/10'
                      : undefined}
                    onClick={() => {
                      if (returnFocusRef) returnFocusRef.current = item.returnFocus !== false;
                      item.onSelect();
                    }}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        {item.icon && (
                          <span className="shrink-0 [&_svg]:block [&_svg]:size-4" aria-hidden="true">
                            {item.icon}
                          </span>
                        )}
                        <span className="min-w-0 truncate">{item.label}</span>
                        {/* One dot slot, current wins: an accent dot for
                          * "this is where you are", else the danger dot
                          * for needs-attention — never both, and never a
                          * separate trailing check competing with it. */}
                        {item.current ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-accent"
                            title="Current folder"
                            role="img"
                            aria-label="Current"
                          />
                        ) : item.attention && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-status-danger/80"
                            title="Needs attention"
                            role="img"
                            aria-label="Needs attention"
                          />
                        )}
                      </span>
                      {item.detail && (
                        <span className={cn('truncate text-xs text-muted-foreground', item.icon && 'pl-6')}>
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {item.shortcut && (
                      <span className="shrink-0 text-xs tracking-wider text-muted-foreground">
                        {item.shortcut}
                      </span>
                    )}
                    {item.checked && (
                      <CheckIcon className="ml-auto size-4 shrink-0 text-accent" aria-hidden="true" />
                    )}
                  </MenuPrimitiveItem>
                )
  ));
}
