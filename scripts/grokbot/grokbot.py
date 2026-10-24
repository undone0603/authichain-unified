#!/usr/bin/env python3
"""Grokbot local-first knowledge harvester.

Scans only an explicit allowlist of repo/workspace paths. The allowlist is
empty by default: with no --root (and no GROKBOT_SCAN_ALLOWLIST) nothing is
scanned. Downloads, Desktop and Documents are never added automatically.

The scanner is read-only with respect to source artifacts. Denied secret-bearing
filenames are skipped. Binary, undecodable, or ambiguously redacted items are
dropped (fail closed) instead of emitting a partial preview.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import ipaddress
import json
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, quote_plus, unquote_plus

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
    ".xml", ".rtf", ".log", ".sh", ".bat", ".ps1", ".svg",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
ARCHIVE_EXTENSIONS = {".zip", ".tar", ".gz", ".tgz", ".7z"}
SKIP_DIRS = {".git", "node_modules", ".next", "dist", "build", "coverage", ".venv", "venv"}
MAX_TEXT_BYTES = 2_000_000

# Empty by default. Never includes Downloads, Desktop or Documents.
SCAN_ALLOWLIST: tuple[str, ...] = ()

MARKER = "[REDACTED]"
_SECRET_NAME = r"key|secret|token|password|pass|private|credential|auth|salt"

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----|\Z)"),
    re.compile(r"-----BEGIN PGP [A-Z ]+-----[\s\S]*?(?:-----END PGP [A-Z ]+-----|\Z)"),
    re.compile(r"-----BEGIN ENCRYPTED [A-Z ]+-----[\s\S]*?(?:-----END ENCRYPTED [A-Z ]+-----|\Z)"),
    re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b", re.I),
    re.compile(r"\bwhsec_[A-Za-z0-9]{16,}\b", re.I),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b", re.I),
    re.compile(r"\bxai-[A-Za-z0-9_-]{20,}\b", re.I),
    re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
    re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bre_[A-Za-z0-9_]{16,}\b"),
    re.compile(r"(?i)(authorization\s*:\s*(?:basic|bearer|token)\s+)\S+"),
    re.compile(r"(?i)\b((?:basic|bearer|token)\s+)[A-Za-z0-9._+/=-]{4,}"),
    re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://[^\s:/@]+:)[^\s@/]+@"),
    re.compile(r"\b0x[0-9a-fA-F]{64}\b"),
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?<!\d)(?:\+1[-. ]?)?(?:\(?\d{3}\)?[-. ]?)\d{3}[-. ]?\d{4}(?!\d)"),
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
]

_CARD_RE = re.compile(r"(?:\d[ -]?){13,19}")
_IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_IPV6_RE = re.compile(
    r"(?<![0-9A-Fa-f:])("
    r"(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,7}:"
    r"|:(?::[0-9A-Fa-f]{1,4}){1,7}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}"
    r"|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}"
    r"|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6}"
    r")(?![0-9A-Fa-f:])"
)
_US_ADDR_RE = re.compile(
    r"\b\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+"
    r"(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\.?"
    r"[^\n]{0,80}?\b\d{5}(?:-\d{4})?\b",
    re.I,
)
_ASSIGNMENT_RE = re.compile(
    r"(?im)((?:^|[\s,;{])(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*[=:]\s*[\"']?)[^\s\"',;}]*"
)
_JSON_ASSIGN_RE = re.compile(
    r"(?i)(\"([A-Za-z0-9_.-]+)\"\s*:\s*\")[^\"]*"
)
_SECRET_NAME_RE = re.compile(rf"(?i)(?:{_SECRET_NAME})")
ASSIGNMENT_PATTERNS = (_ASSIGNMENT_RE, _JSON_ASSIGN_RE)
_B64_RE = re.compile(r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{20,}={0,2}(?![A-Za-z0-9+/])")
_UNICODE_ESCAPE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")
_HEX_ESCAPE_RE = re.compile(r"\\x([0-9a-fA-F]{2})")
_WORD_RE = re.compile(r"[A-Za-z]+")

DENIED_EXACT = {
    ".netrc",
    ".git-credentials",
    ".npmrc",
    "cookies",
    "cookies.sqlite",
    "cookies.txt",
    "cookies.db",
    "logins.json",
    "login data",
    "key4.db",
    "cert9.db",
}
DENIED_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".kdbx", ".p8")
BROWSER_DIR_MARKERS = {
    "google-chrome",
    "chromium",
    "firefox",
    ".mozilla",
    "mozilla",
    "user data",
    "chrome",
    "browser-profile",
}
BROWSER_PROFILE_FILES = {"cookies", "login data", "logins.json", "web data", "history"}
_WORDLIST_PATH = Path(__file__).resolve().parent / "data" / "bip39_english.txt"
_BIP39_WORDS: frozenset[str] | None = None


@dataclass(frozen=True)
class RedactResult:
    text: str
    changed: bool
    drop: bool = False


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


def bip39_words() -> frozenset[str]:
    global _BIP39_WORDS
    if _BIP39_WORDS is None:
        _BIP39_WORDS = frozenset(_WORDLIST_PATH.read_text(encoding="utf-8").split())
    return _BIP39_WORDS


def load_blocklist() -> list[str]:
    """Exact-match PII strings from a local gitignored file. Never committed."""
    candidates: list[Path] = []
    env = os.environ.get("GROKBOT_PII_BLOCKLIST")
    if env:
        candidates.append(Path(env))
    candidates.append(Path(".grokbot/pii-blocklist"))
    candidates.append(Path(".grokbot/pii-blocklist.txt"))
    lines: list[str] = []
    seen: set[str] = set()
    for path in candidates:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
            item = raw.strip()
            if not item or item.startswith("#") or item in seen:
                continue
            seen.add(item)
            lines.append(item)
    lines.sort(key=len, reverse=True)
    return lines


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _redact_match(match: re.Match[str]) -> str:
    """Replace the secret value; keep a prefix capture only when it is not the whole match."""
    if match.lastindex:
        prefix = match.group(1)
        if prefix != match.group(0):
            return f"{prefix}{MARKER}"
    return MARKER


def _luhn_ok(digits: str) -> bool:
    total = 0
    alt = False
    for ch in reversed(digits):
        n = ord(ch) - 48
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def _redact_cards(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", match.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            return MARKER
        return match.group(0)

    return _CARD_RE.sub(repl, text)


def _redact_ipv4(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        parts = match.group(0).split(".")
        if all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
            return MARKER
        return match.group(0)

    return _IPV4_RE.sub(repl, text)


def _redact_ipv6(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        try:
            ipaddress.IPv6Address(match.group(0))
        except ValueError:
            return match.group(0)
        return MARKER

    return _IPV6_RE.sub(repl, text)


def _redact_addresses(text: str) -> str:
    return _US_ADDR_RE.sub(MARKER, text)


def _redact_bip39(text: str) -> str:
    words = bip39_words()
    tokens = list(_WORD_RE.finditer(text))
    spans: list[tuple[int, int]] = []
    i = 0
    while i < len(tokens):
        if tokens[i].group(0).lower() not in words:
            i += 1
            continue
        j = i + 1
        while j < len(tokens) and tokens[j].group(0).lower() in words:
            gap = text[tokens[j - 1].end() : tokens[j].start()]
            if not re.fullmatch(r"\s+", gap):
                break
            j += 1
        run = j - i
        if run == 12 or run == 24:
            spans.append((tokens[i].start(), tokens[j - 1].end()))
            i = j
            continue
        if run > 24:
            spans.append((tokens[i].start(), tokens[i + 23].end()))
            i = i + 24
            continue
        i += 1
    out = text
    for start, end in reversed(spans):
        out = out[:start] + MARKER + out[end:]
    return out


def _redact_blocklist(text: str) -> str:
    out = text
    for item in load_blocklist():
        if item in out:
            out = out.replace(item, MARKER)
    return out


def _name_holds_secret(name: str) -> bool:
    return bool(_SECRET_NAME_RE.search(name))


def _redact_named_assignments(text: str) -> str:
    def env_repl(match: re.Match[str]) -> str:
        if not _name_holds_secret(match.group(2)):
            return match.group(0)
        return f"{match.group(1)}{MARKER}"

    def json_repl(match: re.Match[str]) -> str:
        if not _name_holds_secret(match.group(2)):
            return match.group(0)
        return f"{match.group(1)}{MARKER}"

    return _JSON_ASSIGN_RE.sub(json_repl, _ASSIGNMENT_RE.sub(env_repl, text))


_PII_ONLY_PREFIXES = (
    r"\b[A-Za-z0-9._%+-]+@",
    r"(?<!\d)",
    r"\b\d{3}-\d{2}-\d{4}",
)


def _apply_scanners(text: str, include_pii: bool) -> str:
    out = _redact_blocklist(text)
    out = _redact_cards(out)
    for pattern in SECRET_PATTERNS:
        if not include_pii and pattern.pattern.startswith(_PII_ONLY_PREFIXES):
            continue
        out = pattern.sub(_redact_match, out)
    out = _redact_named_assignments(out)
    out = _redact_bip39(out)
    if include_pii:
        out = _redact_ipv4(out)
        out = _redact_ipv6(out)
        out = _redact_addresses(out)
    return out


def _secret_values(text: str, include_pii: bool = False) -> list[str]:
    values: list[str] = []
    for pattern in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            if match.lastindex and match.group(1) != match.group(0):
                value = match.group(0)[len(match.group(1)) :]
            else:
                value = match.group(0)
            if value and value != MARKER and MARKER not in value:
                values.append(value)
    for match in _ASSIGNMENT_RE.finditer(text):
        if _name_holds_secret(match.group(2)):
            value = match.group(0)[len(match.group(1)) :]
            if value and value != MARKER and MARKER not in value:
                values.append(value)
    for match in _JSON_ASSIGN_RE.finditer(text):
        if _name_holds_secret(match.group(2)):
            value = match.group(0)[len(match.group(1)) :]
            if value and value != MARKER and MARKER not in value:
                values.append(value)
    for match in _CARD_RE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            values.append(match.group(0))
    if include_pii:
        values.extend(m.group(0) for m in _IPV4_RE.finditer(text))
        values.extend(m.group(0) for m in _US_ADDR_RE.finditer(text))
    return values


def _join_continuations(text: str) -> str:
    out = text.replace("\\\r\n", "").replace("\\\n", "")
    return re.sub(r"(?<=[A-Za-z0-9_+\-/=.])\r?\n(?=[A-Za-z0-9_+\-/=.])", "", out)


def _url_decode(text: str) -> str:
    prev = text
    for _ in range(3):
        nxt = unquote_plus(prev)
        if nxt == prev:
            break
        prev = nxt
    return prev


def _unicode_unescape(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    return _HEX_ESCAPE_RE.sub(repl, _UNICODE_ESCAPE_RE.sub(repl, text))


def _span_with_breaks(text: str, secret: str) -> re.Match[str] | None:
    if not secret:
        return None
    parts = [re.escape(secret[0])]
    for ch in secret[1:]:
        parts.append(r"(?:\\?\r?\n)?" + re.escape(ch))
    return re.search("".join(parts), text)


def _encoding_variants(secret: str) -> list[str]:
    variants = [
        quote(secret, safe=""),
        quote(secret, safe="/"),
        quote_plus(secret),
        "".join(f"\\u{ord(ch):04x}" for ch in secret),
        "".join(f"\\u{ord(ch):04X}" for ch in secret),
    ]
    raw = secret.encode("utf-8")
    variants.append(base64.b64encode(raw).decode("ascii"))
    variants.append(base64.urlsafe_b64encode(raw).decode("ascii").rstrip("="))
    return variants


def _replace_original_span(text: str, secret: str) -> tuple[str, bool]:
    if secret and secret in text:
        return text.replace(secret, MARKER), True
    match = _span_with_breaks(text, secret)
    if match:
        return text[: match.start()] + MARKER + text[match.end() :], True
    for encoded in _encoding_variants(secret):
        if encoded and encoded in text:
            return text.replace(encoded, MARKER), True
    return text, False


def _try_b64_decode(blob: str) -> str | None:
    pad = "=" * ((4 - len(blob) % 4) % 4)
    for decoder in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            raw = decoder(blob + pad)
        except (ValueError, binascii.Error):
            continue
        if not raw:
            continue
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            continue
    return None


def _redact_base64_runs(text: str) -> tuple[str, bool, bool]:
    changed = False
    drop = False
    spans = list(_B64_RE.finditer(text))
    out = text
    for match in reversed(spans):
        decoded = _try_b64_decode(match.group(0))
        if not decoded:
            continue
        secrets = _secret_values(decoded, include_pii=False)
        scanned = _apply_scanners(decoded, include_pii=False)
        if not secrets and scanned == decoded:
            continue
        out = out[: match.start()] + MARKER + out[match.end() :]
        changed = True
    return out, changed, drop


def redact(text: str) -> RedactResult:
    out = _apply_scanners(text, include_pii=True)
    drop = False
    changed = out != text

    for normalized in (_join_continuations(text), _url_decode(text), _unicode_unescape(text)):
        if normalized == text:
            continue
        for secret in _secret_values(normalized, include_pii=False):
            out, replaced = _replace_original_span(out, secret)
            if replaced:
                changed = True
            else:
                drop = True

    out, b64_changed, b64_drop = _redact_base64_runs(out)
    changed = changed or b64_changed
    drop = drop or b64_drop

    leftovers = _secret_values(out, include_pii=False)
    if leftovers:
        drop = True
    return RedactResult(text=out, changed=changed, drop=drop)


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


def is_denied_path(path: Path) -> bool:
    name = path.name
    lower = name.lower()
    if lower.startswith(".env") or lower.startswith("id_rsa"):
        return True
    if lower.endswith(DENIED_SUFFIXES):
        return True
    if lower in DENIED_EXACT or "cookie" in lower:
        return True
    parts = {part.lower() for part in path.parts}
    if lower in BROWSER_PROFILE_FILES and parts & BROWSER_DIR_MARKERS:
        return True
    return False


def is_binary_or_undecodable(data: bytes) -> bool:
    if b"\x00" in data[:8192]:
        return True
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return True
    return False


def sanitize_path(path: Path | str) -> str:
    text = str(path)
    home = str(Path.home())
    user = Path.home().name
    if home and (text == home or text.startswith(home + os.sep)):
        text = "~" + text[len(home) :]
    if user:
        text = re.sub(rf"(?<=[/\\]){re.escape(user)}(?=[/\\]|$)", "[USER]", text)
    return text


def resolve_scan_roots(cli_roots: list[str] | None) -> list[Path]:
    raw: list[str] = list(SCAN_ALLOWLIST)
    env = os.environ.get("GROKBOT_SCAN_ALLOWLIST", "").strip()
    if env:
        raw.extend(part for part in env.split(os.pathsep) if part)
    if cli_roots:
        raw.extend(cli_roots)
    return [Path(part).expanduser() for part in raw]


def iter_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        if root.is_file():
            if not is_denied_path(root):
                yield root
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if is_denied_path(path):
                continue
            yield path


def read_preview(path: Path) -> tuple[str, bool] | None:
    """Return a redacted preview, or None to drop the item (fail closed)."""
    if is_denied_path(path) or artifact_type(path) != "text":
        return None
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if len(data) > MAX_TEXT_BYTES or is_binary_or_undecodable(data):
        return None
    try:
        raw = data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    result = redact(raw)
    if result.drop:
        return None
    return result.text[:12_000], result.changed


def discover(roots: list[Path]) -> list[Evidence]:
    if not roots:
        return []
    results: list[Evidence] = []
    seen_hashes: set[str] = set()
    for path in iter_files(roots):
        try:
            preview = read_preview(path)
            if preview is None:
                continue
            text, redacted = preview
            size = path.stat().st_size
            digest = sha256_file(path)
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)
            product, terms = classify(text, path.name)
            if not terms and product == "shared":
                product, terms = classify("", path.name)
            if product == "shared" and not terms:
                continue
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
            results.append(Evidence(
                id=f"sha256:{digest}",
                path=sanitize_path(path.resolve()),
                artifact_type=artifact_type(path),
                product=product,
                size=size,
                modified_at=modified,
                content_hash=digest,
                matched_terms=terms,
                preview=text,
                secret_redacted=redacted,
            ))
        except (OSError, PermissionError):
            continue
    return sorted(results, key=lambda item: (item.product, item.modified_at), reverse=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover [REDACTED] ecosystem artifacts for Grokbot.")
    parser.add_argument(
        "--root",
        action="append",
        dest="roots",
        default=[],
        help="Allowlisted repo/workspace path to scan; repeatable. Empty default: scan nothing.",
    )
    parser.add_argument("--write-dir", default=".grokbot/evidence", help="Directory for generated manifest and redacted previews.")
    parser.add_argument("--max-results", type=int, default=1000)
    parser.add_argument("--json", action="store_true", help="Print JSON manifest to stdout.")
    args = parser.parse_args()

    roots = resolve_scan_roots(args.roots)
    records = discover(roots)[: args.max_results]
    manifest = {
        "schema": "grokbot-evidence/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "roots": [sanitize_path(path.resolve()) if path.exists() else sanitize_path(path) for path in roots],
        "count": len(records),
        "records": [asdict(record) for record in records],
    }

    if args.json:
        print(json.dumps(manifest, indent=2))
        return 0

    if not roots:
        print("No scan roots allowlisted; nothing was scanned.")
        return 0

    out = Path(args.write_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

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
