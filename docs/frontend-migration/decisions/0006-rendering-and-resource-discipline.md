---
status: accepted
---

# Bound rendering work and heavy renderer resources

Views subscribe through narrow Zustand selectors and TanStack Query
projections, while Suspense is reserved for lazy code and ordinary data refresh
preserves safe content. Only measured or unbounded collections are virtualized,
and heavy viewer resources use bounded version-keyed caches with explicit
disposal. Motion is restrained, interruptible, compositor-friendly, and
reduced-motion aware. Privacy-safe marks and CI observers diagnose long tasks,
frames, and retained resources without collecting user data. This adds
measurement and lifecycle machinery to keep the Electron renderer predictably
responsive under sustained use.
