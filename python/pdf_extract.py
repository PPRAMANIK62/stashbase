#!/usr/bin/env python
"""PDF → markdown + image bundle.

Invoked by `server/pdf.ts` after the user drags a PDF into a space.
Writes a derived note (`.<stem>.md`, dot-prefixed because it's an
app-maintained artifact rather than user content) alongside the PDF
and an image bundle dir named `.<stem>_files/` containing every
embedded image — matches the HTML-import convention so the rest of
StashBase (indexer / iframe asset routing / rename-cascade) treats
the result the same as a hand-imported note.

Two converters supported, picked by `--converter`:

    pymupdf  (default — zero extra deps beyond `pymupdf4llm`)
        `pymupdf4llm.to_markdown(write_images=True)` — detects
        headings by font size, recovers tables as markdown grids,
        and screenshots figure / chart regions as PNG. The thin
        layer the LLM-RAG ecosystem standardised on for arXiv-style
        scientific PDFs.

    marker   (`pip install marker-pdf` first)
        ML-backed converter from the Datalab folks. Heavy install
        and slow on first run (~2 GB models) but the quality
        ceiling: better OCR, smarter figure / equation handling.

Output shape is always:

    .<stem>.md          (dot-prefixed app-derived note)
    .<stem>_files/      (dot-prefixed image bundle)
        ...png

Args: ``<pdf> <out_note> <bundle_dir>`` plus optional ``--converter``.

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


def convert_with_pymupdf(pdf_path: Path, out_path: Path, bundle_dir: Path) -> None:
    """`pymupdf4llm.to_markdown` writes a markdown document and dumps
    each figure / chart region as a PNG into `image_path`. We point
    it at the dot-prefixed bundle dir and then rewrite the absolute
    image URLs it emits into bundle-relative refs so the resulting
    markdown stays portable when the space moves."""
    import pymupdf4llm  # type: ignore[import-not-found]

    bundle_dir.mkdir(parents=True, exist_ok=True)
    md = pymupdf4llm.to_markdown(
        str(pdf_path),
        write_images=True,
        image_path=str(bundle_dir),
        image_format="png",
    )
    # pymupdf4llm emits absolute-path image refs like
    # `![](/abs/path/.paper_files/x.png)` — rewrite to bundle-relative
    # so the saved markdown survives `mv` of the space.
    abs_prefix = str(bundle_dir) + os.sep
    md = md.replace(abs_prefix, bundle_dir.name + "/")
    out_path.write_text(md, encoding="utf-8")


def convert_with_marker(pdf_path: Path, out_path: Path, bundle_dir: Path) -> None:
    """Shell out to marker_single, then reshape its output into the
    bundle layout. marker writes `<outdir>/<stem>/<stem>.md` plus
    images in the same subdir — we lift the note up and move images
    into `<bundle>/`."""
    with tempfile.TemporaryDirectory(prefix="stashbase-marker-") as tmp:
        cmd = [
            "marker_single",
            str(pdf_path),
            "--output_dir",
            tmp,
            "--output_format",
            "md",
        ]
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
        note_src = produced_dir / f"{stem}.md"
        if not note_src.is_file():
            note_src = next(produced_dir.glob("*.md"), None)  # type: ignore[assignment]
        if note_src is None or not Path(note_src).is_file():
            raise RuntimeError(f"marker produced no .md under {produced_dir}")
        bundle_dir.mkdir(parents=True, exist_ok=True)
        note_text = Path(note_src).read_text(encoding="utf-8")
        # Marker emits images like `![](_page_X_Figure_Y.jpg)`. Copy each
        # into the bundle and rewrite the ref. Image basenames are
        # unique within one marker run, so a flat copy is fine.
        for img in produced_dir.iterdir():
            if img.is_file() and img.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".svg"):
                target = bundle_dir / img.name
                target.write_bytes(img.read_bytes())
                bundled = f"{bundle_dir.name}/{img.name}"
                note_text = note_text.replace(f"]({img.name})", f"]({bundled})")
        out_path.write_text(note_text, encoding="utf-8")


CONVERTERS = {
    "pymupdf": convert_with_pymupdf,
    "marker": convert_with_marker,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="PDF → markdown + bundle for StashBase.")
    parser.add_argument("pdf")
    parser.add_argument("out_path", help="Target note path (`.<stem>.md`).")
    parser.add_argument("bundle_dir", help="Bundle dir (`.<stem>_files/`) to dump images into.")
    parser.add_argument(
        "--converter",
        default=os.environ.get("STASHBASE_PDF_CONVERTER", "pymupdf"),
        choices=list(CONVERTERS),
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
        fn(pdf_path, out_path, bundle_dir)
    except Exception as err:
        print(f"[pdf_extract] {args.converter} failed: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
