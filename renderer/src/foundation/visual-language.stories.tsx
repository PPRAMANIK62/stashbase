import type { Meta, StoryObj } from '@storybook/react-vite';
import { type MouseEvent, useState } from 'react';

import { cn } from '@/lib/utils';

const surfaceLevels = [
  { className: 'bg-surface-1', level: '1', role: 'Application' },
  { className: 'bg-surface-2', level: '2', role: 'Panel' },
  { className: 'bg-surface-3', level: '3', role: 'Raised' },
  { className: 'bg-surface-4', level: '4', role: 'Popover' },
  { className: 'bg-surface-5', level: '5', role: 'Dialog' },
  { className: 'bg-surface-6', level: '6', role: 'Nested' },
  { className: 'bg-surface-7', level: '7', role: 'Menu' },
  { className: 'bg-surface-8', level: '8', role: 'Highest' },
] as const;

const edgePatterns = [
  {
    className: 'bg-surface-2',
    description: 'Tone alone separates adjacent workspace regions.',
    label: 'Open plane',
  },
  {
    className: 'border bg-surface-2',
    description: 'A real border marks a fixed structural seam.',
    label: 'Structural border',
  },
  {
    className: 'bg-surface-3 shadow-seam',
    description: 'An inset shadow draws a soft edge without adding elevation.',
    label: 'Shadow seam',
  },
  {
    className: 'bg-surface-3 shadow-raised',
    description: 'A small ambient shadow identifies a composer or raised control.',
    label: 'Raised surface',
  },
  {
    className: 'bg-surface-5 shadow-overlay',
    description: 'A broad shadow is reserved for dialogs and crossing panes.',
    label: 'Overlay surface',
  },
] as const;

type SectionHeadingProps = {
  children: string;
  description: string;
  id?: string;
  index: string;
};

function SectionHeading({ children, description, id, index }: SectionHeadingProps) {
  return (
    <div className="mb-5 grid gap-1 border-b pb-4 sm:flex sm:gap-6">
      <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase sm:w-32 sm:shrink-0">
        {index}
      </p>
      <div className="min-w-0 flex-1">
        <h2 className="text-heading font-semibold tracking-tight" id={id}>
          {children}
        </h2>
        <p className="mt-1 max-w-2xl text-body-sm leading-comfortable text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function SurfaceLadder() {
  return (
    <section aria-labelledby="surface-heading">
      <SectionHeading
        description="Surfaces lift relative to their substrate. Dark mode communicates depth through tone; light mode becomes white and relies on edges and shadow."
        id="surface-heading"
        index="Foundation 01"
      >
        Surface ladder
      </SectionHeading>

      <ol className="grid overflow-hidden rounded-lg shadow-seam sm:grid-cols-4 xl:grid-cols-8">
        {surfaceLevels.map((surface) => (
          <li
            className={cn(
              'flex min-h-32 flex-col justify-between p-3 shadow-seam',
              surface.className,
            )}
            key={surface.level}
          >
            <span className="font-mono text-caption text-muted-foreground">
              {surface.level.padStart(2, '0')}
            </span>
            <div>
              <p className="text-caption font-medium">{surface.role}</p>
              <p className="mt-1 font-mono text-caption text-muted-foreground">
                surface-{surface.level}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 overflow-hidden rounded-lg bg-surface-1 p-4 shadow-seam sm:p-8">
        <p className="font-mono text-caption text-muted-foreground">Surface 01 · application</p>
        <div className="mt-4 rounded-lg bg-surface-2 p-4 shadow-seam sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-body-sm font-medium">Surface 02 · workspace panel</p>
            <span className="rounded-full bg-muted px-2 py-1 font-mono text-caption text-muted-foreground">
              substrate
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-surface-3 p-4 shadow-raised">
              <p className="text-body-sm font-medium">Surface 03 · raised composer</p>
              <p className="mt-2 text-body-sm leading-comfortable text-muted-foreground">
                The edge stays visible without outlining every control.
              </p>
            </div>
            <div className="rounded-lg bg-surface-5 p-4 shadow-overlay">
              <p className="text-body-sm font-medium">Surface 05 · dialog</p>
              <div className="mt-3 rounded-md bg-surface-7 px-3 py-2 shadow-seam">
                <p className="text-caption">Surface 07 · menu inside dialog</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EdgeGrammar() {
  return (
    <section>
      <SectionHeading
        description="Choose the weakest edge that still explains ownership. Shadows may behave like borders, but only crossing surfaces receive visible elevation."
        index="Foundation 02"
      >
        Edge and elevation grammar
      </SectionHeading>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {edgePatterns.map((pattern) => (
          <li className="min-w-0" key={pattern.label}>
            <div className={cn('flex min-h-28 items-end rounded-lg p-4', pattern.className)}>
              <span className="text-body-sm font-medium">{pattern.label}</span>
            </div>
            <p className="mt-3 text-caption text-muted-foreground">{pattern.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContentAndInteraction() {
  return (
    <section>
      <SectionHeading
        description="Hierarchy comes from tonal contrast, weight, and information type. Interaction states remain monochrome and preserve visible keyboard focus."
        index="Foundation 03"
      >
        Content and interaction
      </SectionHeading>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-lg bg-surface-2 p-5 shadow-seam">
          <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">
            Document source
          </p>
          <h3 className="mt-4 text-title font-semibold tracking-tight">
            Local files remain the source of truth.
          </h3>
          <p className="mt-4 max-w-xl text-body-sm leading-reading text-muted-foreground">
            Primary content carries the decision. Muted content explains context without competing
            for attention.
          </p>
          <p className="mt-5 font-mono text-caption text-muted-foreground">
            docs/frontend-migration/frontend-design.md
          </p>
        </div>

        <div className="rounded-lg bg-surface-2 p-5 shadow-seam">
          <p className="mb-4 font-mono text-caption tracking-wide text-muted-foreground uppercase">
            Control states
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="h-9 rounded-md bg-surface-3 px-4 text-body-sm font-medium shadow-seam"
              type="button"
            >
              Default
            </button>
            <button
              className="h-9 rounded-md bg-surface-3 px-4 text-body-sm font-medium shadow-seam transition-colors duration-fast ease-workspace-out hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              type="button"
            >
              Hover me
            </button>
            <button
              className="h-9 rounded-md bg-foreground px-4 text-body-sm font-medium text-background"
              type="button"
            >
              Selected
            </button>
            <button
              className="h-9 rounded-md bg-surface-3 px-4 text-body-sm font-medium shadow-seam outline-2 outline-offset-2 outline-ring"
              type="button"
            >
              Focus
            </button>
            <button
              className="h-9 rounded-md bg-muted px-4 text-body-sm text-muted-foreground opacity-disabled"
              disabled
              type="button"
            >
              Disabled
            </button>
          </div>

          <dl className="mt-7 grid grid-cols-3 gap-3 border-t pt-5 text-caption">
            <div>
              <dt className="text-muted-foreground">Border</dt>
              <dd className="mt-1 font-mono">border</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Input</dt>
              <dd className="mt-1 font-mono">input</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Radius</dt>
              <dd className="mt-1 font-mono">radius-md</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function MotionSpecimen() {
  const [animate, setAnimate] = useState(true);
  const [moved, setMoved] = useState(false);

  const moveSample = (event: MouseEvent<HTMLButtonElement>) => {
    setAnimate(event.detail !== 0);
    setMoved((current) => !current);
  };

  return (
    <section>
      <SectionHeading
        description="Motion explains state or spatial change. Keyboard activation is immediate; pointer-triggered demonstration uses the approved spatial token and can be interrupted."
        index="Foundation 04"
      >
        Motion roles
      </SectionHeading>

      <div className="grid gap-6 rounded-lg bg-surface-2 p-5 shadow-seam md:flex md:items-center md:justify-between">
        <div>
          <div className="flex h-16 w-44 items-center rounded-lg bg-surface-1 p-2 shadow-seam">
            <div
              className={cn(
                'size-12 rounded-md bg-foreground transition-transform ease-workspace-spatial',
                animate ? 'duration-spatial' : 'duration-0',
                moved && 'translate-x-28',
              )}
            />
          </div>
          <p className="mt-3 font-mono text-caption text-muted-foreground">
            Spatial · transform · duration-spatial
          </p>
        </div>

        <div className="md:text-right">
          <button
            className="h-9 rounded-md bg-foreground px-4 text-body-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={moveSample}
            type="button"
          >
            Move sample
          </button>
          <p className="mt-3 text-caption text-muted-foreground">
            Reduced motion removes travel automatically.
          </p>
        </div>
      </div>
    </section>
  );
}

function VisualLanguage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-6 pb-14 sm:flex sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">
              StashBase foundation
            </p>
            <h1 className="mt-3 text-display font-semibold tracking-tight sm:text-display-large">
              Visual language
            </h1>
            <p className="mt-4 max-w-2xl text-body leading-reading text-muted-foreground">
              A monochrome workbench where tone explains depth, edges explain ownership, and motion
              explains change.
            </p>
          </div>
          <div className="rounded-full bg-surface-2 px-3 py-1.5 font-mono text-caption text-muted-foreground shadow-seam">
            Continuous Workbench
          </div>
        </header>

        <div className="grid gap-16">
          <SurfaceLadder />
          <EdgeGrammar />
          <ContentAndInteraction />
          <MotionSpecimen />
        </div>
      </div>
    </main>
  );
}

const meta = {
  title: 'Foundation/Introduction',
  component: VisualLanguage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof VisualLanguage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VisualLanguageReference: Story = {
  name: 'Visual language',
};
