---
status: accepted
---

# Standardize frontend state, protocols, and architecture enforcement

The replacement uses scoped Zustand vanilla stores for domain-session
runtimes, TanStack Query for cacheable server state, and Zod for shared
repository-owned wire schemas. Its initial capability features are Workspace,
Documents, Retrieval, Preparation, Agent, and Settings; Account remains within
Settings until it earns an independent lifecycle. Dependency-cruiser, Oxlint,
and a project-specific checker enforce dependency and protocol rules in CI,
including for tests. This accepts several focused tools and explicit adapters
to make state ownership, runtime validation, and architecture violations
visible and mechanically enforceable.
