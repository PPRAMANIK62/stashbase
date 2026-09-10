import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentScopeEnvironment, MentionQuery } from '@/features/agent/domain/context';
import type { AgentSkillCatalog } from '@/features/agent/domain/session';

import { useMentionRows, type MentionRowsOptions, type MentionRowsView } from './context-rows';
import type { MentionEditorHandle } from './mention-editor';

const SCOPED: AgentScopeEnvironment = {
  folderPath: '/Library/Research',
  listing: {
    files: [
      { format: 'md', path: 'notes.md' },
      { format: 'md', path: 'docs/plan.md' },
      { format: 'generic', path: 'archive.zip' },
    ],
    folders: ['docs'],
  },
  openPaths: [],
  readiness: {},
  versions: {},
};

const STOCKED: AgentSkillCatalog = {
  kind: 'available',
  skills: [
    { description: 'Check the draft', id: 'review', label: 'Review' },
    { id: 'summarize', label: 'Summarize' },
  ],
};

function mention(query: string): MentionQuery {
  return { from: 0, kind: 'mention', query };
}

function skill(query: string): MentionQuery {
  return { from: 0, kind: 'skill', query };
}

function setup(overrides: Partial<MentionRowsOptions> = {}) {
  const editor: MentionEditorHandle = {
    focus: vi.fn(),
    insertMention: vi.fn(),
    insertSkill: vi.fn(),
  };
  const editorRef: RefObject<MentionEditorHandle | null> = { current: editor };
  const onRefreshSkills = vi.fn();
  const onSkillChange = vi.fn<MentionRowsOptions['onSkillChange']>();
  const options: MentionRowsOptions = {
    editorRef,
    listboxId: 'box',
    onRefreshSkills,
    onSkillChange,
    scoped: SCOPED,
    skillCatalog: STOCKED,
    ...overrides,
  };
  const { result } = renderHook(() => useMentionRows(options));
  const open = (query: MentionQuery | null) => act(() => result.current.onQueryChange(query));
  const view = (): MentionRowsView => result.current;
  return { editor, onRefreshSkills, onSkillChange, open, view };
}

/** `onPick` answers whether it consumed the pick, which only reads back from
 *  inside `act`. */
function pick(view: () => MentionRowsView, index: number): boolean {
  let taken = false;
  act(() => {
    taken = view().onPick(index);
  });
  return taken;
}

function accept(view: () => MentionRowsView): boolean {
  let taken = false;
  act(() => {
    taken = view().binding.onAccept();
  });
  return taken;
}

afterEach(cleanup);

describe('mention suggestion rows', () => {
  it('stays closed until a query opens it', () => {
    const { view } = setup();

    expect(view().open).toBe(false);
    expect(view().rows).toEqual([]);
    expect(view().label).toBe('Mention a file or folder');
    expect(view().binding.controls).toBeUndefined();
    expect(view().binding.activeOptionId).toBeUndefined();
    expect(view().notice).toBeUndefined();
  });

  it('ranks folder listing entries and names each row by its file', () => {
    const { open, view } = setup();
    open(mention('plan'));

    expect(view().open).toBe(true);
    expect(view().rows.map((row) => ({ key: row.key, primary: row.primary }))).toEqual([
      { key: 'file:docs/plan.md', primary: 'plan.md' },
    ]);
    expect(view().rows[0]?.secondary).toBe('docs/plan.md');
    expect(view().binding.controls).toBe('box');
    expect(view().binding.activeOptionId).toBe('box-option-0');
  });

  it('leaves a root file without a redundant second line and offers folders too', () => {
    const { open, view } = setup();
    open(mention('notes'));
    expect(view().rows[0]?.secondary).toBeUndefined();

    open(mention('docs'));
    expect(view().rows.map((row) => row.key)).toContain('folder:docs');
  });

  it('never suggests a file the library will not index', () => {
    const { open, view } = setup();
    open(mention('archive'));

    expect(view().rows).toEqual([]);
    expect(view().open).toBe(false);
  });

  it('suggests nothing when no window environment describes this folder', () => {
    const { open, view } = setup({ scoped: null });
    open(mention('plan'));

    expect(view().rows).toEqual([]);
    expect(view().open).toBe(false);
  });

  it('asks the editor to chip the picked path and refuses a row that is not there', () => {
    const { editor, open, view } = setup();
    open(mention('plan'));

    expect(pick(view, 0)).toBe(true);
    expect(editor.insertMention).toHaveBeenCalledWith('docs/plan.md');
    expect(pick(view, 9)).toBe(false);
    expect(editor.insertMention).toHaveBeenCalledTimes(1);
  });
});

describe('skill rows', () => {
  it('matches a skill on its label or its description and names the panel', () => {
    const { open, view } = setup();
    open(skill('rev'));
    expect(view().label).toBe('Run a skill');
    expect(view().rows.map((row) => row.primary)).toEqual(['Review']);
    expect(view().rows[0]?.secondary).toBe('Check the draft');

    open(skill('draft'));
    expect(view().rows.map((row) => row.key)).toEqual(['skill:review']);
  });

  it('shows at most eight skills for an open query', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: `s${index}`,
      label: `Skill ${index}`,
    }));
    const { open, view } = setup({ skillCatalog: { kind: 'available', skills: many } });
    open(skill(''));

    expect(view().rows).toHaveLength(8);
  });

  it('arms the picked skill and asks the editor for its token', () => {
    const { editor, onSkillChange, open, view } = setup();
    open(skill('rev'));

    expect(pick(view, 0)).toBe(true);
    expect(editor.insertSkill).toHaveBeenCalledWith('Review');
    expect(onSkillChange).toHaveBeenCalledWith('review');
  });

  it('keeps the panel open with no rows so it can explain the empty list', () => {
    const { open, view } = setup();
    open(skill('zzz'));

    expect(view().rows).toEqual([]);
    expect(view().open).toBe(true);
    expect(view().binding.controls).toBeUndefined();
    expect(accept(view)).toBe(true);
  });
});

describe('empty skill panel notices', () => {
  function renderNotice(overrides: Partial<MentionRowsOptions>) {
    const test = setup(overrides);
    test.open(skill('zzz'));
    render(<>{test.view().notice}</>);
    return test;
  }

  it('says the query matched nothing when the folder does advertise skills', () => {
    renderNotice({});
    expect(screen.getByRole('status').textContent).toBe('No matching skills.');
  });

  it('says the folder advertises no skills at all', () => {
    renderNotice({ skillCatalog: { kind: 'empty' } });
    expect(screen.getByRole('status').textContent).toBe('No skills are available for this folder.');
  });

  it('offers a retry when the runtime could not read the skills', async () => {
    const { onRefreshSkills } = renderNotice({
      skillCatalog: { kind: 'failed', message: 'offline' },
    });

    expect(screen.getByRole('status').textContent).toContain('Could not load skills.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefreshSkills).toHaveBeenCalledTimes(1);
  });

  it('shows no notice while a mention query is open', () => {
    const { open, view } = setup();
    open(mention('plan'));

    expect(view().notice).toBeUndefined();
  });
});

describe('suggestion keyboard binding', () => {
  it('wraps the active row in both directions', () => {
    const { open, view } = setup();
    open(mention('md'));
    const count = view().rows.length;
    expect(count).toBeGreaterThan(1);

    act(() => view().binding.onNavigate(-1));
    expect(view().activeRow).toBe(count - 1);
    act(() => view().binding.onNavigate(1));
    expect(view().activeRow).toBe(0);
  });

  it('ignores navigation and accepts nothing while the list is empty', () => {
    const { open, view } = setup();
    open(mention('nothing-matches'));

    act(() => view().binding.onNavigate(1));
    expect(view().activeRow).toBe(0);
    expect(accept(view)).toBe(false);
  });

  it('takes the active row on accept and points the option id at it', () => {
    const { editor, open, view } = setup();
    open(mention('md'));
    act(() => view().onHover(1));

    expect(view().binding.activeOptionId).toBe('box-option-1');
    expect(accept(view)).toBe(true);
    expect(editor.insertMention).toHaveBeenCalledWith(view().rows[1]?.secondary ?? 'notes.md');
  });

  it('returns to the first row on dismiss and on a closed query', () => {
    const { open, view } = setup();
    open(mention('md'));
    act(() => view().onHover(1));
    act(() => view().binding.onDismiss());
    expect(view().activeRow).toBe(0);

    act(() => view().onHover(1));
    open(null);
    expect(view().open).toBe(false);
    expect(view().activeRow).toBe(0);
  });

  it('clamps the active row when the query narrows the list under it', () => {
    const { open, view } = setup();
    open(mention('md'));
    act(() => view().onHover(1));
    open(mention('plan'));

    expect(view().rows).toHaveLength(1);
    expect(view().activeRow).toBe(0);
    expect(view().binding.activeOptionId).toBe('box-option-0');
  });
});
