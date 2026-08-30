export default {
  defaultPackage: './renderer',
  run: {
    // CI may restore pnpm's content-addressed store, but task outputs stay fresh.
    cache: false,
  },
};
