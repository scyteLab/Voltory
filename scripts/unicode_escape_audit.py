#!/usr/bin/env python3
"""
unicode_escape_audit.py

Finds every literal `\\uXXXX` sequence in JS/JSX/TS/TSX source files
and reports what would be replaced. Optionally writes the changes.

Rationale: past code generation double-escaped unicode escape
sequences, so files contain the LITERAL 6-character string `\\u2014`
where they should contain either the single character `\u2014` or
the escape sequence `\u2014` (single backslash). At runtime, the
former renders as visible garbage.

Skips:
  \u00B7 CSS files (parse differently)
  \u00B7 files under node_modules, dist, build
  \u00B7 hex-encoded strings that look intentional (e.g. in test files
    that specifically test unicode handling \u2014 none in this repo)
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path("src")
EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}

# Files that legitimately contain \\uXXXX sequences inside regex
# literals or character classes, where the escape must NOT be
# converted (regex compilation depends on the escape syntax).
SKIP_FILES = {
    "src/utils/searchEngine.js",  # regex character class for stripping diacritics
}

# Match the LITERAL 6-character sequence: backslash, u, 4 hex digits
# (In source: backslash is one byte; we're looking for it as text.)
ESCAPE_RE = re.compile(r'\\u([0-9a-fA-F]{4})')

def transform(text: str) -> tuple[str, list[tuple[str, int]]]:
    """Replace all \\uXXXX with the actual character. Returns (new_text, replacements).
    replacements: list of (char_hex, count)."""
    counts = {}
    def sub(m):
        hex_str = m.group(1)
        counts[hex_str] = counts.get(hex_str, 0) + 1
        return chr(int(hex_str, 16))
    new_text = ESCAPE_RE.sub(sub, text)
    return new_text, sorted(counts.items(), key=lambda kv: -kv[1])

def main(write: bool):
    total_files_changed = 0
    total_replacements = 0
    global_counts = {}
    per_file_report = []

    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in EXTENSIONS:
            continue
        if str(path) in SKIP_FILES:
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        new_text, counts = transform(original)
        if new_text == original:
            continue

        total_files_changed += 1
        file_total = sum(c for _, c in counts)
        total_replacements += file_total
        per_file_report.append((str(path), file_total, counts))

        for hex_str, count in counts:
            global_counts[hex_str] = global_counts.get(hex_str, 0) + count

        if write:
            path.write_text(new_text, encoding="utf-8")

    print(f"\n=== SUMMARY ===")
    print(f"Files touched: {total_files_changed}")
    print(f"Total replacements: {total_replacements}")
    print(f"\nBy character:")
    for hex_str, count in sorted(global_counts.items(), key=lambda kv: -kv[1]):
        ch = chr(int(hex_str, 16))
        print(f"  U+{hex_str.upper()}  '{ch}'  \u2192  {count}")

    print(f"\nTop 20 most-changed files:")
    per_file_report.sort(key=lambda x: -x[1])
    for path, total, counts in per_file_report[:20]:
        summary = ", ".join(f"U+{h.upper()}\u00D7{c}" for h, c in counts[:4])
        if len(counts) > 4:
            summary += f", +{len(counts)-4} more"
        print(f"  {total:>4}  {path}   [{summary}]")

    if not write:
        print(f"\n(dry run \u2014 no files written)")

if __name__ == "__main__":
    write = "--write" in sys.argv
    main(write=write)