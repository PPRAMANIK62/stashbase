#!/usr/bin/env python
"""PDF → markdown or html + image bundle.

Invoked by `server/pdf.ts` after the user drags a PDF into a space.
Writes a note file (`<stem>.md` or `<stem>.html`) alongside the PDF
and an image bundle dir named `<stem>_files/` containing every
embedded image — matches the HTML-import convention so the rest of
StashBase (sidebar / iframe asset routing / rename-cascade) treats
the result the same as a hand-imported note.

Two converters supported, picked by `--converter`:

    pymupdf  (default — zero extra deps)
        Per-page text + images.  ``--format md`` streams text; ``html``
        keeps approximate layout via pymupdf's `get_text("html")`.
        Loses fidelity on multi-column / formula-heavy papers.

    marker   (`pip install marker-pdf` first)
        ML-backed converter from the Datalab folks.  Heavy install
        and slow on first run (~2 GB models) but recovers real
        structure (headings, tables, math).  Supports both formats.

Output shape is always:

    <stem>.{md,html}
    <stem>_files/
        page-1-img-1.png
        ...

Args: ``<pdf> <out_note> <bundle_dir>`` plus optional ``--converter``
and ``--format``.

Exits 0 on success, non-zero on failure with a diagnostic on stderr.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def slugify(text: str) -> str:
    """GitHub-style heading slug — kept in sync with `slugifyHeading`
    in `web-src/src/markdown.ts` so cross-file `[..](paper.md#slug)`
    anchors land on the right heading."""
    t = text.lower()
    t = re.sub(r"[^\w\s-]", "", t, flags=re.UNICODE)
    t = re.sub(r"\s+", "-", t)
    t = re.sub(r"-+", "-", t)
    return t.strip("-") or "section"


def _extract_pymupdf_images(doc, page, page_idx: int, bundle_dir: Path, counter: list[int]):
    """Drain every embedded image from a PyMuPDF page into the bundle
    dir and yield `(filename, alt_text)` per saved file. ``counter``
    is a single-slot list used as a mutable int (so callers share the
    running image index across pages)."""
    import pymupdf  # type: ignore[import-not-found]
    for img in page.get_images(full=True):
        xref = img[0]
        try:
            pix = pymupdf.Pixmap(doc, xref)
        except Exception as err:
            print(f"[pdf_extract] page {page_idx} image xref {xref} skipped: {err}", file=sys.stderr)
            continue
        counter[0] += 1
        if pix.alpha or pix.colorspace is None or pix.colorspace.n > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        fname = f"page-{page_idx}-img-{counter[0]}.png"
        pix.save(bundle_dir / fname)
        yield fname


def convert_with_pymupdf(pdf_path: Path, out_path: Path, bundle_dir: Path, fmt: str) -> None:
    """Per-page text + images. ``fmt`` is ``md`` or ``html``.

    md: streams `## Page N` sections with inline image refs.  No
        semantic structure beyond pages (pymupdf doesn't tell us
        what's a heading vs body).

    html: concats pymupdf's per-page absolute-positioned HTML inside
        a sandbox-compatible shell. Images are injected after each
        page's HTML so they show up near their text. Approximate
        layout but rendering matches the source PDF more closely
        than the markdown path.
    """
    import pymupdf  # type: ignore[import-not-found]

    doc = pymupdf.open(pdf_path)
    bundle_dir.mkdir(parents=True, exist_ok=True)
    bundle_basename = bundle_dir.name
    title = (doc.metadata or {}).get("title") or pdf_path.stem
    counter = [0]

    if fmt == "html":
        parts: list[str] = []
        parts.append("<!doctype html><html><head><meta charset=\"utf-8\">")
        parts.append(f"<title>{_html_escape(title)}</title>")
        parts.append("<style>body{font:14px/1.5 ui-sans-serif,sans-serif;padding:24px;max-width:920px;margin:0 auto;} "
                     ".page{margin-bottom:48px;border-bottom:1px solid #eee;padding-bottom:24px;} "
                     ".page-images img{display:block;max-width:100%;margin:8px 0;} "
                     ".page p{margin:0.4em 0;}</style>")
        parts.append("</head><body>")
        # No outer <h1> with PDF metadata — that field is unreliable
        # ("Transaction / Regular Paper Title" placeholder is common).
        # pymupdf's xhtml output detects the real paper title by font
        # size; that <h1> lives inside page 1.
        for page_idx, page in enumerate(doc, start=1):
            parts.append(f"<section class=\"page\" id=\"page-{page_idx}\">")
            parts.append(f"<h2>Page {page_idx}</h2>")
            parts.append("<div class=\"page-images\">")
            for fname in _extract_pymupdf_images(doc, page, page_idx, bundle_dir, counter):
                parts.append(f"<img src=\"{bundle_basename}/{fname}\" alt=\"\">")
            parts.append("</div>")
            # `xhtml` produces semantic flow HTML — `<p>` / `<b>` /
            # `<i>` in reading order. `html` mode is also available
            # but it emits absolute-positioned `<p style="top:..">`
            # without the `position: absolute` rule needed to honour
            # those styles, so every paragraph stacks at y=0 and the
            # output looks like two columns lying on top of each
            # other. xhtml just flows.
            page_html = page.get_text("xhtml") or ""
            # Demote pymupdf's font-size-detected headings by one
            # level so paper section headings (h1) don't compete with
            # our "Page N" h2. <h1> → <h3>, <h2> → <h4>, etc — keeps
            # the document outline coherent and our page navigation
            # at the top of each section.
            page_html = re.sub(
                r"<(/?)h([1-5])\b",
                lambda m: f"<{m.group(1)}h{int(m.group(2)) + 2}",
                page_html,
            )
            parts.append(page_html)
            parts.append("</section>")
        parts.append("</body></html>")
        out_path.write_text("".join(parts), encoding="utf-8")
        return

    # markdown path
    lines: list[str] = [f"# {title}", ""]
    for page_idx, page in enumerate(doc, start=1):
        lines.append(f"## Page {page_idx}")
        lines.append("")
        for fname in _extract_pymupdf_images(doc, page, page_idx, bundle_dir, counter):
            lines.append(f"![]({bundle_basename}/{fname})")
            lines.append("")
        body = page.get_text("text").strip()
        if body:
            body = re.sub(r"\n{3,}", "\n\n", body)
            lines.append(body)
            lines.append("")
    out_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def _html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    )


def convert_with_marker(pdf_path: Path, out_path: Path, bundle_dir: Path, fmt: str) -> None:
    """Shell out to marker_single, then reshape its output into the
    bundle layout. marker writes `<outdir>/<stem>/<stem>.<ext>` plus
    images in the same subdir — we lift the note up and move images
    into `<bundle>/`. ``fmt`` is forwarded as ``--output_format``."""
    ext = "html" if fmt == "html" else "md"
    with tempfile.TemporaryDirectory(prefix="stashbase-marker-") as tmp:
        cmd = ["marker_single", str(pdf_path), "--output_dir", tmp, "--output_format", fmt]
        # 10 min ceiling. marker pulls a 1.5 GB model on first run and a
        # large scientific PDF can legitimately need a couple of minutes,
        # but we don't want a hung subprocess to pin the daemon's stdin
        # reader forever — the Node side's own request timeout would
        # eventually retry, leaving the orphaned marker process to clog
        # CPU. ``subprocess.run`` raises ``TimeoutExpired`` (caught by
        # the caller's general except), which kills the child cleanly.
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if res.returncode != 0:
            raise RuntimeError(
                f"marker_single failed (exit {res.returncode}):\n{res.stderr or res.stdout}"
            )
        stem = pdf_path.stem
        produced_dir = Path(tmp) / stem
        if not produced_dir.is_dir():
            # Some marker versions output directly into --output_dir
            # without the per-pdf subdir. Cover that too.
            produced_dir = Path(tmp)
        note_src = produced_dir / f"{stem}.{ext}"
        if not note_src.is_file():
            note_src = next(produced_dir.glob(f"*.{ext}"), None)  # type: ignore[assignment]
        if note_src is None or not Path(note_src).is_file():
            raise RuntimeError(f"marker produced no .{ext} under {produced_dir}")
        bundle_dir.mkdir(parents=True, exist_ok=True)
        note_text = Path(note_src).read_text(encoding="utf-8")
        # Marker emits images like `![](_page_X_Figure_Y.jpg)` (md) or
        # `<img src="_page_X_Figure_Y.jpg">` (html). Copy each into
        # the bundle and rewrite the ref. Image basenames are unique
        # within one marker run, so flat copy is fine.
        for img in produced_dir.iterdir():
            if img.is_file() and img.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".svg"):
                target = bundle_dir / img.name
                target.write_bytes(img.read_bytes())
                bundled = f"{bundle_dir.name}/{img.name}"
                note_text = (
                    note_text.replace(f"]({img.name})", f"]({bundled})")
                    .replace(f'src="{img.name}"', f'src="{bundled}"')
                    .replace(f"src='{img.name}'", f"src='{bundled}'")
                )
        out_path.write_text(note_text, encoding="utf-8")


CONVERTERS = {
    "pymupdf": convert_with_pymupdf,
    "marker": convert_with_marker,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="PDF → markdown/html + bundle for StashBase.")
    parser.add_argument("pdf")
    parser.add_argument("out_path", help="Target note path (`<stem>.md` or `<stem>.html`).")
    parser.add_argument("bundle_dir", help="Bundle dir (`<stem>_files/`) to dump images into.")
    parser.add_argument(
        "--converter",
        default=os.environ.get("STASHBASE_PDF_CONVERTER", "pymupdf"),
        choices=list(CONVERTERS),
    )
    parser.add_argument(
        "--format",
        default=os.environ.get("STASHBASE_PDF_FORMAT", "html"),
        choices=["html", "md"],
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf).resolve()
    out_path = Path(args.out_path).resolve()
    bundle_dir = Path(args.bundle_dir).resolve()
    if not pdf_path.is_file():
        print(f"[pdf_extract] not a file: {pdf_path}", file=sys.stderr)
        return 2

    fn = CONVERTERS[args.converter]
    try:
        fn(pdf_path, out_path, bundle_dir, args.format)
    except Exception as err:
        print(f"[pdf_extract] {args.converter} failed: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
