import {
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

// A local slot instead of a primitive-library one so every part built on it
// exists in exactly one flavor-neutral copy: Radix's Slot would leak into the
// Base UI flavor, and Base UI's useRender the other way around. One
// substitution mechanism only: `render={<Link/>}`.

type SlotProps = {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
} & Record<string, unknown>;

/** Resolves the element to clone — the caller's `render`, if any — and the
 *  content that should render inside it. */
export function resolveSlotTemplate(
  render: ReactElement | undefined,
  children: ReactNode,
): { template: ReactElement<SlotProps> | null; content: ReactNode } {
  return render && isValidElement(render)
    ? { template: render as ReactElement<SlotProps>, content: children }
    : { template: null, content: children };
}

/** Renders `content` into the template element (merging class/style/handlers,
 *  composing refs) or into the default tag when there is no template. */
export function slotElement(
  template: ReactElement<SlotProps> | null,
  DefaultTag: ElementType,
  props: SlotProps & { ref?: Ref<HTMLElement> },
  content: ReactNode,
): ReactElement {
  if (!template) {
    const Tag = DefaultTag as ElementType;
    return <Tag {...props}>{content}</Tag>;
  }
  const templateProps = template.props;
  const merged: SlotProps & { ref?: Ref<HTMLElement> } = {
    ...props,
    ...templateProps,
    className: cn(props.className, templateProps.className),
    style: { ...props.style, ...(templateProps.style as CSSProperties | undefined) },
  };
  // Chain duplicated event handlers, template's first (it owns the element).
  for (const key of Object.keys(props)) {
    if (!/^on[A-Z]/.test(key)) continue;
    const ours = props[key];
    const theirs = templateProps[key];
    if (typeof ours === 'function' && typeof theirs === 'function') {
      merged[key] = (...args: unknown[]) => {
        (theirs as (...a: unknown[]) => void)(...args);
        (ours as (...a: unknown[]) => void)(...args);
      };
    }
  }
  // React 19 hands `ref` down as an ordinary prop, so the template's own ref
  // is on its props — no `element.ref` back door needed.
  merged.ref = mergeRefs(props.ref, (templateProps as { ref?: Ref<HTMLElement> }).ref);
  return cloneElement(template, merged, content);
}
