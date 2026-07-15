import sanitizeHtml from 'sanitize-html';

/** Applies the document-preview trust policy to parsed Markdown HTML. */
export function sanitizeMarkdownHtml(html: string): string {
  return sanitizeHtml(html, MARKDOWN_SANITIZE_OPTIONS);
}

const MARKDOWN_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'blockquote', 'br',
    'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
    'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins', 'kbd', 'li',
    'main', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small',
    'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var',
  ],
  allowedAttributes: {
    '*': ['id', 'title', 'dir', 'lang', 'aria-*'],
    a: ['href', 'class'],
    blockquote: ['cite'],
    code: ['class'],
    col: ['span'],
    colgroup: ['span'],
    del: ['cite', 'datetime'],
    details: ['open'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    input: ['type', 'checked', 'disabled'],
    ins: ['cite', 'datetime'],
    li: ['class', 'value'],
    ol: ['start', 'reversed', 'type'],
    q: ['cite'],
    td: ['colspan', 'rowspan', 'headers', 'align'],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'align'],
    section: ['class'],
    sup: ['class'],
    ul: ['class'],
  },
  allowedClasses: {
    a: ['footnote-backref'],
    section: ['footnotes'],
    sup: ['footnote-ref'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    input: (_tagName, attributes) => ({
      tagName: 'input',
      attribs: {
        type: 'checkbox',
        disabled: '',
        ...(Object.hasOwn(attributes, 'checked') ? { checked: '' } : {}),
      },
    }),
  },
};
