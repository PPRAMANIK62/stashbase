import { syntaxTree } from '@codemirror/language';
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, type ViewUpdate, ViewPlugin, WidgetType } from '@codemirror/view';

type ConstructKind = 'heading' | 'emphasis' | 'strong' | 'strikethrough' | 'inline-code' | 'horizontal-rule';

export type ProjectionRange = { from: number; to: number };

type Construct = {
  kind: ConstructKind;
  from: number;
  to: number;
  markers: ProjectionRange[];
  rule: ProjectionRule;
  level?: number;
};

type ProjectionRule = {
  kind: ConstructKind;
  nodeNames: readonly string[];
  markerNames: readonly string[];
  level?: (nodeName: string) => number | undefined;
  sourceRanges?: (state: EditorState, construct: Construct) => ProjectionRange[];
  decorations: (construct: Construct, active: boolean) => Decoration[];
};

export type LiveMarkdownProjection = Pick<Construct, 'kind' | 'from' | 'to'> & { active: boolean };

export type ProjectionOptions = {
  /** Parsed document ranges that are currently visible to the user. */
  ranges?: readonly ProjectionRange[];
  /** Ranges that must remain ordinary source, such as an IME composing line. */
  sourceFallbackRanges?: readonly ProjectionRange[];
};

/** Composition events do not themselves produce a CodeMirror update. This
 * state effect makes their lifecycle visible to the projection plugin. */
export const setLiveMarkdownComposition = StateEffect.define<boolean>();

const liveMarkdownCompositionState = StateField.define<boolean>({
  create: () => false,
  update: (composing, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setLiveMarkdownComposition)) return effect.value;
    }
    return composing;
  },
});

/** Install this beside the projection so composition start/end causes a
 * transaction even when the IME has not inserted any document text. */
export const liveMarkdownCompositionGuard = [
  liveMarkdownCompositionState,
  EditorView.domEventHandlers({
    compositionstart: (_event, view) => {
      view.dispatch({ effects: setLiveMarkdownComposition.of(true) });
      return false;
    },
    compositionend: (_event, view) => {
      view.dispatch({ effects: setLiveMarkdownComposition.of(false) });
      return false;
    },
  }),
];

class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const rule = document.createElement('hr');
    rule.className = 'cm-live-horizontal-rule';
    return rule;
  }

  eq() { return true; }
}

const hiddenMarkdownMarkupDecoration = Decoration.replace({});
const horizontalRuleDecoration = Decoration.replace({ widget: new HorizontalRuleWidget(), block: true });

/**
 * Rules are deliberately internal: Live Editing has one CodeMirror adapter,
 * but each supported syntax form owns its parser nodes, source ranges, and
 * inactive presentation in one place. New forms extend this registry instead
 * of scattering special cases through selection and decoration code.
 */
const projectionRules: readonly ProjectionRule[] = [
  {
    kind: 'heading',
    nodeNames: ['ATXHeading1', 'ATXHeading2', 'ATXHeading3', 'ATXHeading4', 'ATXHeading5', 'ATXHeading6', 'SetextHeading1', 'SetextHeading2'],
    markerNames: ['HeaderMark'],
    level: (nodeName) => Number(nodeName.slice(-1)),
    sourceRanges: headingSourceRanges,
    decorations: (construct) => [Decoration.mark({
      class: `cm-live-heading cm-live-heading-${construct.level}`,
      attributes: { role: 'heading', 'aria-level': String(construct.level) },
    })],
  },
  {
    kind: 'emphasis',
    nodeNames: ['Emphasis'],
    markerNames: ['EmphasisMark'],
    decorations: () => [Decoration.mark({ class: 'cm-live-emphasis' })],
  },
  {
    kind: 'strong',
    nodeNames: ['StrongEmphasis'],
    markerNames: ['EmphasisMark'],
    decorations: () => [Decoration.mark({ class: 'cm-live-strong' })],
  },
  {
    kind: 'strikethrough',
    nodeNames: ['Strikethrough'],
    markerNames: ['StrikethroughMark'],
    decorations: () => [Decoration.mark({ class: 'cm-live-strikethrough' })],
  },
  {
    kind: 'inline-code',
    nodeNames: ['InlineCode'],
    markerNames: ['CodeMark'],
    decorations: () => [Decoration.mark({ class: 'cm-live-inline-code' })],
  },
  {
    kind: 'horizontal-rule',
    nodeNames: ['HorizontalRule'],
    markerNames: [],
    decorations: (_construct, active) => active ? [] : [horizontalRuleDecoration],
  },
];

const ruleByNodeName = new Map(projectionRules.flatMap((rule) => rule.nodeNames.map((name) => [name, rule] as const)));

/** Returns source-tree constructs projected by Live Editing. This is the
 * test seam: source text, parser ranges, and editor selections stay authority. */
export function describeLiveMarkdownProjection(
  state: EditorState,
  options: ProjectionOptions = {},
): LiveMarkdownProjection[] {
  const selection = state.selection.main;
  return collectConstructs(state, options.ranges)
    .filter((construct) => !intersectsAny(construct, options.sourceFallbackRanges))
    .map((construct) => ({
      kind: construct.kind,
      from: construct.from,
      to: construct.to,
      active: intersectsSelection(construct, selection.from, selection.to),
    }));
}

/** A selection-aware, syntax-tree-derived presentation layer. It adds no
 * document changes: malformed or unsupported Markdown has no recognized tree
 * node and stays ordinary editable source. */
export const liveMarkdownProjection = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  private composing = false;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate) {
    const composing = isLiveMarkdownComposition(update.view);
    if (composing) {
      // Keep the composition surface as ordinary source from compositionstart
      // through compositionend. In particular, no replacement widget can be
      // rebuilt inside the browser-owned IME DOM during that interval.
      this.decorations = Decoration.none;
      this.composing = true;
      return;
    }
    const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
    if (this.composing || shouldRefreshLiveMarkdownProjection({
      docChanged: update.docChanged,
      selectionSet: update.selectionSet,
      viewportChanged: update.viewportChanged,
      treeChanged,
    })) {
      this.decorations = buildDecorations(update.view);
    }
    this.composing = false;
  }
}, {
  decorations: (value) => value.decorations,
});

export function toggleMarkdownStrong(view: EditorView): boolean {
  return toggleMarkdownDelimiter(view, '**', 'StrongEmphasis');
}

export function toggleMarkdownEmphasis(view: EditorView): boolean {
  return toggleMarkdownDelimiter(view, '*', 'Emphasis');
}

/** The explicit state effect covers the start/end events, while the view flag
 * covers a composition already in progress before an event is observed. */
export function isLiveMarkdownComposition(view: Pick<EditorView, 'compositionStarted' | 'state'>): boolean {
  return view.state.field(liveMarkdownCompositionState, false) || view.compositionStarted;
}

export function shouldRefreshLiveMarkdownProjection(change: {
  docChanged: boolean;
  selectionSet: boolean;
  viewportChanged: boolean;
  treeChanged: boolean;
}): boolean {
  return change.docChanged || change.selectionSet || change.viewportChanged || change.treeChanged;
}

function buildDecorations(view: EditorView): DecorationSet {
  const state = view.state;
  const selection = state.selection.main;
  const markers: Array<{ from: number; to: number; decoration: Decoration }> = [];
  for (const construct of collectConstructs(state, view.visibleRanges)) {
    const active = intersectsSelection(construct, selection.from, selection.to);
    for (const decoration of construct.rule.decorations(construct, active)) {
      markers.push({ from: construct.from, to: construct.to, decoration });
    }
    if (!active) {
      for (const marker of sourceRangesFor(state, construct)) {
        markers.push({ from: marker.from, to: marker.to, decoration: hiddenMarkdownMarkupDecoration });
      }
    }
  }
  markers.sort((a, b) => a.from - b.from || b.to - a.to);
  return Decoration.set(markers.map(({ from, to, decoration }) => decoration.range(from, to)), true);
}

/** Returns source ranges that inactive constructs conceal. */
export function hiddenMarkdownMarkupRanges(state: EditorState, one?: Construct) {
  const selection = state.selection.main;
  const constructs = one ? [one] : collectConstructs(state);
  return constructs
    .filter((construct) => !intersectsSelection(construct, selection.from, selection.to))
    .flatMap((construct) => sourceRangesFor(state, construct));
}

function sourceRangesFor(state: EditorState, construct: Construct): ProjectionRange[] {
  return construct.rule.sourceRanges?.(state, construct) ?? construct.markers;
}

function headingSourceRanges(state: EditorState, construct: Construct): ProjectionRange[] {
  const source = state.doc.toString();
  return construct.markers.map((marker) => {
    let { from, to } = marker;
    if (marker.from === construct.from) {
      while (to < construct.to && (source[to] === ' ' || source[to] === '\t')) to++;
    } else if (source[from - 1] === '\n') {
      from--;
    } else {
      while (from > construct.from && (source[from - 1] === ' ' || source[from - 1] === '\t')) from--;
    }
    return { from, to };
  });
}

function collectConstructs(state: EditorState, ranges?: readonly ProjectionRange[]): Construct[] {
  const constructs = new Map<string, Construct>();
  const parsedRanges = ranges === undefined ? [{ from: 0, to: state.doc.length }] : ranges;
  for (const range of parsedRanges) collectConstructsInRange(state, range, constructs);
  return [...constructs.values()].sort((a, b) => a.from - b.from || b.to - a.to);
}

function collectConstructsInRange(state: EditorState, range: ProjectionRange, constructs: Map<string, Construct>) {
  const stack: Construct[] = [];
  syntaxTree(state).iterate({
    from: range.from,
    to: range.to,
    enter(node) {
      const rule = ruleByNodeName.get(node.name);
      if (rule) {
        const key = `${rule.kind}:${node.from}:${node.to}`;
        let construct = constructs.get(key);
        if (!construct) {
          construct = {
            kind: rule.kind,
            from: node.from,
            to: node.to,
            rule,
            ...(rule.level ? { level: rule.level(node.name) } : {}),
            markers: [],
          };
          constructs.set(key, construct);
        }
        stack.push(construct);
        return;
      }
      const owner = [...stack].reverse().find((construct) => construct.rule.markerNames.includes(node.name));
      if (owner && !owner.markers.some((marker) => marker.from === node.from && marker.to === node.to)) {
        owner.markers.push({ from: node.from, to: node.to });
      }
    },
    leave(node) {
      if (ruleByNodeName.has(node.name)) stack.pop();
    },
  });
}

function intersectsAny(construct: ProjectionRange, ranges: readonly ProjectionRange[] | undefined): boolean {
  return !!ranges?.some((range) => construct.from < range.to && construct.to > range.from);
}

function intersectsSelection(construct: Construct, from: number, to: number): boolean {
  if (from === to) return construct.from <= from && from <= construct.to;
  return construct.from < Math.max(from, to) && construct.to > Math.min(from, to);
}

function toggleMarkdownDelimiter(view: EditorView, delimiter: string, nodeName: string): boolean {
  const selection = view.state.selection.main;
  const construct = enclosingConstruct(view.state, nodeName, selection.from, selection.to);
  const existingDelimiter = construct && delimiterForConstruct(view.state.doc.toString(), construct, delimiter);
  if (construct && existingDelimiter) {
    const contentFrom = construct.from + existingDelimiter.length;
    const contentTo = construct.to - existingDelimiter.length;
    view.dispatch({
      changes: [
        { from: contentTo, to: construct.to },
        { from: construct.from, to: contentFrom },
      ],
      selection: {
        anchor: clamp(selection.anchor - existingDelimiter.length, construct.from, contentTo - existingDelimiter.length),
        head: clamp(selection.head - existingDelimiter.length, construct.from, contentTo - existingDelimiter.length),
      },
    });
    return true;
  }
  if (selection.empty) {
    view.dispatch({ changes: { from: selection.from, insert: delimiter + delimiter }, selection: { anchor: selection.from + delimiter.length } });
  } else {
    view.dispatch({
      changes: [{ from: selection.to, insert: delimiter }, { from: selection.from, insert: delimiter }],
      selection: { anchor: selection.anchor + delimiter.length, head: selection.head + delimiter.length },
    });
  }
  return true;
}

function enclosingConstruct(state: EditorState, nodeName: string, from: number, to: number) {
  const candidates: ProjectionRange[] = [];
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== nodeName) return;
      const contains = start === end ? node.from <= start && start <= node.to : node.from <= start && node.to >= end;
      if (contains) candidates.push({ from: node.from, to: node.to });
    },
  });
  return candidates.sort((a, b) => (a.to - a.from) - (b.to - b.from))[0] ?? null;
}

function delimiterForConstruct(source: string, construct: ProjectionRange, fallback: string) {
  const opening = source.slice(construct.from, construct.from + fallback.length);
  const closing = source.slice(construct.to - fallback.length, construct.to);
  const valid = fallback === '**' ? opening === '**' || opening === '__' : opening === '*' || opening === '_';
  return valid && opening === closing ? opening : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
