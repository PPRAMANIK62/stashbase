#!/usr/bin/env bash
# Count hand-written source lines per area, separating production code from
# tests and Storybook specimens. Reads the working tree (tracked plus
# not-ignored new files), so it reflects what is on disk right now.
#
#   scripts/count-code-lines.sh              # production code only
#   scripts/count-code-lines.sh --all        # also break out tests and stories
#   scripts/count-code-lines.sh --files      # list the files in each bucket
#
# Requires cloc (brew install cloc) for comment/blank separation.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

command -v cloc >/dev/null || {
  echo "cloc not found. Install it with: brew install cloc" >&2
  exit 1
}

SHOW_ALL=0
SHOW_FILES=0
for arg in "$@"; do
  case "$arg" in
    --all) SHOW_ALL=1 ;;
    --files) SHOW_FILES=1 ;;
    -h | --help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Hand-written source only. Generated output, vendored dependencies and every
# ignored path are excluded by --exclude-standard.
CODE_EXT='\.(ts|tsx|cts|mts|cjs|mjs|js|jsx|py|css)$'

# Verification code: unit tests, Electron smoke drivers, the renderer test
# toolkit, and Story harnesses.
TEST_PAT='(\.test\.(ts|tsx|cjs|mjs)$|__tests__/|_test\.py$|^renderer/src/test/|smoke|-runner\.cjs$|\.harness\.tsx$)'
STORY_PAT='\.stories\.(ts|tsx)$'

# git lists deleted-but-tracked paths too; keep only what exists on disk.
git ls-files -co --exclude-standard |
  grep -E "$CODE_EXT" |
  while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done |
  sort > "$WORK/all"

grep -E "$TEST_PAT" "$WORK/all" > "$WORK/tests" || true
grep -E "$STORY_PAT" "$WORK/all" > "$WORK/stories" || true
grep -Ev "$TEST_PAT|$STORY_PAT" "$WORK/all" > "$WORK/prod" || true

# Buckets are (label, regex) pairs applied to the production file list.
# Order matters only for readability; the patterns are disjoint.
BUCKETS=(
  "Frontend UI (renderer)|^renderer/"
  "Backend server (Node)|^server/"
  "Electron host|^electron/"
  "MCP server|^mcp/"
  "Python sidecar|^python/"
  "Shared protocols|^shared/"
  "Build + dev scripts|^(scripts/|build/|toolchain/|[^/]+\.(config\.)?(ts|cjs|mjs)$)"
)

# The renderer dominates the total, so split it along its feature-sliced
# layers: presentation, feature logic, app composition, shared plumbing.
RENDERER_LAYERS=(
  "Presentation (ui/)|^renderer/src/(features/[^/]+/ui/|components/)"
  "Feature logic|^renderer/src/features/[^/]+/(hooks|application|domain|infrastructure)/"
  "Feature entry (public.ts)|^renderer/src/features/[^/]+/[^/]+\.ts$"
  "App composition|^renderer/src/app/"
  "Shared plumbing|^renderer/(src/(lib|platform|shared)/|\.storybook/)"
)

# Print one cloc summary row for the file list on stdin.
#
# --timeout 0 is required for a reproducible count. cloc's default budget for a
# language filter stage is one second per line of the file, and when a stage
# runs out it keeps the file but skips comment stripping, so its comment lines
# land in the code column. Under load that silently moved ~170 lines between
# the two columns from one run to the next.
row() {
  local label=$1 list="$WORK/.list" err="$WORK/.err"
  cat > "$list"
  if [ ! -s "$list" ]; then
    printf '  %-24s %6s %10s %10s %10s\n' "$label" 0 0 0 0
    return
  fi
  local out
  out=$(cloc --quiet --csv --timeout 0 --list-file="$list" 2> "$err")
  # cloc reports unreadable files and parse trouble on stderr. The file list is
  # pre-filtered to paths that exist, so anything here is worth seeing.
  if [ -s "$err" ]; then
    printf '\n%s: cloc reported:\n' "$label" >&2
    sed 's/^/  /' "$err" >&2
  fi
  local sum
  sum=$(awk -F, '$2=="SUM"{print $1","$5","$4","$3}' <<< "$out")
  # A single-language bucket has no SUM row; fall back to the one data row.
  [ -n "$sum" ] || sum=$(awk -F, 'NR>1 && NF>=5 {print $1","$5","$4","$3}' <<< "$out" | head -1)
  IFS=, read -r files code comment blank <<< "${sum:-0,0,0,0}"
  printf '  %-24s %6s %10s %10s %10s\n' "$label" "$files" "$code" "$comment" "$blank"
  if [ "$SHOW_FILES" = 1 ]; then sed 's/^/      /' "$list"; fi
}

header() {
  printf '\n%s\n' "$1"
  printf '  %-24s %6s %10s %10s %10s\n' "" "files" "code" "comment" "blank"
}

header "Production code"
for entry in "${BUCKETS[@]}"; do
  label=${entry%%|*}
  pattern=${entry#*|}
  grep -E "$pattern" "$WORK/prod" | row "$label" || true
done
printf '  %s\n' "------------------------------------------------------------------------"
row "Total" < "$WORK/prod"

grep -E '^renderer/' "$WORK/prod" > "$WORK/renderer" || true
header "Frontend UI breakdown (renderer)"
CLAIMED=$(mktemp "$WORK/claimed.XXXX")
for entry in "${RENDERER_LAYERS[@]}"; do
  label=${entry%%|*}
  pattern=${entry#*|}
  grep -E "$pattern" "$WORK/renderer" | tee -a "$CLAIMED" | row "$label" || true
done
grep -vxFf "$CLAIMED" "$WORK/renderer" | row "Other (root, css)" || true

if [ "$SHOW_ALL" = 1 ]; then
  header "Verification code (excluded above)"
  grep -E '^renderer/' "$WORK/tests" | row "Renderer tests" || true
  grep -Ev '^renderer/' "$WORK/tests" | row "Host + script tests" || true
  row "Storybook stories" < "$WORK/stories"
fi

# Anything the buckets missed would be silently dropped from the total, so
# fail loudly rather than report a number that does not add up.
UNCLAIMED=$(mktemp "$WORK/unclaimed.XXXX")
cp "$WORK/prod" "$UNCLAIMED"
for entry in "${BUCKETS[@]}"; do
  grep -Ev "${entry#*|}" "$UNCLAIMED" > "$UNCLAIMED.next" || true
  mv "$UNCLAIMED.next" "$UNCLAIMED"
done
if [ -s "$UNCLAIMED" ]; then
  printf '\nUnbucketed production files (add a bucket for these):\n' >&2
  sed 's/^/  /' "$UNCLAIMED" >&2
  exit 1
fi
