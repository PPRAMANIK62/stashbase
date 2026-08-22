# Deployment incident playbook

When a rollout introduces severe errors, halt the rollout and return traffic to
the last known-good build. Preserve logs before changing anything else. The
incident lead verifies recovery, records the affected version, and schedules a
blameless review after service health is stable.
