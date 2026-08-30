---
status: accepted
---

# Scope runtimes and share only stable cross-feature contracts

Zustand stores follow window, folder, document, and Agent-session lifetimes,
while each renderer window owns one TanStack Query client with explicit scoped
eviction. Features share only a reviewed identity kernel and a small recovery-
oriented failure vocabulary; Zod wire schemas live in boundary-specific
repository protocol modules. Navigation crosses feature boundaries as typed
intents resolved by app composition, without making a router the owner of
workspace state. This favors explicit disposal, bounded caches, and stable
contracts over global stores and broad shared utility layers.
