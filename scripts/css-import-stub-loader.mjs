// Renderer components import their colocated CSS directly (Vite resolves
// and bundles it during dev/build). Node's own module resolution has no
// concept of a `.css` specifier, so `pnpm test:renderer` — which loads
// these component modules straight through `node --test`, not through Vite
// — needs a stand-in for exactly that one extension. This hook resolves
// any `*.css` import to an empty module instead of erroring, without
// touching how Vite processes the same import for the real app.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.css')) {
    return { url: `css-stub:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('css-stub:')) {
    return { format: 'module', source: 'export {};', shortCircuit: true };
  }
  return nextLoad(url, context);
}
