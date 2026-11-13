#!/usr/bin/env python3
"""Build index.html by inlining the ES modules in src/ into one script.

Usage: python3 build.py

Starts at src/main.js, follows `import ... from './x.js'` lines, and writes
the modules dependencies-first into a single <script>, with the import lines
removed and the `export` keywords dropped. Everything shares one scope, so
top-level names must be unique across files; the build stops if two files
declare the same name.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"
ENTRY = "main.js"

IMPORT_RE = re.compile(r"^import\s[^;]*?from\s+['\"]\./([\w.-]+)['\"]\s*;?[ \t]*\n?", re.M | re.S)
EXPORT_DECL_RE = re.compile(r"^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)", re.M)
EXPORT_LIST_RE = re.compile(r"^export\s*\{[^}]*\}\s*;?[ \t]*\n?", re.M)
TOP_DECL_RE = re.compile(r"^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)", re.M)

HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#151a3e">
<title>Maccabee Runner</title>
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #0b0d1e;
    overflow: hidden;
    overscroll-behavior: none;
  }
  body {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  canvas {
    display: block;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
    touch-action: none;
  }
</style>
</head>
<body>
<canvas id="game" width="640" height="360"></canvas>
<script>
// Built by build.py from src/ — edit the files in src/, not this one.
(() => {
'use strict';
/*__MODULES__*/
})();
</script>
</body>
</html>
"""


def load_order():
    order, seen, visiting = [], set(), set()

    def visit(name, chain):
        if name in seen:
            return
        if name in visiting:
            sys.exit("build: import cycle: " + " -> ".join(chain + [name]))
        path = SRC / name
        if not path.exists():
            sys.exit(f"build: {chain[-1] if chain else '?'} imports missing file src/{name}")
        visiting.add(name)
        for dep in IMPORT_RE.findall(path.read_text(encoding="utf-8")):
            visit(dep, chain + [name])
        visiting.discard(name)
        seen.add(name)
        order.append(name)

    visit(ENTRY, [])
    return order


def strip_module(text):
    text = IMPORT_RE.sub("", text)
    text = EXPORT_LIST_RE.sub("", text)
    text = EXPORT_DECL_RE.sub("", text)
    if re.search(r"^\s*(import|export)\b", text, re.M):
        sys.exit("build: unsupported import/export form left after stripping")
    return text.strip() + "\n"


def main():
    order = load_order()
    unused = sorted(p.name for p in SRC.glob("*.js") if p.name not in order)
    if unused:
        print("build: not imported (skipped):", ", ".join(unused))

    owners, parts = {}, []
    for name in order:
        body = strip_module((SRC / name).read_text(encoding="utf-8"))
        for decl in TOP_DECL_RE.findall(body):
            if decl in owners:
                sys.exit(f"build: '{decl}' is declared in both {owners[decl]} and {name}")
            owners[decl] = name
        parts.append(f"// ---- src/{name} ----\n{body}")

    OUT.write_text(HTML.replace("/*__MODULES__*/", "\n".join(parts)), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"build: wrote {OUT.name} ({size // 1024} KB) from {len(order)} modules: {', '.join(order)}")


if __name__ == "__main__":
    main()
