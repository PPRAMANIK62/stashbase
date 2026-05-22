/**
 * Side-effect module: re-route every console method except
 * `console.error` to stderr.
 *
 * Stdout is reserved for the MCP JSON-RPC framing. A stray `console.log`
 * — anywhere in our code OR in a transitively-imported library — would
 * corrupt the protocol stream and surface to the client as
 * "Unexpected token X in JSON". Our own logger in `server/log.ts` already
 * targets stderr; this is the belt for the suspenders, and catches
 * third-party code we don't control.
 *
 * Imported FIRST from `mcp/server.ts` so the rebinding runs before any
 * other module's evaluation has a chance to log.
 */
for (const m of ['log', 'info', 'warn', 'debug', 'trace'] as const) {
  (console as unknown as Record<string, unknown>)[m] = console.error.bind(console);
}
