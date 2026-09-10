---
status: accepted
---

Its Playwright journey and pixel-baseline provisions are superseded by
[Decision 0018](0018-retire-playwright-journey-evidence.md). Everything else
here stands.

# Contain renderer failures and adopt a frontend-specific test foundation

Bootstrap, shell, feature, and lazy-surface boundaries remount only failed
views while preserving healthy runtimes and unsaved buffers; local-server loss
uses bounded reconnect without renderer reload. Protected unsaved-draft crash
recovery is approved Direction pending a separate storage and key-ownership
decision. The replacement adopts Vitest, React Testing Library, user-event,
MSW, axe, focused runtime harnesses, and Playwright at their appropriate
evidence boundaries.
This accepts new tooling and explicit recovery ownership to isolate failures
and test frontend behavior through stable user-facing Interfaces.
