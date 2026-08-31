---
status: accepted
---

# Sandbox the renderer and isolate the replacement build

Every replacement window uses Chromium sandboxing, context isolation, a
privileged custom application origin, strict CSP, and a bundled typed preload
that exposes only capability-specific methods. Main validates sender, frame,
origin, capability, and Zod payload while owning authorization identity.
`renderer` has independent build, type, test, styling, and boundary
configuration and shares no legacy frontend implementation. Dependencies are
exact, responsibility-owned, and reviewed; shadcn source is first-party and no
runtime code or assets come from registries or CDNs. This accepts coordinated
Electron and build work to reduce privilege and prevent migration convenience
from contaminating the new architecture.
