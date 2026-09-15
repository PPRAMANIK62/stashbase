# Visual Style

Keep documents and conversation readable; navigation and controls stay secondary.

- Use restrained neutral surfaces, a coherent icon family, and color for meaning
  such as errors, decisions, and changed text.
- Keep controls compact and long-form text comfortable. Use sans for ordinary
  text and monospace for paths/code; documents may retain their own typography.
- Support light/dark, text sizes, keyboard use, visible focus, and reduced motion.
- Motion explains change without taking attention or reading position from work.
- Text a reader may need to copy stays selectable even when its row is a
  control: names, paths, and the commands an agent ran. Navigation chrome —
  menu rows, tabs, tree rows, drag handles — does not select. A drag that
  selects text never also fires the row's action.

Tokens, fonts, geometry, and layout recipes stay in their code owners.
[Engineering Boundaries](../code-review/architecture.md#styling-and-tooling) records
integration constraints; [Journey Coverage](../code-review/journey-coverage.md#cross-cutting-gaps)
records unresolved contrast and composition evidence.
