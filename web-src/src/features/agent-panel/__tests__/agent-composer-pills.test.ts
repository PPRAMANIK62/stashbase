/**
 * The composer bar's pill menus — model, mode, and effort — asserted
 * through what they render once OPENED.
 *
 * Each setting is one pill over one menu: mode and effort are independent
 * session state, and folding effort into the mode popup produced a
 * two-headed panel whose trigger had to name both.
 *
 * The pills are the panel's only always-visible session controls, and the
 * popup behind each one is the first thing that renders when a pill is
 * clicked. `MenuGroupLabel` registers itself as its group's accessible
 * name through the group's context and THROWS when there is no group
 * around it, so a heading rendered as the group's sibling turns a click on
 * a pill into a thrown render — which the chat pane's error boundary
 * catches, replacing the whole session with "Could not open chat session."
 * These tests open each menu and read the group back.
 */
import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { withDom, type DomHarness } from '@/common/__tests__/renderHarness';
import { EffortMenu, ModeMenu, ModelMenu } from '@/features/agent-panel/components/ComposerPills';

async function open(dom: DomHarness, trigger: HTMLElement): Promise<void> {
  await dom.fire(trigger, new MouseEvent('click', { bubbles: true, cancelable: true }));
  await dom.flush();
}

/** The accessible name a `role="group"` takes from its own label element. */
function groupName(group: HTMLElement): string | null {
  const labelledBy = group.getAttribute('aria-labelledby');
  return labelledBy ? (document.getElementById(labelledBy)?.textContent ?? null) : null;
}

const model = {
  show: true,
  selected: undefined,
  active: undefined,
  models: [{ id: 'sonnet', label: 'Sonnet', description: 'Fast' }],
  locked: false,
  lockReason: null,
  notice: null,
  resumedSession: false,
  onSet: () => {},
};

test('the Model pill opens a labelled radio group instead of throwing on its heading', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelMenu, { model, disabled: false }));
    const trigger = dom.byLabel('Model: Default')[0];
    assert.ok(trigger, 'the pill renders its control-naming trigger');

    await open(dom, trigger);

    const group = dom.byRole('group')[0];
    assert.ok(group, 'the popup renders the radio group');
    assert.equal(groupName(group), 'Model', 'the heading names the group from inside it');

    // Default plus every advertised model, each its own radio row.
    const rows = dom.byRole('menuitemradio');
    assert.deepEqual(rows.map((row) => row.textContent?.startsWith('Default') ?? false), [true, false]);
  });
});

test('the Mode pill opens a labelled radio group for the permission modes', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModeMenu, {
      mode: { show: true, value: 'default' as const, onSet: () => {} },
      disabled: false,
    }));
    const trigger = dom.query('[data-slot="menu-trigger"]');
    assert.ok(trigger, 'the pill renders its trigger');

    await open(dom, trigger);

    const group = dom.byRole('group')[0];
    assert.ok(group, 'the popup renders the radio group');
    assert.equal(groupName(group), 'Mode');
    assert.equal(dom.byRole('menuitemradio').length, 4, 'one row per permission mode');
  });
});

test('effort is its own pill and its own menu, not a second list under Mode', async () => {
  await withDom(async (dom) => {
    // Mode alone: the popup holds exactly one group, and the trigger names
    // the mode without a second value appended to it.
    await dom.render(h(ModeMenu, {
      mode: { show: true, value: 'auto' as const, onSet: () => {} },
      disabled: false,
    }));
    assert.equal(dom.query('[data-slot="menu-trigger"]')?.textContent, 'Auto');
    await open(dom, dom.query('[data-slot="menu-trigger"]')!);
    assert.deepEqual(dom.byRole('group').map(groupName), ['Mode']);
  });

  await withDom(async (dom) => {
    await dom.render(h(EffortMenu, {
      effort: { show: true, level: undefined, inherited: false, locked: false, supported: ['low', 'high'], onSet: () => {} },
      disabled: false,
    }));
    const trigger = dom.byLabel('Reasoning effort: Default')[0];
    assert.ok(trigger, 'effort carries its own control-naming trigger');

    await open(dom, trigger);

    assert.deepEqual(dom.byRole('group').map(groupName), ['Effort']);
    assert.deepEqual(
      dom.byRole('menuitemradio').map((row) => row.textContent),
      ['Default', 'Low', 'High'],
      'the Default row leads, then every level the runtime advertises',
    );
  });
});

test('a locked effort makes its own pill inert rather than opening onto a dimmed list', async () => {
  await withDom(async (dom) => {
    await dom.render(h(EffortMenu, {
      effort: { show: true, level: 'high' as const, inherited: false, locked: true, onSet: () => {} },
      disabled: false,
    }));
    const trigger = dom.byLabel('Reasoning effort: High — fixed for this conversation')[0] as HTMLButtonElement | undefined;
    assert.ok(trigger, 'the trigger says why it cannot be used');
    assert.equal(trigger.disabled, true);

    await open(dom, trigger);
    assert.equal(dom.byRole('menuitemradio').length, 0, 'a locked pill opens nothing');
  });
});
