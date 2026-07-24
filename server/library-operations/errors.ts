/**
 * Transport-neutral failure from a Library Operation.
 *
 * Express turns this into its established JSON envelope; MCP adapters turn it
 * into a tool error. Keeping the semantic status/code together avoids making
 * each adapter rediscover library access and readiness failures.
 */
export class LibraryOperationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'LibraryOperationError';
  }
}

export function libraryOperationError(message: string, status = 400, code?: string): LibraryOperationError {
  return new LibraryOperationError(message, status, code);
}
