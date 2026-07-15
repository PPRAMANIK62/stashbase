/** Wraps rendered Markdown in the self-contained preview iframe document. */
export function createPreviewDocument(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${bodyHtml}</body></html>`;
}

const PREVIEW_CSS = `
html, body { margin: 0; padding: 0; background: #fff; color: rgb(55, 53, 47); }
body {
  font: 16px/1.7 ui-sans-serif, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  padding: 32px 56px 80px;
  max-width: 820px; margin: 0 auto;
}
h1, h2, h3, h4, h5, h6 {
  font-weight: 700; line-height: 1.3; color: rgb(55, 53, 47);
  letter-spacing: -0.01em;
  margin: 1.8em 0 0.6em;
}
h1 { font-size: 1.875em; margin-top: 1.4em; padding-bottom: 0.3em; border-bottom: 1px solid rgb(236, 238, 241); }
h2 { font-size: 1.5em; padding-bottom: 0.25em; border-bottom: 1px solid rgb(236, 238, 241); }
h3 { font-size: 1.25em; }
h4 { font-size: 1.05em; }
h5 { font-size: 0.95em; }
h6 { font-size: 0.85em; color: rgba(55, 53, 47, 0.65); }
p { margin: 0.9em 0; }
a { color: #0e7490; text-decoration: underline; text-decoration-color: rgba(14, 116, 144, 0.4); }
a:hover { text-decoration-color: rgba(14, 116, 144, 0.85); }
.footnote-ref { font-size: 0.75em; line-height: 0; vertical-align: super; }
.footnote-ref a { padding: 0 0.12em; text-decoration: none; }
.footnotes {
  margin-top: 2.5em; color: rgba(55, 53, 47, 0.78); font-size: 0.875em;
}
.footnotes hr { margin-bottom: 1.25em; }
.footnotes ol { padding-left: 1.8em; }
.footnotes li { padding-left: 0.25em; scroll-margin-top: 1em; }
.footnotes li:target { background: rgba(14, 116, 144, 0.08); }
.footnotes p { margin: 0.45em 0; }
.footnote-backref { display: inline-block; margin-left: 0.3em; padding: 0 0.2em; text-decoration: none; }
.footnote-ref a:focus-visible,
.footnote-backref:focus-visible {
  outline: 2px solid #0e7490; outline-offset: 2px; border-radius: 2px;
}
code {
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.875em;
  background: rgba(140, 149, 159, 0.1);
  color: rgb(55, 53, 47);
  padding: 0.15em 0.4em; border-radius: 4px;
}
pre {
  background: rgb(248, 250, 252); padding: 14px 18px; border-radius: 6px;
  border: 1px solid rgb(236, 238, 241);
  overflow-x: auto; line-height: 1.5; margin: 1em 0;
}
pre code { background: transparent; color: rgb(55, 53, 47); padding: 0; font-size: 0.88em; }
blockquote {
  margin: 1em 0; padding: 4px 14px;
  border-left: 3px solid rgb(55, 53, 47);
  color: inherit;
}
ul, ol { padding-left: 1.6em; margin: 0.9em 0; }
li { margin: 0.35em 0; }
table { border-collapse: collapse; margin: 0.5em 0; font-size: 0.95em; }
th, td { border: 1px solid rgb(236, 238, 241); padding: 6px 10px; }
th { background: rgb(248, 250, 252); font-weight: 600; }
img { max-width: 100%; height: auto; border-radius: 3px; }
img[data-stashbase-previewable="true"] { cursor: zoom-in; }
hr { border: 0; border-top: 1px solid rgb(236, 238, 241); margin: 1em 0; }
`;
