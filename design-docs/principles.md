# Principles

These rules guide product design and code review.

1. **Writing is the purpose.** Features should help people explore ideas,
   develop documents, or understand and control changes. File preparation,
   search, wiki building, and MCP support that work.
2. **Project first, discussion next.** An empty project is a valid starting
   point. People can brainstorm before collecting sources, opening a document,
   building a wiki, or completing background preparation.
3. **File-first.** Ordinary local files are durable content. Previews,
   extracted text, indexes, and application state do not replace them.
4. **Local ownership, explicit services.** Local reading, editing, and keyword
   search remain useful without account sign-in. Agent and embedding requests
   use their configured services with clear credentials and access boundaries.
5. **User-controlled changes.** Exploration does not automatically become an
   accepted document or permission for unrelated edits. File writes follow the
   user's request and the selected permission mode. Review must describe what
   the available comparison can actually establish.
6. **One project scope.** Each folder is its own search namespace. Agents use
   authorized context; empty results or unavailable sources never expand
   access to other projects or the host filesystem.
7. **Bring your own agent.** Included OpenQuill and supported external runtimes
   share the project and file model. The included path must not create a
   separate content store or lock-in.
8. **Derived data stays invisible.** Extracted text, checkpoints, and indexes
   are application-managed. Agent-written documents, including wiki pages,
   are ordinary visible files and follow the same save and access rules.
9. **Keep work continuous.** Discussion and document work remain available
   while unrelated background tasks run. Failures retain user work and offer
   recovery at the failing stage; they do not silently lose drafts or rebind
   conversations.
10. **Earn the complexity.** Prefer one owner for each rule and reuse existing
    project, file, permission, and recovery concepts. Existing code or an old
    requirement alone is not evidence that a feature still belongs.
