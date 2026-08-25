/**
 * The composer bar's session pills — the model/effort settings pill and
 * the mode pill — asserted through what they render once OPENED.
 *
 * The settings pill is one trigger over a two-level menu: a parent row per
 * setting reading back its current value, each opening a single-list
 * flyout. Mode stays its own pill so permission state reads without
 * opening anything.
 *
 * The pills are the panel's only always-visible session controls, and the
 * popup behind each one is the first thing that renders when a pill is
 * clicked. `MenuGroupLabel` registers itself as its group's accessible
 * name through the group's context and THROWS when there is no group
 * around it, so a heading rendered as the group's sibling turns a click on
 * a pill into a thrown render — which the chat pane's error boundary
 * catches, replacing the whole session with "Could not open chat session."
 * These tests open each list and read the group back.
 */
import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { withDom, type DomHarness } from '@/common/__tests__/renderHarness';
import { ModeMenu, ModelEffortMenu } from '@/features/agent-panel/components/ComposerPills';

async function open(dom: DomHarness, trigger: HTMLElement): Promise<void> {
  await dom.fire(trigger, new MouseEvent('click', { bubbles: true, cancelable: true }));
  await dom.flush();
}

/** A flyout opens on hover, ArrowRight, or a non-mouse press. A dispatched
 * mousedown carries no recorded pointer type, so Base UI treats it as the
 * non-mouse press and opens the flyout without hover simulation. */
async function openFlyout(dom: DomHarness, row: HTMLElement): Promise<void> {
  await dom.fire(row, new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await dom.flush();
}

/** The accessible name a `role="group"` takes from its own label element. */
function groupName(group: HTMLElement): string | null {
  const labelledBy = group.getAttribute('aria-labelledby');
  return labelledBy ? (document.getElementById(labelledBy)?.textContent ?? null) : null;
}

function settingRows(dom: DomHarness): HTMLElement[] {
  return dom.queryAll('[data-slot="menu-submenu-trigger"]');
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

const effort = {
  show: true,
  level: undefined,
  inherited: false,
  locked: false,
  supported: ['low', 'high'],
  onSet: () => {},
};

test('the settings pill opens onto one value row per setting, lists behind flyouts', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, { model, effort, disabled: false }));
    const trigger = dom.query('[data-slot="menu-trigger"]');
    assert.ok(trigger, 'the pill renders its trigger');
    assert.equal(trigger.textContent, 'Model: Default');

    await open(dom, trigger);

    const rows = settingRows(dom);
    assert.deepEqual(
      rows.map((row) => row.textContent),
      ['ModelDefault', 'EffortDefault'],
      'each parent row names its setting and reads back the current value',
    );
    assert.equal(dom.byRole('group').length, 0, 'no list renders until its flyout opens');
  });
});

test('the trigger names the model and appends only an explicit effort override', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, {
      model: { ...model, selected: 'sonnet' },
      effort: { ...effort, level: 'high' as const },
      disabled: false,
    }));
    assert.equal(dom.query('[data-slot="menu-trigger"]')?.textContent, 'Sonnet · High');
  });

  await withDom(async (dom) => {
    // Inherited effort is the resumed session's own default: it reads on
    // the menu's Default row, not on the bar.
    await dom.render(h(ModelEffortMenu, {
      model: { ...model, selected: 'sonnet' },
      effort: { ...effort, inherited: true },
      disabled: false,
    }));
    assert.equal(dom.query('[data-slot="menu-trigger"]')?.textContent, 'Sonnet');
  });
});

test('the Model flyout is a labelled radio group with the Default row leading', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, { model, effort, disabled: false }));
    await open(dom, dom.query('[data-slot="menu-trigger"]')!);

    await openFlyout(dom, settingRows(dom)[0]);

    const group = dom.byRole('group')[0];
    assert.ok(group, 'the flyout renders the radio group');
    assert.equal(groupName(group), 'Model', 'the heading names the group from inside it');
    const rows = dom.byRole('menuitemradio');
    assert.deepEqual(rows.map((row) => row.textContent?.startsWith('Default') ?? false), [true, false]);
  });
});

test('the Effort flyout leads with Default, then every advertised level', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, { model, effort, disabled: false }));
    await open(dom, dom.query('[data-slot="menu-trigger"]')!);

    await openFlyout(dom, settingRows(dom)[1]);

    assert.deepEqual(dom.byRole('group').map(groupName), ['Effort']);
    assert.deepEqual(
      dom.byRole('menuitemradio').map((row) => row.textContent),
      ['Default', 'Low', 'High'],
      'the Default row leads, then every level the runtime advertises',
    );
  });
});

test('a pinned model dims its own row while effort stays adjustable', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, {
      model: { ...model, locked: true, lockReason: 'fixed for this conversation' as const },
      effort,
      disabled: false,
    }));
    const trigger = dom.query('[data-slot="menu-trigger"]') as HTMLButtonElement;
    assert.equal(trigger.disabled, false, 'one pinned setting does not close the whole pill');

    await open(dom, trigger);

    const [modelRow, effortRow] = settingRows(dom);
    assert.ok(modelRow.matches('[data-disabled], [aria-disabled="true"]'), 'the pinned row goes inert');
    assert.ok(modelRow.getAttribute('title')?.includes('fixed for this conversation'), 'and says why');
    assert.ok(!effortRow.matches('[data-disabled], [aria-disabled="true"]'), 'the other row stays live');

    await openFlyout(dom, effortRow);
    assert.deepEqual(dom.byRole('group').map(groupName), ['Effort']);
  });
});

test('the pill itself goes inert only when every setting behind it is pinned', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, {
      model: { ...model, locked: true, lockReason: 'fixed for this conversation' as const },
      effort: { ...effort, locked: true },
      disabled: false,
    }));
    const trigger = dom.byLabel('Model and effort: Default, Default — fixed for this conversation')[0] as
      HTMLButtonElement | undefined;
    assert.ok(trigger, 'the trigger says why it cannot be used');
    assert.equal(trigger.disabled, true);

    await open(dom, trigger);
    assert.equal(settingRows(dom).length, 0, 'a locked pill opens nothing');
  });
});

test('a runtime with one setting gets that list directly, not a one-row parent menu', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModelEffortMenu, {
      model: { ...model, show: false },
      effort,
      disabled: false,
    }));
    const trigger = dom.byLabel('Reasoning effort: Default')[0];
    assert.ok(trigger, 'effort alone keeps its control-naming trigger');

    await open(dom, trigger);

    assert.equal(settingRows(dom).length, 0, 'no flyout hop for a single list');
    assert.deepEqual(dom.byRole('group').map(groupName), ['Effort']);
    assert.deepEqual(
      dom.byRole('menuitemradio').map((row) => row.textContent),
      ['Default', 'Low', 'High'],
    );
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

test('the Mode pill names the mode alone, with no second value appended', async () => {
  await withDom(async (dom) => {
    await dom.render(h(ModeMenu, {
      mode: { show: true, value: 'auto' as const, onSet: () => {} },
      disabled: false,
    }));
    assert.equal(dom.query('[data-slot="menu-trigger"]')?.textContent, 'Auto');
    await open(dom, dom.query('[data-slot="menu-trigger"]')!);
    assert.deepEqual(dom.byRole('group').map(groupName), ['Mode']);
  });
});
