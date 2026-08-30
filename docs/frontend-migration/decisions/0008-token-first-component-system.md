---
status: accepted
---

# Build a token-first Tailwind and shadcn component system

The replacement uses one repository-owned shadcn layer backed exclusively by
Base UI, with native semantic elements for noninteractive structure. Foundation
tokens map to semantic roles, with component tokens allowed only for repeated
primitive anatomy; Tailwind is the component styling mechanism and automated
checks reject raw values and informal escape hatches. Colocated Milkdown
integration overrides are the sole component-specific CSS exception, while
typed custom properties support reviewed runtime geometry. Storybook documents
and tests every shared primitive and other reusable or risky component through
production providers. Phase 0 defines a recognizably StashBase visual identity
rather than inheriting legacy CSS or generic shadcn defaults.
