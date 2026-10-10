#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
rom="$repo_dir/ssint_orig.md"
output_dir=${1:-"$repo_dir/docs/screenshots/game-kit-colours"}

for command in mame xvfb-run; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$rom" ]]; then
  printf 'ROM not found: %s\n' "$rom" >&2
  exit 1
fi

mkdir -p "$output_dir"
output_dir=$(cd "$output_dir" && pwd -P)
export SS_KIT_COLOUR_OUTPUT_DIR="$output_dir"

xvfb-run -a mame megadriv \
  -cart "$rom" \
  -video soft \
  -sound none \
  -skip_gameinfo \
  -nothrottle \
  -seconds_to_run 60 \
  -autoboot_script "$repo_dir/scripts/capture-kit-colours.lua"

for colour in black dark-red red orange yellow green white grey light-blue blue; do
  if [[ ! -s "$output_dir/$colour.png" ]]; then
    printf 'Screenshot missing: %s\n' "$output_dir/$colour.png" >&2
    exit 1
  fi
done

printf 'Captured 10 kit colours in %s\n' "$output_dir"
