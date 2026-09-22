/**
 * What inline document revisions are built on, proven against the real
 * Milkdown build rather than a fake of it.
 *
 * The review surface has no journey automation behind it — the Playwright
 * suites were retired — so this file is the project's only deterministic
 * check that the diff engine behaves the way the feature assumes. Each case
 * states one assumption the feature would break silently if upstream changed
 * it: what a two-change proposal renders, which of the commands dirty the
 * buffer, that reading mode still reviews, and the two hazards the domain
 * guards against.
 */
import { CrepeBuilder } from '@milkdown/crepe/builder';
import { diffComponent, diffComponentConfig } from '@milkdown/kit/component/diff';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import {
  acceptAllDiffsCmd,
  acceptDiffChunkCmd,
  clearDiffReviewCmd,
  diff,
  diffConfig,
  diffPluginKey,
  getPendingChanges,
  rejectDiffRangeCmd,
  startDiffReviewCmd,
} from '@milkdown/kit/plugin/diff';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { splitLeadingYamlFrontmatter } from '@/features/documents/domain/markdown';
import { settleMarkdownListener } from '@/test/milkdown';

import { revisionCardFor } from './revision-hover';

const BASE = '# Title\n\nThe first line.\n\nThe second line.\n';
/** One pure deletion and one replacement, so the two changes differ in kind. */
const PROPOSAL = '# Title\n\nThe line.\n\nThe second sentence.\n';

interface Probe {
  accepts(): HTMLButtonElement[];
  changes(): Array<{ fromA: number; toA: number; fromB: number; toB: number }>;
  count(selector: string): number;
  destroy(): Promise<void>;
  editor: CrepeBuilder;
  host: HTMLElement;
  markdown(): string;
  pending(): number;
  rejects(): HTMLButtonElement[];
  reviewing(): boolean;
  run(command: { key: unknown }, payload?: unknown): void;
  updates: string[];
}

const live: Probe[] = [];

afterEach(async () => {
  for (const probe of live.splice(0)) await probe.destroy();
});

async function openProbe(source = BASE): Promise<Probe> {
  const host = document.createElement('div');
  document.body.append(host);
  const editor = new CrepeBuilder({ root: host, defaultValue: source });
  editor.editor
    .config((context) => {
      // Heading ids are stamped into the document by the outline adapter, so a
      // diff that compared them would report every heading as changed.
      context.update(diffConfig.key, (previous) => ({
        ...previous,
        ignoreAttrs: { heading: ['id'] },
      }));
      context.update(diffComponentConfig.key, (previous) => ({
        ...previous,
        customBlockTypes: ['table', 'image-block', 'code_block'],
      }));
    })
    .use(diff)
    .use(diffComponent);
  const updates: string[] = [];
  editor.on((listener) => {
    listener.markdownUpdated((_context, markdown) => updates.push(markdown));
  });
  await editor.create();

  const query = <T extends Element>(selector: string) => host.querySelectorAll<T>(selector); // dom-contract: Milkdown's own diff decoration classes

  const diffState = () =>
    editor.editor.action((context) => diffPluginKey.getState(context.get(editorViewCtx).state));

  const probe: Probe = {
    accepts: () => [...query<HTMLButtonElement>('.milkdown-diff-accept')],
    changes: () => {
      const state = diffState();
      return state ? getPendingChanges(state) : [];
    },
    count: (selector) => query(selector).length,
    destroy: async () => {
      await editor.destroy();
      host.remove();
    },
    editor,
    host,
    markdown: () => editor.getMarkdown(),
    pending: () => {
      const state = diffState();
      return state ? getPendingChanges(state).length : 0;
    },
    rejects: () => [...query<HTMLButtonElement>('.milkdown-diff-reject')],
    reviewing: () => diffState()?.active === true,
    run: (command, payload) =>
      editor.editor.action((context) => {
        context.get(commandsCtx).call(command.key as string, payload);
      }),
    updates,
  };
  live.push(probe);
  return probe;
}

describe('the inline revision engine', () => {
  it('renders one control pair per change, marking deletions and insertions apart', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);

    expect(probe.pending()).toBe(2);
    expect(probe.count('.milkdown-diff-removed')).toBe(2);
    expect(probe.count('.milkdown-diff-added')).toBe(1);
    expect(probe.count('.milkdown-diff-controls')).toBe(2);
    expect(probe.accepts().map((button) => button.textContent)).toEqual(['Accept', 'Accept']);
  });

  it('opens a review without dirtying the buffer', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    await settleMarkdownListener();

    expect(probe.updates).toEqual([]);
    expect(probe.markdown()).toBe(BASE);
  });

  it('reports exactly the accepted text once a change is taken', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    probe.run(acceptDiffChunkCmd, 0);
    await settleMarkdownListener();

    expect(probe.updates).toEqual(['# Title\n\nThe line.\n\nThe second line.\n']);
    expect(probe.markdown()).toBe('# Title\n\nThe line.\n\nThe second line.\n');
  });

  it('leaves the source byte-identical when the whole review is rejected', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    probe.run(clearDiffReviewCmd);
    await settleMarkdownListener();

    expect(probe.updates).toEqual([]);
    expect(probe.markdown()).toBe(BASE);
    expect(probe.reviewing()).toBe(false);
  });

  it('reviews in reading mode, where the document is not editable', async () => {
    const probe = await openProbe();
    probe.editor.setReadonly(true);
    probe.run(startDiffReviewCmd, PROPOSAL);

    expect(probe.count('.milkdown-diff-controls')).toBe(2);
    const accept = probe.accepts()[0];
    if (!accept) throw new Error('Expected an accept control on the first change.');
    accept.click();

    expect(probe.markdown()).toBe('# Title\n\nThe line.\n\nThe second line.\n');
  });

  it('locks the editor when a proposal turns out to contain no changes', async () => {
    // Reachable with a proposal that is not the document's own text: one
    // document has several spellings, and `start` returns before the
    // auto-deactivate every other action falls through to, so the plugin is
    // left active with nothing to resolve. `revision-adapter` ends this;
    // upstream does not.
    const setext = 'Title\n=====\n\nThe first line.\n';
    const probe = await openProbe(setext);
    probe.run(startDiffReviewCmd, '# Title\n\nThe first line.\n');

    expect(probe.reviewing()).toBe(true);
    expect(probe.pending()).toBe(0);
    expect(probe.count('.milkdown-diff-controls')).toBe(0);

    probe.editor.editor.action((context) => {
      const view = context.get(editorViewCtx);
      view.dispatch(view.state.tr.insertText('typed', 3));
    });

    expect(probe.markdown()).toBe('# Title\n\nThe first line.\n');
  });

  it('reviews a document that ends in a list without a phantom deletion of the trailing paragraph', async () => {
    // Crepe keeps an empty paragraph after a final list so the reader can
    // click below it. Markdown cannot spell that paragraph, so an unpatched
    // start read every proposal for such a document as deleting it.
    const listed = '# Title\n\n- one\n- two\n';
    const probe = await openProbe(listed);

    probe.run(startDiffReviewCmd, listed);
    expect(probe.pending()).toBe(0);

    probe.run(clearDiffReviewCmd);
    probe.run(startDiffReviewCmd, '# Heading\n\n- one\n- two\n');
    expect(probe.pending()).toBe(1);
    expect(probe.count('.milkdown-diff-removed')).toBe(1);
  });

  it('parses raw frontmatter into the body, which is why a proposal is stripped first', async () => {
    const withFrontmatter = `---\ntitle: Plan\n---\n\n${PROPOSAL}`;
    const raw = await openProbe();
    raw.run(startDiffReviewCmd, withFrontmatter);
    raw.run(acceptAllDiffsCmd);

    expect(raw.markdown()).toBe(
      '***\n\n## title: Plan\n\n# Title\n\nThe line.\n\nThe second sentence.\n',
    );

    const stripped = await openProbe();
    stripped.run(startDiffReviewCmd, splitLeadingYamlFrontmatter(withFrontmatter).body);
    stripped.run(acceptAllDiffsCmd);

    expect(stripped.markdown()).toBe(PROPOSAL);
  });

  it('answers the card for a change whose controls are not its own next sibling', async () => {
    const probe = await openProbe('# Title\n\n```js\nconst a = 1;\n```\n');
    probe.run(startDiffReviewCmd, '# Title\n\n```js\nconst a = 2;\n```\n');

    // dom-contract: Milkdown's own diff decoration classes
    const removed = probe.host.querySelector<HTMLElement>('.milkdown-diff-removed-block');
    const card = probe.host.querySelector<HTMLElement>('.milkdown-diff-controls');
    if (!removed || !card) throw new Error('the review rendered no block change');

    // A replaced block renders as the old node, the proposed node, then one
    // card, so the card is two elements along. A sibling rule reaches only the
    // first of those, which is why hovering the old block used to offer
    // nothing.
    expect(removed.nextElementSibling).not.toBe(card);
    expect(revisionCardFor(removed)).toBe(card);
    expect(revisionCardFor(card)).toBe(card);
  });

  it('answers the card a part-deleted list holds inside itself', async () => {
    const probe = await openProbe('# Title\n\nLead line.\n\n- first item\n- second item\n');
    probe.run(startDiffReviewCmd, '# Title\n\nLead line.\n\n- first item\n');

    // dom-contract: Milkdown's own diff decoration classes
    const list = probe.host.querySelector<HTMLElement>('.milkdown-diff-removed-block');
    const card = probe.host.querySelector<HTMLElement>('.milkdown-diff-controls');
    if (!list || !card) throw new Error('the review rendered no list change');

    // Deleting one item marks the whole list and renders the card inside it,
    // so nothing after the list leads to it. Hovering any item still has to
    // offer the decision.
    expect(card.parentElement).toBe(list);
    expect(revisionCardFor(list)).toBe(card);
    const item = list.querySelector<HTMLElement>('li');
    if (!item) throw new Error('the list rendered no item');
    expect(revisionCardFor(item)).toBe(card);
  });

  it('offers no card for prose outside a change', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    const heading = probe.host.querySelector<HTMLElement>('h1');
    if (!heading) throw new Error('the document rendered no heading');

    expect(revisionCardFor(heading)).toBeNull();
  });

  it('drops a pure deletion from the review when its own card rejects it', async () => {
    // A deletion occupies no span in the proposal, and upstream keys a
    // rejection by that span alone, so the card's Reject used to leave the
    // deletion pending and the click did nothing visible.
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    const reject = probe.rejects()[0];
    if (!reject) throw new Error('Expected a reject control on the first change.');
    reject.click();
    await settleMarkdownListener();

    expect(probe.pending()).toBe(1);
    expect(probe.count('.milkdown-diff-controls')).toBe(1);
    expect(probe.reviewing()).toBe(true);
    expect(probe.updates).toEqual([]);

    probe.run(acceptAllDiffsCmd);

    expect(probe.markdown()).toBe('# Title\n\nThe first line.\n\nThe second sentence.\n');
  });

  it('keeps the neighbouring deletion open when one of two deleted blocks is rejected', async () => {
    // Two consecutive deleted paragraphs share one point in the proposal, so
    // a rejection keyed by that point alone would take both cards away and
    // leave no way to accept the other.
    const probe = await openProbe('# Title\n\nKeep.\n\nFirst gone.\n\nSecond gone.\n');
    probe.run(startDiffReviewCmd, '# Title\n\nKeep.\n');
    expect(probe.pending()).toBe(2);

    // dom-contract: Milkdown's own diff decoration classes
    const first = probe.host.querySelector<HTMLElement>('.milkdown-diff-removed-block');
    if (!first) throw new Error('the review rendered no block deletion');
    expect(first.textContent).toBe('First gone.');
    const card = revisionCardFor(first);
    const reject = card?.querySelector<HTMLButtonElement>('.milkdown-diff-reject');
    if (!reject) throw new Error('the first deletion offered no reject control');
    reject.click();

    expect(probe.pending()).toBe(1);
    expect(probe.reviewing()).toBe(true);

    probe.run(acceptAllDiffsCmd);

    expect(probe.markdown()).toBe('# Title\n\nKeep.\n\nFirst gone.\n');
  });

  it('rejects a range the way the card dispatches it', async () => {
    const probe = await openProbe();
    probe.run(startDiffReviewCmd, PROPOSAL);
    const [deletion] = probe.changes();
    if (!deletion) throw new Error('the review holds no change');
    probe.run(rejectDiffRangeCmd, {
      fromA: deletion.fromA,
      toA: deletion.toA,
      fromB: deletion.fromB,
      toB: deletion.toB,
    });

    expect(probe.pending()).toBe(1);
  });
});
