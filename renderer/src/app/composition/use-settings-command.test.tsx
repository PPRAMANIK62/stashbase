import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { useSettingsCommand } from './use-settings-command';

afterEach(() => {
  globalThis.document.body.replaceChildren();
});

describe('Settings command', () => {
  it('opens to the default Agents section when no section is requested', () => {
    const command = renderHook(() => useSettingsCommand());

    act(() => command.result.current.openSettings());

    expect(command.result.current.open).toBe(true);
    expect(command.result.current.section).toBe('agents');
  });

  it('opens directly to a requested section and lets onSectionChange move between sections', () => {
    const command = renderHook(() => useSettingsCommand());

    act(() => command.result.current.openSettings('mcp'));
    expect(command.result.current.section).toBe('mcp');

    act(() => command.result.current.onSectionChange('agents'));
    expect(command.result.current.section).toBe('agents');
  });

  it('closes and restores focus to the control that opened it', async () => {
    const trigger = globalThis.document.createElement('button');
    globalThis.document.body.append(trigger);
    trigger.focus();
    const command = renderHook(() => useSettingsCommand());

    act(() => command.result.current.openSettings());
    expect(command.result.current.open).toBe(true);

    act(() => command.result.current.close());
    expect(command.result.current.open).toBe(false);
    await waitFor(() => expect(globalThis.document.activeElement).toBe(trigger));
  });
});
