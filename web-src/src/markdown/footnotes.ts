import { Marked, type TokenizerAndRendererExtension } from 'marked';

import { slugifyHeading } from './headingIds';

type FootnoteDefinition = {
  markdown: string;
  id: string;
};

/** Parses document Markdown with the preview-only footnote behavior installed. */
export function parseMarkdownWithFootnotes(markdown: string): string {
  const source = extractFootnoteDefinitions(markdown);
  const footnotes = new FootnoteRenderState(source.definitions);
  const documentMarkdown = new Marked({
    gfm: true,
    breaks: false,
    extensions: [footnotes.referenceExtension()],
  });
  const body = documentMarkdown.parse(source.markdown, { async: false }) as string;
  return body + footnotes.renderSection();
}

function normalizeFootnoteLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

type RawHtmlBlock = { end: RegExp | null };

function rawHtmlBlockFor(line: string): RawHtmlBlock | null {
  const rawTag = line.match(/^ {0,3}<(script|pre|style|textarea)(?:\s|>)/i);
  if (rawTag) return { end: new RegExp(`</${rawTag[1]}>`, 'i') };
  if (/^ {0,3}<!--/.test(line)) return { end: /-->/ };
  if (/^ {0,3}<\?/.test(line)) return { end: /\?>/ };
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return { end: /\]\]>/ };
  if (/^ {0,3}<![A-Z]/.test(line)) return { end: />/ };
  if (HTML_BLOCK_TAG.test(line)) return { end: null };
  if (GENERIC_HTML_BLOCK_TAG.test(line)) return { end: null };
  return null;
}

const HTML_BLOCK_TAG = /^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>)/i;
const GENERIC_HTML_BLOCK_TAG = /^ {0,3}(?:<[a-z][\w-]*(?: +[a-zA-Z:_][\w.:-]*(?: *= *(?:"[^"\n]*"|'[^'\n]*'|[^\s"'=<>`]+))?)* *\/?>|<\/[a-z][\w-]*\s*>)[ \t]*$/i;

function extractFootnoteDefinitions(markdown: string): {
  markdown: string;
  definitions: Map<string, FootnoteDefinition>;
} {
  const definitions = new Map<string, FootnoteDefinition>();
  const usedIds = new Set<string>();
  const body: string[] = [];
  const lines = markdown.replace(/\r\n?|\n/g, '\n').split('\n');
  let fence: { marker: string; length: number } | null = null;
  let rawHtmlBlock: RawHtmlBlock | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (rawHtmlBlock) {
      body.push(line);
      if (rawHtmlBlock.end ? rawHtmlBlock.end.test(line) : /^[ \t]*$/.test(line)) {
        rawHtmlBlock = null;
      }
      continue;
    }

    if (fence) {
      const closingFence = new RegExp(`^ {0,3}${fence.marker}{${fence.length},}[ \\t]*$`);
      if (closingFence.test(line)) fence = null;
      body.push(line);
      continue;
    }

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const validFence = fenceMatch && !(fenceMatch[1][0] === '`' && fenceMatch[2].includes('`'));
    if (validFence) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      body.push(line);
      continue;
    }

    const htmlBlock = rawHtmlBlockFor(line);
    if (htmlBlock) {
      body.push(line);
      if (!htmlBlock.end || !htmlBlock.end.test(line)) rawHtmlBlock = htmlBlock;
      continue;
    }

    const match = line.match(/^ {0,3}\[\^([^\]\n]+)\]:[ \t]*(.*)$/);
    if (!match) {
      body.push(line);
      continue;
    }

    const label = normalizeFootnoteLabel(match[1]);
    if (!label || definitions.has(label)) {
      body.push(line);
      continue;
    }

    const baseId = slugifyHeading(label) || 'note';
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    const definitionLines = [match[2]];
    let continuation = index + 1;
    while (continuation < lines.length) {
      const continuedLine = lines[continuation].match(/^(?: {4}|\t)(.*)$/);
      if (continuedLine) {
        definitionLines.push(continuedLine[1]);
        continuation += 1;
        continue;
      }
      if (/^[ \t]*$/.test(lines[continuation])) {
        const nextLine = lines[continuation + 1];
        if (nextLine != null && /^(?: {4}|\t)/.test(nextLine)) {
          definitionLines.push('');
          continuation += 1;
          continue;
        }
      }
      break;
    }
    index = continuation - 1;
    definitions.set(label, { markdown: definitionLines.join('\n'), id });
    // A definition is a block even though it is removed before Marked parses
    // the document. Keep that boundary so prose on either side cannot merge.
    body.push('');
  }

  return { markdown: body.join('\n'), definitions };
}

class FootnoteRenderState {
  private readonly references = new Map<string, string[]>();
  private readonly orderedLabels: string[] = [];

  constructor(private readonly definitions: Map<string, FootnoteDefinition>) {}

  referenceExtension(): TokenizerAndRendererExtension {
    return {
      name: 'footnoteReference',
      level: 'inline',
      start(src) {
        const index = src.indexOf('[^');
        return index >= 0 ? index : undefined;
      },
      tokenizer: (src) => {
        const match = /^\[\^([^\]\n]+)\]/.exec(src);
        if (!match || !this.definitions.has(normalizeFootnoteLabel(match[1]))) return;
        return { type: 'footnoteReference', raw: match[0], label: match[1] };
      },
      renderer: (token) => this.renderReference(String(token.label)),
    };
  }

  renderSection(): string {
    if (this.orderedLabels.length === 0) return '';

    // Definitions use ordinary document Markdown. Nested footnote syntax stays
    // literal instead of mutating reference state while the section is built.
    const definitionMarkdown = new Marked({ gfm: true, breaks: false });
    const items = this.orderedLabels.map((label, index) => {
      const definition = this.definitions.get(label);
      if (!definition) return '';
      const body = definitionMarkdown.parse(definition.markdown, { async: false }) as string;
      const backlinks = (this.references.get(label) ?? []).map((referenceId, referenceIndex) => (
        `<a href="#${referenceId}" class="footnote-backref" aria-label="Back to reference ${referenceIndex + 1} for footnote ${index + 1}">↩</a>`
      )).join(' ');
      const content = /<\/p>\n?$/.test(body)
        ? body.replace(/<\/p>\n?$/, ` ${backlinks}</p>`)
        : `${body}<p>${backlinks}</p>`;
      return `<li id="footnote:${definition.id}">${content}</li>`;
    }).join('');

    return `<section class="footnotes" aria-label="Footnotes"><hr><ol>${items}</ol></section>`;
  }

  private renderReference(rawLabel: string): string {
    const label = normalizeFootnoteLabel(rawLabel);
    const definition = this.definitions.get(label);
    if (!definition) return `[^${rawLabel}]`;

    if (!this.references.has(label)) {
      this.references.set(label, []);
      this.orderedLabels.push(label);
    }
    const references = this.references.get(label)!;
    const occurrence = references.length + 1;
    const referenceId = `footnote-ref:${definition.id}${occurrence === 1 ? '' : `-${occurrence}`}`;
    references.push(referenceId);
    const footnoteNumber = this.orderedLabels.indexOf(label) + 1;
    const labelSuffix = occurrence === 1 ? '' : `, reference ${occurrence}`;
    return `<sup class="footnote-ref"><a href="#footnote:${definition.id}" id="${referenceId}" aria-label="Footnote ${footnoteNumber}${labelSuffix}">${footnoteNumber}</a></sup>`;
  }
}
