export function App() {
  return (
    <main className="flex min-h-screen bg-background text-foreground" data-foundation="renderer">
      <div className="w-1.5 shrink-0 bg-primary" aria-hidden="true" />
      <section className="m-auto w-full max-w-2xl px-6" aria-labelledby="foundation-title">
        <p className="mb-4 font-mono text-caption tracking-wide text-muted-foreground uppercase">
          Replacement renderer · foundation active
        </p>
        <h1 id="foundation-title" className="font-heading text-hero font-semibold tracking-tight">
          StashBase
        </h1>
        <p className="mt-6 max-w-xl text-heading leading-reading text-muted-foreground">
          The new renderer is isolated, buildable, and ready for its first product slice.
        </p>
      </section>
    </main>
  );
}
