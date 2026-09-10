# `lib`

The **installed Fluid registry**, exactly as `shadcn` emits it. Every file at
this root is a support module the registry wrote, listed in `supportFiles` in
`src/fluid-registry.test.ts`; that test fails if a stray lands here, so a
reinstall never has to reconcile local edits against upstream ones.

Nothing local lands at this root. A kit extension only `components/` consumes
goes under `lib/local/`. Product code — application plumbing, product styling,
product utilities — goes under `shared/`, and the kit may reach back into it
only for `shared/utils`.
