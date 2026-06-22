#!/usr/bin/env bash
set -euo pipefail

PAGES=""
BATCH_SIZE=""
OCR_MAX_MPIX=""
BATCH_TIMEOUT_S=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --pages)
      if [ "$#" -lt 2 ]; then
        echo "missing value for --pages" >&2
        exit 2
      fi
      PAGES="$2"
      shift 2
      ;;
    --pages=*)
      PAGES="${1#--pages=}"
      shift
      ;;
    --batch-size)
      if [ "$#" -lt 2 ]; then
        echo "missing value for --batch-size" >&2
        exit 2
      fi
      BATCH_SIZE="$2"
      shift 2
      ;;
    --batch-size=*)
      BATCH_SIZE="${1#--batch-size=}"
      shift
      ;;
    --ocr-max-mpix)
      if [ "$#" -lt 2 ]; then
        echo "missing value for --ocr-max-mpix" >&2
        exit 2
      fi
      OCR_MAX_MPIX="$2"
      shift 2
      ;;
    --ocr-max-mpix=*)
      OCR_MAX_MPIX="${1#--ocr-max-mpix=}"
      shift
      ;;
    --batch-timeout-s)
      if [ "$#" -lt 2 ]; then
        echo "missing value for --batch-timeout-s" >&2
        exit 2
      fi
      BATCH_TIMEOUT_S="$2"
      shift 2
      ;;
    --batch-timeout-s=*)
      BATCH_TIMEOUT_S="${1#--batch-timeout-s=}"
      shift
      ;;
    --help|-h)
      echo "usage: $0 [--pages 3-10] [--batch-size 4] [--ocr-max-mpix 12] [--batch-timeout-s 180] <input.pdf> <output.md> [bundle_dir]" >&2
      exit 0
      ;;
    --*)
      echo "unknown option: $1" >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "usage: $0 [--pages 3-10] [--batch-size 4] [--ocr-max-mpix 12] [--batch-timeout-s 180] <input.pdf> <output.md> [bundle_dir]" >&2
  exit 0
fi

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 [--pages 3-10] [--batch-size 4] [--ocr-max-mpix 12] [--batch-timeout-s 180] <input.pdf> <output.md> [bundle_dir]" >&2
  exit 2
fi

PDF="$1"
OUT="$2"
BUNDLE="${3:-${OUT%.md}_files}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_BIN="${STASHBASE_PYTHON:-$REPO_ROOT/python/.venv.nosync/bin/python}"

if [ ! -f "$PDF" ]; then
  echo "input PDF not found: $PDF" >&2
  exit 2
fi

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Python extractor runtime not found or not executable: $PYTHON_BIN" >&2
  echo "Run: pnpm setup:python" >&2
  exit 2
fi

ARGS=("$REPO_ROOT/python/pdf_extract.py" "$PDF" "$OUT" "$BUNDLE")
if [ -n "$PAGES" ]; then
  ARGS+=("--pages" "$PAGES")
fi
if [ -n "$BATCH_SIZE" ]; then
  ARGS+=("--batch-size" "$BATCH_SIZE")
fi
if [ -n "$OCR_MAX_MPIX" ]; then
  ARGS+=("--ocr-max-mpix" "$OCR_MAX_MPIX")
fi
if [ -n "$BATCH_TIMEOUT_S" ]; then
  ARGS+=("--batch-timeout-s" "$BATCH_TIMEOUT_S")
fi

"$PYTHON_BIN" "${ARGS[@]}"

echo "wrote: $OUT"
echo "bundle: $BUNDLE"
if [ -n "$PAGES" ]; then
  echo "pages: $PAGES"
fi
if [ -n "$BATCH_SIZE" ]; then
  echo "batch-size: $BATCH_SIZE"
fi
if [ -n "$OCR_MAX_MPIX" ]; then
  echo "ocr-max-mpix: $OCR_MAX_MPIX"
fi
if [ -n "$BATCH_TIMEOUT_S" ]; then
  echo "batch-timeout-s: $BATCH_TIMEOUT_S"
fi
