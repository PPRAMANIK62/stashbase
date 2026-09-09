/**
 * `@/components/ui/select` — the stable entry for the Select compound.
 *
 * This file is a re-export barrel and nothing else. The implementation is
 * split by part, because one 750-line module held the root, the trigger, the
 * popup, the row and the furniture, and shared none of the popup machinery it
 * had in common with the dropdown:
 *
 *   - `./select-root`    — the root, the open/acknowledge state, and the
 *     option list that resolves the current value to a label;
 *   - `./select-trigger` — the button and its value text;
 *   - `./select-content` — the portalled popup surface;
 *   - `./select-item`    — one option row;
 *   - `./select-parts`   — the group, caption and separator.
 *
 * A barrel is normally a pass-through worth deleting. This one is not: it is
 * the published import path of a vendored kit primitive, and the split behind
 * it is an implementation detail no caller should have to track. Callers keep
 * importing `@/components/ui/select` and get exactly the exports they always
 * did, plus `SelectOption` — the shape of one entry in the required `items`
 * prop, which is how a Select declares its options.
 */

export { Select, type SelectOption } from './select-root';
export { SelectContent } from './select-content';
export { SelectItem } from './select-item';
export { SelectGroup, SelectLabel, SelectSeparator } from './select-parts';
export { SelectTrigger } from './select-trigger';
