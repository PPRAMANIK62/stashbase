import { MenuCheckboxItem } from '@/common/components/ui/menu-radio';

/**
 * The Chat's Similarity Search policy — one checkable row pinned under the
 * session scope popup's folder list.
 *
 * It lives THERE because scope and retrieval are one question in two
 * halves: scope is what a lookup may reach, this is how it matches. The
 * composer bar was the wrong home for the second half — the bar's width is
 * the docked panel's width, and a setting almost nobody touches was
 * spending more of it than the folder the chat is bound to, while sitting
 * among the model and mode pills that made it look like an Agent setting.
 * It is not one: this changes how StashBase supplies library context, not
 * how the selected runtime behaves.
 *
 * ONE ROW WITH A SWITCH. Every richer spelling was worse: a bar chip spent
 * the composer row's scarcest pixels, a lone magnifier claimed the one
 * thing this cannot mean since text matching keeps working either way, and
 * naming the two modes as rival radio rows turned one feature being on
 * into a choice between two features.
 *
 * The switch is not decoration. The scope rows directly above are a radio
 * list whose selected row wears a check, so a check down here would be the
 * same glyph meaning "the one selected" and "on" in a single popup. A
 * track and a thumb say on/off and nothing else. Semantically the ROW is
 * still one checkbox item — the switch is its indicator, not a second
 * control nested inside a menu item.
 */
export function SimilaritySearchControl({
  enabled,
  availabilityKnown,
  onChange,
}: {
  enabled: boolean;
  availabilityKnown: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <MenuCheckboxItem
      indicator="switch"
      checked={enabled}
      disabled={!availabilityKnown}
      /* Stays open on click: the switch is the feedback, and a popup that
       * vanishes the instant you flip it hides the state you just set. */
      closeOnClick={false}
      /* The row is the product name, so the state it needs a screen reader
       * to hear is `aria-checked`, which the primitive already carries.
       * What that state MEANS is what the description adds. */
      aria-description={enabled
        ? 'Retrieval matches by meaning as well as text.'
        : 'Retrieval matches text only. Prepared PDF and document text stays searchable.'}
      onCheckedChange={onChange}
    >
      {/* No selected-row background: the switch carries the state, and the
        * tinted row above it means "this is the scope you picked". */}
      <span className="min-w-0 flex-1 truncate text-sm">Similarity Search</span>
    </MenuCheckboxItem>
  );
}
