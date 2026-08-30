---
status: accepted
---

# Isolate features behind scoped runtimes and consumer-owned ports

Replacement features never import one another: app composition wires their
public capabilities and named app workflows own cross-feature sequencing and
recovery. Each stateful feature exposes an explicitly constructed and disposed
runtime for its real lifetime, while the consuming application layer owns its
external ports and platform mechanisms support injected adapters. Repository
wire protocols use shared executable schemas with inferred wire types. This
adds explicit mapping and composition code in exchange for enforceable feature
independence, deterministic lifecycles, and runtime-safe process boundaries.
