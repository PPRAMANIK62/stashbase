import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/bug-report/application/failure-messages';
import type { PreviewState, ReviewArtifact } from '@/features/bug-report/domain/review-session';
import { artifactPreviews, reviewArtifacts } from '@/test/fakes/bug-report';

import { ArtifactRow, type ArtifactRowProps } from './artifact-row';

afterEach(cleanup);

const [screenshot, log, diagnostics] = reviewArtifacts() as [
  ReviewArtifact,
  ReviewArtifact,
  ReviewArtifact,
];

function mount(overrides: Partial<ArtifactRowProps> = {}) {
  const props: ArtifactRowProps = {
    artifact: log,
    editable: true,
    included: false,
    onToggleInclude: vi.fn(),
    onTogglePreview: vi.fn(),
    open: false,
    preview: undefined,
    ...overrides,
  };
  render(
    <ul>
      <ArtifactRow {...props} />
    </ul>,
  );
  return props;
}

describe('ArtifactRow', () => {
  it('names the artifact, its meta line, and the include switch', async () => {
    const props = mount();
    expect(screen.getByText('Application log')).not.toBeNull();
    expect(screen.getByText('32 KB · most recent entries · 2 redactions')).not.toBeNull();
    const toggle = screen.getByRole('switch', { name: 'Include Application log in the report' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.setup().click(toggle);
    expect(props.onToggleInclude).toHaveBeenCalledWith(true);
  });

  it('opens the preview without touching the selection', async () => {
    const props = mount({ artifact: screenshot, included: true });
    const preview = screen.getByRole('button', { name: 'Preview for Screenshot' });
    expect(preview.getAttribute('aria-expanded')).toBe('false');
    await userEvent.setup().click(preview);
    expect(props.onTogglePreview).toHaveBeenCalledOnce();
    expect(props.onToggleInclude).not.toHaveBeenCalled();
  });

  it('keeps an unavailable artifact visible, unselectable, and without a preview', async () => {
    const props = mount({
      artifact: { ...screenshot, availability: { kind: 'unavailable' } },
      included: false,
    });
    expect(screen.getByText('Unavailable for this report')).not.toBeNull();
    const toggle = screen.getByRole('switch', { name: 'Include Screenshot in the report' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.setup().click(toggle);
    expect(props.onToggleInclude).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /preview/iu })).toBeNull();
  });

  it('locks the switch outside review', async () => {
    const props = mount({ editable: false, included: true });
    await userEvent
      .setup()
      .click(screen.getByRole('switch', { name: 'Include Application log in the report' }));
    expect(props.onToggleInclude).not.toHaveBeenCalled();
  });

  it('shows the exact log text once loaded', () => {
    const preview = artifactPreviews()['artifact-log'];
    const state: PreviewState | undefined = preview ? { kind: 'loaded', preview } : undefined;
    mount({ open: true, preview: state });
    const region = screen.getByRole('region', { name: 'Application log preview' });
    expect(region).not.toBeNull();
    const excerpt = screen.getByRole('group', {
      name: 'Sanitized bounded application-log excerpt',
    });
    expect(excerpt.textContent).toBe(
      '[10:57:59] save: conflict on notes/plan.md\n[10:58:00] save: retry refused',
    );
  });

  it('lists diagnostics as a definition list', () => {
    const preview = artifactPreviews()['artifact-diagnostics'];
    const state: PreviewState | undefined = preview ? { kind: 'loaded', preview } : undefined;
    mount({ artifact: diagnostics, included: true, open: true, preview: state });
    expect(screen.getByRole('button', { name: 'Details for System info' })).not.toBeNull();
    expect(screen.getAllByRole('term')).toHaveLength(8);
    expect(screen.getAllByRole('definition')).toHaveLength(8);
    expect(screen.getByText('Packaged')).not.toBeNull();
    expect(screen.getByText('darwin')).not.toBeNull();
  });

  it('reads a loading preview and a failed one', () => {
    mount({ open: true, preview: { kind: 'loading' } });
    expect(screen.getByText('Loading preview…')).not.toBeNull();
    cleanup();
    mount({ open: true, preview: { failure: { kind: 'artifact-unavailable' }, kind: 'failed' } });
    expect(screen.getByText(failureMessage('artifact-unavailable'))).not.toBeNull();
  });
});
