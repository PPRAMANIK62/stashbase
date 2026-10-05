import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './sidebar';

afterEach(cleanup);

const rows = ['Library', 'Projects', 'Recent files'];

function renderSidebar(width?: { onWidthChange(width: string): void; width: string }) {
  const view = render(
    <SidebarProvider defaultOpen persist={false} {...width}>
      <Sidebar collapsible="offcanvas">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu aria-label="Workspace navigation">
              {rows.map((label, index) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton isActive={index === 0}>{label}</SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
      </SidebarInset>
    </SidebarProvider>,
  );
  return { container: view.container };
}

const shellState = () =>
  document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state');
const row = (name: string) => screen.getByRole('button', { name });

describe('Sidebar composition', () => {
  it('renders an accessible shell with the current row marked', async () => {
    const { container } = renderSidebar();
    await expectNoA11yViolations(container);
    expect(row('Library').getAttribute('aria-current')).toBe('page');
    expect(row('Projects').getAttribute('aria-current')).toBe(null);
  });

  it('collapses and re-expands from the trigger', async () => {
    renderSidebar();
    expect(shellState()).toBe('expanded');

    fireEvent.click(row('Toggle Sidebar'));
    await waitFor(() => expect(shellState()).toBe('collapsed'));

    fireEvent.click(row('Toggle Sidebar'));
    await waitFor(() => expect(shellState()).toBe('expanded'));
  });

  it('resizes from the keyboard within its bounds and never collapses', () => {
    const onWidthChange = vi.fn();
    renderSidebar({ onWidthChange, width: '300px' });
    const rail = screen.getByRole('separator', { name: 'Resize or collapse sidebar' });
    expect(rail.tabIndex).toBe(0);
    expect(rail.getAttribute('aria-valuenow')).toBe('300');
    expect(rail.getAttribute('aria-valuemin')).toBe('272');
    expect(rail.getAttribute('aria-valuemax')).toBe('360');

    fireEvent.keyDown(rail, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith('316px');
    expect(rail.getAttribute('aria-valuenow')).toBe('316');
    fireEvent.keyDown(rail, { key: 'ArrowLeft' });
    fireEvent.keyDown(rail, { key: 'ArrowLeft' });
    fireEvent.keyDown(rail, { key: 'ArrowLeft' });
    // 316 → 300 → 284 → 272: the floor holds instead of collapsing.
    expect(onWidthChange).toHaveBeenLastCalledWith('272px');
    expect(shellState()).toBe('expanded');

    for (let press = 0; press < 10; press += 1) fireEvent.keyDown(rail, { key: 'ArrowRight' });
    expect(onWidthChange).toHaveBeenLastCalledWith('360px');

    onWidthChange.mockClear();
    fireEvent.keyDown(rail, { key: 'Enter' });
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(shellState()).toBe('expanded');
  });

  it('shrinks from the default width when pressing the left arrow', () => {
    renderSidebar();
    const rail = screen.getByRole('separator', { name: 'Resize or collapse sidebar' });
    const initialWidth = Number(rail.getAttribute('aria-valuenow'));

    fireEvent.keyDown(rail, { key: 'ArrowLeft' });

    expect(Number(rail.getAttribute('aria-valuenow'))).toBe(initialWidth - 16);
    expect(shellState()).toBe('expanded');
  });

  it('moves focus along the menu with the arrow keys', () => {
    renderSidebar();
    const first = row('Library');
    first.focus();

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Projects'));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(row('Recent files'));

    // The run wraps, so End then ArrowDown lands back on the first row.
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
  });
});
