import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';

import { HtmlDocument } from './document';

let userActivationDescriptor: PropertyDescriptor | undefined;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.document.documentElement.classList.remove('dark', 'light');
  if (userActivationDescriptor) {
    Object.defineProperty(globalThis.navigator, 'userActivation', userActivationDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'userActivation');
  }
  userActivationDescriptor = undefined;
});

describe('HTML document', () => {
  it('uses an opaque-origin script sandbox and the versioned source asset', async () => {
    const navigation = createDocumentNavigationRuntime('tab-1');
    render(
      <HtmlDocument
        active
        name="archive.html"
        navigation={navigation}
        onNavigate={vi.fn()}
        onOpenExternal={vi.fn(async () => true)}
        resource={{
          kind: 'source',
          url: 'data:text/html,archive',
          version: 'one',
        }}
        source={{ folderPath: '/library', path: 'archive.html' }}
        tabId="tab-1"
      />,
    );

    const frame = screen.getByTitle('archive.html HTML preview') as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.referrerPolicy).toBe('no-referrer');
    expect(frame.src).toBe('data:text/html,archive');
    expect(frame.parentElement?.className).toContain('rounded-xl');
    expect(frame.parentElement?.parentElement?.className).toContain('bg-surface-2');
    expect(frame.parentElement?.parentElement?.className).toContain('p-2');

    const frameWindow = frame.contentWindow;
    expect(frameWindow).not.toBeNull();
    if (!frameWindow) throw new Error('HTML preview frame has no content window.');
    const postMessage = vi.spyOn(frameWindow, 'postMessage');
    globalThis.document.documentElement.classList.add('dark');
    fireEvent.load(frame);
    expect(postMessage).toHaveBeenCalledWith({ theme: 'dark', type: 'stashbase-theme' }, '*');
    await waitFor(() => expect(navigation.store.getState().find.available).toBe(true));
  });

  it('accepts frame Find replies and routes only user-activated document links', async () => {
    const navigation = createDocumentNavigationRuntime('tab-1');
    const onNavigate = vi.fn();
    const onOpenExternal = vi.fn(async () => true);
    const userActivation = { isActive: false };
    userActivationDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      'userActivation',
    );
    Object.defineProperty(globalThis.navigator, 'userActivation', {
      configurable: true,
      value: userActivation,
    });
    render(
      <HtmlDocument
        active
        name="archive.html"
        navigation={navigation}
        onNavigate={onNavigate}
        onOpenExternal={onOpenExternal}
        resource={{
          kind: 'source',
          url: 'data:text/html,archive',
          version: 'one',
        }}
        source={{ folderPath: '/library', path: 'pages/archive.html' }}
        tabId="tab-1"
      />,
    );
    const frame = screen.getByTitle('archive.html HTML preview') as HTMLIFrameElement;
    const frameWindow = frame.contentWindow;
    expect(frameWindow).not.toBeNull();
    if (!frameWindow) throw new Error('HTML preview frame has no content window.');
    const postMessage = vi.spyOn(frameWindow, 'postMessage');

    act(() => navigation.setFindQuery('guide'));
    const request = postMessage.mock.calls.find(
      ([message]) => (message as Record<string, unknown>).type === 'stashbase-find',
    )?.[0] as Record<string, unknown>;
    expect(request.query).toBe('guide');
    act(() => {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: {
            current: 1,
            reqId: request.reqId,
            total: 3,
            type: 'stashbase-find-result',
          },
          source: frameWindow,
        }),
      );
    });
    await waitFor(() => expect(navigation.store.getState().find.total).toBe(3));

    act(() => {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: { href: 'next.html#details', type: 'stashbase-nav' },
          source: frameWindow,
        }),
      );
    });
    expect(onNavigate).not.toHaveBeenCalled();

    userActivation.isActive = true;
    act(() => {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: { href: 'next.html#details', type: 'stashbase-nav' },
          source: frameWindow,
        }),
      );
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: { href: 'https://example.com/guide', type: 'stashbase-open-external' },
          source: frameWindow,
        }),
      );
    });
    expect(onNavigate).toHaveBeenCalledWith({
      anchor: 'details',
      source: { folderPath: '/library', path: 'pages/next.html' },
    });
    expect(onOpenExternal).toHaveBeenCalledWith('https://example.com/guide');

    fireEvent.load(frame);
  });
});
