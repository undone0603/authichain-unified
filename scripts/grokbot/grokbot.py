#!/usr/bin/env python3
"""Grokbot local-first knowledge harvester.

Scans authorized local roots for AuthiChain/QRON/StrainChain/GovChain material,
redacts obvious secrets, fingerprints artifacts, and emits a compact evidence
manifest suitable for Grok 4.7 agentic synthesis.

This script is intentionally read-only with respect to source artifacts.
Use --write-dir only to create a new evidence bundle; it never modifies the
source files it discovers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

PRODUCT_TERMS = {
    "authichain": ("authichain", "authi chain", "truth layer", "attestation"),
    "qron": ("qron", "qron.space", "artqr", "trueMark", "truemark"),
    "strainchain": ("strainchain", "strain chain", "genetics passport", "metrc", "biotrack"),
    "govchain": ("govchain", "gov chain", "sam.gov", "government document", "procurement"),
    "agentz": ("agentz", "guardian", "archivist", "sentinel", "scout", "arbiter"),
}

TEXT_EXTENSIONS = {
    ".md", ".mdx", ".txt", ".json", ".yaml", ".yml", ".toml", ".csv", ".tsv",
    ".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".py", ".rs", ".go", ".sql",
    ".xml", ".rtf", ".log", ".sh", ".bat", ".ps1", ".svg", ".env.example",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
ARCHIVE_EXTENSIONS = {".zip", ".tar", ".gz", ".tgz", ".7z"}
SKIP_DIRS = {".git", "node_modules", ".next", "dist", "build", "coverage", ".venv", "venv"}
MAX_TEXT_BYTES = 2_000_000

SECRET_PATTERNS = [
    re.compile(r"(?i)(sk_live_[A-Za-z0-9]+)"),
    re.compile(r"(?i)(sk_test_[A-Za-z0-9]+)"),
    re.compile(r"(?i)(ghp_[A-Za-z0-9_]+)"),
    re.compile(r"(?i)(github_pat_[A-Za-z0-9_]+)"),
    re.compile(r"(?i)(xai-[A-Za-z0-9_-]{20,})"),
    re.compile(r"(?i)(Bearer\s+[A-Za-z0-9._-]{20,})"),
    re.compile(r"(?i)((?:api[_-]?key|secret|token|password)\s*[=:]\s*[\"']?)[^\s\"']{12,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----.*?-----END .*?PRIVATE KEY-----", re.S),
]

@dataclass
class Evidence:
    id: str
    path: str
    artifact_type: str
    product: str
    size: int
    modified_at: str
    content_hash: str
    matched_terms: list[str]
    preview: str
    secret_redacted: bool


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def redact(text: str) -> tuple[str, bool]:
    changed = False
    out = text
    for pattern in SECRET_PATTERNS:
        out2 = pattern.sub(lambda m: (m.group(1) if m.lastindex else "") + "[REDACTED]", out)
        changed = changed or out2 != out
        out = out2
    return out, changed


def classify(text: str, name: str) -> tuple[str, list[str]]:
    haystack = f"{name}\n{text}".lower()
    hits: list[tuple[str, str]] = []
    for product, terms in PRODUCT_TERMS.items():
        for term in terms:
            if term.lower() in haystack:
                hits.append((product, term))
    if not hits:
        return "shared", []
    counts: dict[str, int] = {}
    for product, _ in hits:
        counts[product] = counts.get(product, 0) + 1
    product = max(counts, key=counts.get)
    return product, [term for p, term in hits if p == product][:12]


def artifact_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return "image"
    if suffix in ARCHIVE_EXTENSIONS:
        return "archive"
    if suffix in TEXT_EXTENSIONS:
        return "text"
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".docx", ".pptx", ".xlsx"}:
        return "office"
    return "other"


def iter_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        if root.is_file():
            yield root
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            yield path


def read_preview(path: Path) -> tuple[str, bool]:
    if artifact_type(path) not in {"text"} or path.stat().st_size > MAX_TEXT_BYTES:
        return "", False
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return "", False
    clean, changed = redact(raw)
    # Keep enough context for ranking without shipping whole artifacts.
    return clean[:12_000], changed


def discover(roots: list[Path]) -> list[Evidence]:
    results: list[Evidence] = []
    seen_hashes: set[str] = set()
    for path in iter_files(roots):
        try:
            size = path.stat().st_size
            digest = sha256_file(path)
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)
            preview, redacted = read_preview(path)
            product, terms = classify(preview, path.name)
            # Images/archives/docs without parsed text still enter the inventory
            # when their filenames identify the business domain.
            if not terms and product == "shared":
                product, terms = classify("", path.name)
            if product == "shared" and not terms:
                continue
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
            results.append(Evidence(
                id=f"sha256:{digest}",
                path=str(path.resolve()),
                artifact_type=artifact_type(path),
                product=product,
                size=size,
                modified_at=modified,
                content_hash=digest,
                matched_terms=terms,
                preview=preview,
                secret_redacted=redacted,
            ))
        except (OSError, PermissionError):
            continue
    return sorted(results, key=lambda x: (x.product, x.modified_at), reverse=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover AuthiChain ecosystem artifacts for Grokbot.")
    parser.add_argument("--root", action="append", dest="roots", default=[], help="Authorized directory/file to scan; repeatable.")
    parser.add_argument("--write-dir", default=".grokbot/evidence", help="Directory for generated manifest and redacted previews.")
    parser.add_argument("--max-results", type=int, default=1000)
    parser.add_argument("--json", action="store_true", help="Print JSON manifest to stdout.")
    args = parser.parse_args()

    roots = [Path(p).expanduser() for p in args.roots]
    if not roots:
        cwd = Path.cwd()
        roots = [cwd]
        for candidate in (Path.home() / "Downloads", Path.home() / "Desktop", Path.home() / "Documents"):
            if candidate.exists():
                roots.append(candidate)

    records = discover(roots)[: args.max_results]
    manifest = {
        "schema": "grokbot-evidence/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "roots": [str(r.resolve()) for r in roots],
        "count": len(records),
        "records": [asdict(r) for r in records],
    }

    if args.json:
        print(json.dumps(manifest, indent=2))
        return 0

    out = Path(args.write_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Store only redacted text previews. Source files are never copied.
    for index, record in enumerate(records):
        if not record.preview:
            continue
        target = out / f"{index:04d}-{record.product}-{record.content_hash[:12]}.txt"
        target.write_text(record.preview, encoding="utf-8")

    print(f"Grokbot indexed {len(records)} relevant artifacts.")
    print(f"Manifest: {manifest_path}")
    print("Source files were not modified or copied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
