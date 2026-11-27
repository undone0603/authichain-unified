#!/usr/bin/env python3
"""Pattern Atlas: bounded, offline exploration of reversible patterns and evidence.

No network access, process execution, attestations, or automatic claims of causation.
Python 3.10+ (uses only the standard library).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date, datetime, timezone
from itertools import combinations
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "pattern-atlas/v1"
RULES_VERSION = "1.0.0"
MAX_FACTS = 100
MAX_SOURCES = 4
MAX_SNAPSHOT_BYTES = 256 * 1024
MAX_CANDIDATES = 300


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def checked_date(value: str) -> date:
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            fail(f"date must be YYYY-MM-DD: {value!r}")
        return parsed
    except (TypeError, ValueError):
        fail(f"invalid ISO calendar date: {value!r}")


def fact_mentions_value(kind: str, value: str, quote: str) -> bool:
    if kind == "year":
        return bool(re.search(r"(?<!\d)" + re.escape(value) + r"(?!\d)", quote))
    if kind == "word":
        return bool(re.search(r"\b" + re.escape(value) + r"\b", quote, re.IGNORECASE))
    d = checked_date(value)
    forms = [
        d.isoformat(), f"{d.month}/{d.day}/{d.year}", f"{d.day}/{d.month}/{d.year}",
        f"{d.month:02}/{d.day:02}/{d.year}", f"{d.day:02}/{d.month:02}/{d.year}",
        f"{d.strftime('%B')} {d.day}, {d.year}",
        f"{d.day} {d.strftime('%B')} {d.year}",
    ]
    return any(re.search(r"(?<!\w)" + re.escape(s) + r"(?!\w)", quote, re.IGNORECASE) for s in forms)


def validate_facts(payload: dict) -> list[dict]:
    if not isinstance(payload, dict) or payload.get("schema") != SCHEMA:
        fail(f"input schema must be {SCHEMA}")
    facts = payload.get("facts")
    if not isinstance(facts, list) or not 1 <= len(facts) <= MAX_FACTS:
        fail(f"facts must be an array of 1..{MAX_FACTS} records")
    ids: set[str] = set()
    for f in facts:
        if not isinstance(f, dict) or not isinstance(f.get("id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", f["id"]):
            fail("each fact requires a safe id (1..64 ASCII letters/numbers/_/-)")
        if f["id"] in ids:
            fail(f"duplicate fact id {f['id']}")
        ids.add(f["id"])
        kind, value = f.get("kind"), f.get("value")
        if kind not in {"date", "year", "word"} or not isinstance(value, str):
            fail(f"{f['id']}: kind must be date/year/word and value a string")
        if kind == "date":
            checked_date(value)
        elif kind == "year":
            if not re.fullmatch(r"[12][0-9]{3}", value):
                fail(f"{f['id']}: year must be a four-digit year 1000..2999")
        elif not re.fullmatch(r"[A-Za-z]{2,64}", value):
            fail(f"{f['id']}: word must be 2..64 ASCII letters")
        if not isinstance(f.get("claim"), str) or not 1 <= len(f["claim"]) <= 300:
            fail(f"{f['id']}: claim must be text of 1..300 characters")
        if f.get("provenance", "unspecified") not in {"self_reported", "unspecified"}:
            fail(f"{f['id']}: unknown provenance")
        sources = f.get("sources", [])
        if not isinstance(sources, list) or len(sources) > MAX_SOURCES:
            fail(f"{f['id']}: sources must have <= {MAX_SOURCES} records")
    return facts


def verify_sources(fact: dict, evidence_root: Path) -> dict:
    checked = []
    domains: set[str] = set()
    for s in fact.get("sources", []):
        if not isinstance(s, dict):
            fail(f"{fact['id']}: a source must be an object")
        url, rel, quote = s.get("url"), s.get("snapshot"), s.get("quote")
        if not all(isinstance(v, str) and v for v in (url, rel, quote)):
            fail(f"{fact['id']}: source requires url, snapshot, and quote")
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port:
            fail(f"{fact['id']}: invalid HTTPS source URL")
        if parsed.query or parsed.fragment:
            fail(f"{fact['id']}: source URLs must not contain query strings or fragments")
        p = Path(rel)
        if p.is_absolute() or ".." in p.parts or p.is_symlink():
            fail(f"{fact['id']}: unsafe snapshot path")
        resolved = (evidence_root / p).resolve()
        if not resolved.is_relative_to(evidence_root) or not resolved.is_file():
            fail(f"{fact['id']}: missing or unsafe snapshot")
        if resolved.stat().st_size > MAX_SNAPSHOT_BYTES:
            fail(f"{fact['id']}: snapshot exceeds size limit")
        raw = resolved.read_bytes()
        try:
            body = raw.decode("utf-8")
        except UnicodeDecodeError:
            fail(f"{fact['id']}: source snapshot must be UTF-8")
        matched = quote in body and fact_mentions_value(fact["kind"], fact["value"], quote)
        domain = parsed.hostname.lower()
        if matched:
            domains.add(domain)
        checked.append({
            "url": url, "domain": domain, "snapshot": rel,
            "snapshot_sha256": sha256(raw), "quote_sha256": sha256(quote.encode("utf-8")),
            "exact_quote_and_value_match": matched,
        })
    valid = sum(1 for s in checked if s["exact_quote_and_value_match"])
    if checked and valid != len(checked):
        status = "source_mismatch" if valid == 0 else "partial_source_mismatch"
    elif len(domains) >= 2:
        status = "multi_domain_snapshot_match"
    elif valid:
        status = "single_snapshot_match"
    elif fact.get("provenance") == "self_reported":
        status = "self_reported_only"
    else:
        status = "unsupported"
    return {
        "id": fact["id"], "kind": fact["kind"], "value": fact["value"],
        "claim": fact["claim"], "verification_status": status,
        "sources": checked, "matched_domains": sorted(domains),
        "remote_authenticity_verified": False,
    }


def step(operation: str, input_value: str, output_value: str) -> dict:
    return {"operation": operation, "input": input_value, "output": output_value}


def candidate(rule: str, ids: list[str], steps: list[dict], detail: str) -> dict:
    core = {"rule_id": rule, "rule_version": RULES_VERSION, "fact_ids": sorted(ids),
            "transformations": steps, "observation": detail}
    return {"id": sha256(canonical_bytes(core))[:20], **core,
            "exploratory_not_causal": True, "statistical_significance": "not_assessed"}


def discover(facts: list[dict], as_of: date | None) -> list[dict]:
    results = []
    for a, b in combinations(sorted(facts, key=lambda x: x["id"]), 2):
        if a["kind"] == b["kind"] == "word":
            al, bl = a["value"].casefold(), b["value"].casefold()
            if al != bl and sorted(al) == sorted(bl):
                results.append(candidate("anagram", [a["id"], b["id"]],
                    [step("casefold_sort_letters", a["value"], "".join(sorted(al))),
                     step("casefold_sort_letters", b["value"], "".join(sorted(bl)))],
                    "The words contain the same letter multiset."))
            if al == bl[::-1] and al != bl:
                results.append(candidate("reverse_word", [a["id"], b["id"]],
                    [step("reverse_text", a["value"], al[::-1])], "One word reverses to the other."))
        if a["kind"] == b["kind"] == "date":
            da, db = checked_date(a["value"]), checked_date(b["value"])
            if (da.month, da.day) == (db.month, db.day) and da != db:
                results.append(candidate("shared_month_day", [a["id"], b["id"]],
                    [step("extract_month_day", a["value"], f"{da.month:02}-{da.day:02}"),
                     step("extract_month_day", b["value"], f"{db.month:02}-{db.day:02}")],
                    "Different dates share the same month and day."))
        for y, d in ((a, b), (b, a)):
            if y["kind"] != "year" or d["kind"] != "date":
                continue
            dt = checked_date(d["value"])
            reversed_year = y["value"][::-1]
            day_first = f"{dt.day}{dt.month}{dt.year % 100:02d}"
            if reversed_year == day_first:
                results.append(candidate("reverse_year_to_day_first_date", [y["id"], d["id"]],
                    [step("reverse_digits", y["value"], reversed_year),
                     step("format_D_M_YY_no_padding", d["value"], day_first)],
                    "The reversed year matches an unpadded day-first short date; formatting is a selected convention."))
    if as_of is not None:
        for f in facts:
            if f["kind"] != "date":
                continue
            d = checked_date(f["value"])
            years = as_of.year - d.year
            if years > 0 and (as_of.month, as_of.day) == (d.month, d.day) and (d.year % 100) == years:
                results.append(candidate("anniversary_age_equals_year_suffix", [f["id"]],
                    [step("anniversary_age_on_as_of", f["value"], str(years)),
                     step("last_two_digits_of_year", f["value"], str(d.year % 100))],
                    "Completed anniversary count equals the event year's last two digits."))
    return sorted(results, key=lambda c: (c["rule_id"], c["fact_ids"], c["id"]))[:MAX_CANDIDATES]


def analyze(payload: dict, evidence_root: Path) -> dict:
    facts = validate_facts(payload)
    as_of = checked_date(payload["as_of"]) if payload.get("as_of") is not None else None
    verified = [verify_sources(f, evidence_root.resolve()) for f in facts]
    candidates = discover(facts, as_of)
    statuses = {f["id"]: f["verification_status"] for f in verified}
    for c in candidates:
        c["fact_evidence_status"] = {i: statuses[i] for i in c["fact_ids"]}
    core = {"schema": SCHEMA, "rules_version": RULES_VERSION, "as_of": as_of.isoformat() if as_of else None,
            "input_sha256": sha256(canonical_bytes(payload)), "facts": verified, "candidates": candidates,
            "limitations": [
                "Patterns are candidates, not causal explanations or proof of coordination.",
                "Source matching checks operator-provided local snapshots, not remote authorship or independent authenticity.",
                "Two domains are not necessarily independent publishers; external verification remains necessary.",
                "No multiple-comparison correction or calibrated probability is computed.",
            ]}
    return {**core, "analysis_sha256": sha256(canonical_bytes(core)),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Offline experimental pattern discovery with evidence provenance")
    parser.add_argument("input", type=Path, help="JSON document with schema pattern-atlas/v1")
    parser.add_argument("--output", type=Path, help="Write result to JSON; stdout otherwise")
    args = parser.parse_args(argv)
    try:
        raw = args.input.read_bytes()
        if len(raw) > 1_000_000:
            fail("input exceeds 1MB")
        payload = json.loads(raw)
        report = analyze(payload, args.input.resolve().parent)
        rendered = json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"pattern-atlas: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
