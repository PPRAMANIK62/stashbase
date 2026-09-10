/** What either window shows when its preload bridge is missing: the page
 *  cannot reach the desktop, so it says so instead of rendering a shell that
 *  would fail on its first call. */
export function StartupFailure() {
  return (
    <main className="flex h-svh items-center justify-center bg-surface-1 p-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-title font-semibold">StashBase could not start</h1>
        <p className="mt-2 text-body text-muted-foreground">
          The desktop connection is unavailable. Restart StashBase, or when running from source,
          start the app with <code className="font-mono text-foreground">pnpm dev</code>.
        </p>
      </div>
    </main>
  );
}
