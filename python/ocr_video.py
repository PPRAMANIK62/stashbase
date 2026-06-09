#!/usr/bin/env python
"""Video → OCR text note.

The video analogue of `ocr_extract.py`. Invoked by `server/video.ts`
(dropped-in videos → hidden sidecar) and `server/routes/recording.ts`
(screen recordings → visible note). Samples frames at a low fps, skips
near-duplicate frames (so a static screen isn't OCR'd 60×), runs RapidOCR
on each kept frame, then dedupes and denoises the recognised lines into a
single markdown note at `out_path`.

Always writes the note even when nothing is found (always-build-note),
seeded with the filename stem.

`--debug-dir DIR` (off by default) additionally dumps diagnostics into
DIR for tuning / troubleshooting: annotated frame JPEGs (OCR boxes +
scores), `ocr_results.json` (per-frame text + score + time), and
`ocr_unique_raw.json` (deduped raw texts). The normal run writes none of
these into the space.

Args: ``<video> <out_note> [fps] [diff_threshold] [--debug-dir DIR]``
(fps default 2.0, diff_threshold default 0.03).

Exits 0 on success, non-zero on failure with a diagnostic on stderr.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path


def normalize_text(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("｜", "|")
    return s.lower()


def is_noise_line(text: str) -> bool:
    """Drop chrome / UI furniture / timestamps that recur across frames and
    aren't part of the recorded content."""
    t = text.strip()
    low = t.lower()

    if not t or len(t) <= 2:
        return True

    noise_keywords = [
        "quicktime player", "quicktimeplayer",
        "file", "edit", "view", "window", "help",
        "文件", "编辑", "显示", "窗口", "帮助",
        "clipb",  # matches clipboard- / .clipboard / OCR'd "clipb0ard"
        "space-metadata.md", "file-metadata.md",
        ".claude", ".codex", "agents.md", "claude.md", "stashbase.md",
        "favicon", "get /", "http/1.1",
        "line ", "column ", "tab size", "plain text",
        "kb/s", "ob/s", "0b/s", "unregistered",
    ]
    if any(k in low for k in noise_keywords):
        return True

    if re.search(r"\d{1,2}/[a-z]{3}/\d{4}", low):
        return True
    if re.search(r"\d{2}:\d{2}:\d{2}", low):
        return True
    if re.search(r"\.(md|png|jpg|jpeg|svg|mp4|mov|webm|pdf)$", low):
        return True
    if re.fullmatch(r"[\W_]+", t):
        return True

    letters = re.findall(r"[A-Za-z一-鿿]", t)
    if len(letters) < 3:
        return True

    return False


def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_text(a), normalize_text(b)).ratio()


def add_unique_line(lines: list[str], line: str, threshold: float = 0.88) -> None:
    """Append `line` unless a near-duplicate is already present; if the new
    text is a longer variant of an existing line, replace it."""
    line = line.strip()
    if is_noise_line(line):
        return
    for i, existing in enumerate(lines):
        if similar(existing, line) >= threshold:
            if len(line) > len(existing):
                lines[i] = line
            return
    lines.append(line)


def column_boundaries(items: list[dict], frame_w: float) -> list[float]:
    """Find vertical column separators via x-axis whitespace projection.

    Project every region's [left, right] onto the x-axis; a run of x with
    no coverage that's wide enough is a column gutter. Full-width elements
    (wide headers/rules) are excluded from the projection so they don't
    bridge — and erase — a real gutter. Returns cut points bracketing the
    columns: [0, sep1, …, frame_w]."""
    width_i = int(frame_w) + 1
    cover = bytearray(width_i)
    for it in items:
        if (it["right"] - it["left"]) > 0.55 * frame_w:
            continue  # full-width element — don't let it fill a gutter
        left = max(0, int(it["left"]))
        right = min(width_i - 1, int(it["right"]))
        for x in range(left, right + 1):
            cover[x] = 1

    min_gap = max(20.0, 0.02 * frame_w)
    seps: list[float] = []
    x = 0
    while x < width_i:
        if not cover[x]:
            start = x
            while x < width_i and not cover[x]:
                x += 1
            if (x - start) >= min_gap:
                seps.append((start + x) / 2.0)
        else:
            x += 1
    return [0.0, *seps, frame_w + 1.0]


def order_regions(result, frame_w: float) -> list[dict]:
    """Reorder RapidOCR regions into human reading order. RapidOCR emits
    roughly top-to-bottom across the FULL width, so a multi-column layout
    comes back interleaved. We bucket regions into columns (see
    `column_boundaries`) then sort column-by-column (left→right), and
    top→bottom within each — so two columns no longer cross-contaminate."""
    items: list[dict] = []
    for item in result or []:
        if len(item) < 3 or not item[1]:
            continue
        box = item[0]
        xs = [float(p[0]) for p in box]
        ys = [float(p[1]) for p in box]
        items.append({
            "box": box, "text": str(item[1]), "score": float(item[2]),
            "left": min(xs), "right": max(xs), "top": min(ys),
            "cx": sum(xs) / len(xs),
        })
    if not items:
        return []
    w = frame_w or max(it["right"] for it in items) or 1.0
    cols = column_boundaries(items, w)

    def col_of(it: dict) -> int:
        for i in range(len(cols) - 1):
            if cols[i] <= it["cx"] < cols[i + 1]:
                return i
        return len(cols) - 2

    items.sort(key=lambda it: (col_of(it), it["top"], it["left"]))
    return items


def frame_signature(frame, width: int = 320):
    import cv2

    h, w = frame.shape[:2]
    scale = width / w
    resized = cv2.resize(frame, (width, int(h * scale)))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    return cv2.GaussianBlur(gray, (5, 5), 0)


def diff_ratio(prev_sig, curr_sig) -> float:
    import cv2
    import numpy as np

    diff = cv2.absdiff(prev_sig, curr_sig)
    return float(np.mean(diff > 25))


def extract_lines(
    video_path: Path,
    sample_fps: float,
    diff_threshold: float,
    debug_dir: str | None = None,
) -> list[str]:
    import cv2
    import numpy as np
    from rapidocr_onnxruntime import RapidOCR  # type: ignore[import-not-found]

    frames_dir = None
    results: list[dict] = []      # per-frame, for debug json
    raw_unique: list[dict] = []   # unique raw texts, for debug json
    raw_seen: set[str] = set()
    if debug_dir:
        frames_dir = os.path.join(debug_dir, "frames")
        os.makedirs(frames_dir, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video: {video_path}")

    ocr = RapidOCR()
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = max(int(video_fps / sample_fps), 1)

    clean_lines: list[str] = []
    last_kept_sig = None
    frame_idx = 0
    kept = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % frame_interval != 0:
                frame_idx += 1
                continue

            timestamp = frame_idx / video_fps
            curr_sig = frame_signature(frame)
            if last_kept_sig is None:
                ratio = 1.0
            else:
                ratio = diff_ratio(last_kept_sig, curr_sig)
                if ratio < diff_threshold:
                    frame_idx += 1
                    continue

            last_kept_sig = curr_sig
            kept += 1
            result, _elapsed = ocr(frame)

            # Reorder into reading order (column-aware) BEFORE deduping, so
            # multi-column layouts don't interleave. `i` then reflects
            # reading order in the debug overlay too.
            ordered = order_regions(result, float(frame.shape[1]))
            draw = frame.copy() if frames_dir else None
            texts: list[dict] = []
            for i, it in enumerate(ordered):
                text, score, box = it["text"], it["score"], it["box"]
                add_unique_line(clean_lines, text)
                if debug_dir:
                    texts.append({"index": i, "text": text, "score": score, "box": box})
                    key = normalize_text(text)
                    if key and key not in raw_seen:
                        raw_seen.add(key)
                        raw_unique.append({"time": round(timestamp, 2), "text": text, "score": score})
                    if draw is not None:
                        pts = np.array(box, dtype=np.int32)
                        cv2.polylines(draw, [pts], True, (0, 255, 0), 2)
                        x, y = pts[0]
                        cv2.putText(
                            draw, f"{i}:{score:.2f}", (int(x), max(int(y) - 6, 12)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1, cv2.LINE_AA,
                        )

            if frames_dir and draw is not None:
                out = os.path.join(frames_dir, f"frame_{timestamp:08.2f}s_diff_{ratio:.4f}.jpg")
                cv2.imwrite(out, draw)
            if debug_dir:
                results.append({"time": round(timestamp, 2), "diff": round(float(ratio), 6), "texts": texts})

            frame_idx += 1
    finally:
        cap.release()

    if debug_dir:
        with open(os.path.join(debug_dir, "ocr_results.json"), "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        with open(os.path.join(debug_dir, "ocr_unique_raw.json"), "w", encoding="utf-8") as f:
            json.dump(raw_unique, f, ensure_ascii=False, indent=2)

    suffix = f", debug → {debug_dir}" if debug_dir else ""
    print(f"[ocr_video] kept {kept} frame(s), {len(clean_lines)} unique line(s){suffix}", file=sys.stderr)
    return clean_lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Video → OCR text note for StashBase.")
    parser.add_argument("video")
    parser.add_argument("out_path", help="Target note path (`.<filename>.md` or a visible note).")
    parser.add_argument("fps", nargs="?", type=float, default=2.0)
    parser.add_argument("diff_threshold", nargs="?", type=float, default=0.03)
    parser.add_argument("--debug-dir", default=None, help="Dump annotated frames + raw OCR json here.")
    args = parser.parse_args()

    video_path = Path(args.video).resolve()
    out_path = Path(args.out_path).resolve()
    if not video_path.is_file():
        print(f"[ocr_video] not a file: {video_path}", file=sys.stderr)
        return 2

    try:
        lines = extract_lines(video_path, args.fps, args.diff_threshold, args.debug_dir)
    except Exception as err:
        print(f"[ocr_video] OCR failed: {err}", file=sys.stderr)
        return 1

    # Always write the note (always-build-note). Seed an empty result with
    # the filename stem so the note is non-empty and findable by name.
    parts = [f"# {video_path.stem}", ""]
    if lines:
        parts.extend(line + "\n" for line in lines)
    else:
        parts.append(video_path.stem)
    out_path.write_text("\n".join(parts).rstrip() + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
