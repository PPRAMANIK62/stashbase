import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { TabItem, TabPanel, Tabs, TabsList } from './tabs';

afterEach(cleanup);

/** happy-dom lays nothing out, so the strip's measurements have to be handed
 *  to it: a 300×32 tablist holding three 100px tabs in a row. */
function setBox(
  element: HTMLElement,
  box: { height: number; left?: number; top?: number; width: number },
  offsetParent: HTMLElement | null,
) {
  const left = box.left ?? 0;
  const top = box.top ?? 0;
  Object.defineProperties(element, {
    offsetHeight: { configurable: true, value: box.height },
    offsetLeft: { configurable: true, value: left },
    offsetParent: { configurable: true, value: offsetParent },
    offsetTop: { configurable: true, value: top },
    offsetWidth: { configurable: true, value: box.width },
  });
  element.getBoundingClientRect = () =>
    ({
      bottom: top + box.height,
      height: box.height,
      left,
      right: left + box.width,
      top,
      width: box.width,
      x: left,
      y: top,
      toJSON: () => undefined,
    }) as DOMRect;
}

function layOutStrip(list: HTMLElement, tabs: HTMLElement[]) {
  setBox(list, { height: 32, width: 300 }, null);
  tabs.forEach((tab, index) => {
    setBox(tab, { height: 28, left: index * 100, top: 2, width: 100 }, list);
  });
}

/** The visible half of a tab's stacked label — the invisible semibold sizer
 *  beside it carries `aria-hidden`. Its colour class is how the strip reports
 *  which tab it is pointing at. */
function visibleLabel(tab: HTMLElement): HTMLElement {
  const label = tab.querySelector('span > span:not([aria-hidden])');
  if (!(label instanceof HTMLElement)) throw new Error('tab has no visible label');
  return label;
}

function renderTabs(onValueChange = vi.fn()) {
  const view = render(
    <Tabs defaultValue="library" onValueChange={onValueChange}>
      <TabsList aria-label="Workspace sections">
        <TabItem label="Library" value="library" />
        <TabItem label="Recents" value="recents" />
        <TabItem label="Favorites" value="favorites" />
      </TabsList>
      <TabPanel value="library">Documents from every folder.</TabPanel>
      <TabPanel value="recents">Files opened recently.</TabPanel>
      <TabPanel value="favorites">Starred documents.</TabPanel>
    </Tabs>,
  );
  return {
    container: view.container,
    list: screen.getByRole('tablist'),
    tabs: screen.getAllByRole('tab'),
    onValueChange,
  };
}

describe('Tabs', () => {
  it('swaps the visible panel and reports the value when a tab is selected', async () => {
    const { container, tabs, onValueChange } = renderTabs();
    await expectNoA11yViolations(container);

    const [library, recents] = tabs;
    if (!library || !recents) throw new Error('The harness renders three tabs.');
    expect(library.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Documents from every folder.');

    fireEvent.click(recents);

    expect(onValueChange).toHaveBeenLastCalledWith('recents');
    expect(library.getAttribute('aria-selected')).toBe('false');
    expect(recents.getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(screen.getByRole('tabpanel').textContent).toBe('Files opened recently.'),
    );
  });

  // Pointer proximity is the shared tabs-strip machinery: the measured tab
  // rects, the mouse handlers on the tablist, and the inside/outside flag the
  // hover pill reads on its way out. TabItem shows the answer by darkening the
  // tab nearest the cursor, so it is observable without a layout engine.
  it('darkens the tab nearest the cursor and releases it when the pointer leaves', async () => {
    const { list, tabs } = renderTabs();
    const favorites = tabs[2];
    if (!favorites) throw new Error('The harness renders three tabs.');
    layOutStrip(list, tabs);

    expect(visibleLabel(favorites).className).toContain('text-muted-foreground');

    fireEvent.mouseEnter(list);
    fireEvent.mouseMove(list, { clientX: 250, clientY: 14 });
    await waitFor(() => expect(visibleLabel(favorites).className).toContain('text-foreground'));

    fireEvent.mouseLeave(list);
    await waitFor(() =>
      expect(visibleLabel(favorites).className).toContain('text-muted-foreground'),
    );
  });
});
