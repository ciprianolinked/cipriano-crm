#!/usr/bin/env python3
"""Gera public/cipriano-fontes.zip apenas com o código-fonte.

Exclui node_modules, .next, .git, .env (segredos) e o próprio ZIP.
Rode:  python3 scripts/gerar-zip-fontes.py
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "cipriano-fontes.zip")

EXCLUDE_DIRS = {"node_modules", ".next", ".git", ".vercel", "out", "dist", "build", ".cache", ".turbo", "test-results", "playwright-report"}
EXCLUDE_FILES = {".env", ".DS_Store", "Thumbs.db", "tsconfig.tsbuildinfo", "cipriano-fontes.zip"}
EXCLUDE_EXT = {".tsbuildinfo", ".pdf", ".log"}


def keep(path: str) -> bool:
    parts = path.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return False
    name = os.path.basename(path)
    if name in EXCLUDE_FILES:
        return False
    if name.startswith(".env.") and name != ".env.example":
        return False
    if any(name.endswith(ext) for ext in EXCLUDE_EXT):
        return False
    return True


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in sorted(files):
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT)
                if not keep(rel):
                    continue
                zf.write(full, os.path.join("cipriano-propostas", rel))
                count += 1
    size = os.path.getsize(OUT)
    print(f"OK: {count} arquivos -> public/cipriano-fontes.zip ({size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
