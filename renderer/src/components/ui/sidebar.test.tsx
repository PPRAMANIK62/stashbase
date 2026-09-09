import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

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

function renderSidebar() {
  const view = render(
    <SidebarProvider defaultOpen persist={false}>
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
