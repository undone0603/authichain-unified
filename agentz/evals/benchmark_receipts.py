#!/usr/bin/env python3
"""Offline paired benchmark for AgentZ. No network, model calls, or mutations.

This checks the structure and scoring of evidence references; it DOES NOT
cryptographically validate receipts or establish independent provenance.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

CATEGORIES = ("planning", "coding", "recovery", "tool_use", "long_horizon")
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _valid_number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def validate(row: object, line: int) -> dict:
    if not isinstance(row, dict):
        raise ValueError(f"line {line}: expected JSON object")
    for field in ("task_id", "seed", "category", "variant", "source_sha", "evidence_sha256"):
        if not isinstance(row.get(field), str) or not row[field]:
            raise ValueError(f"line {line}: invalid or missing {field}")
    if row["category"] not in CATEGORIES or row["variant"] not in ("baseline", "candidate"):
        raise ValueError(f"line {line}: unknown category or variant")
    if not SHA40.fullmatch(row["source_sha"]) or not SHA256.fullmatch(row["evidence_sha256"]):
        raise ValueError(f"line {line}: source/evidence digest must have exact expected hex length")
    if type(row.get("passed")) is not bool:
        raise ValueError(f"line {line}: passed must be Boolean")
    for field in ("latency_ms", "cost_usd", "security_violations"):
        if not _valid_number(row.get(field)):
            raise ValueError(f"line {line}: {field} must be a finite nonnegative number")
    if type(row["security_violations"]) is not int:
        raise ValueError(f"line {line}: security_violations must be integer")
    return row


def summarize(records: list[dict]) -> dict:
    if not records:
        raise ValueError("empty benchmark")
    pairs = defaultdict(dict)
    revisions = defaultdict(set)
    for index, record in enumerate(records, start=1):
        row = validate(record, index)
        key = (row["category"], row["task_id"], row["seed"])
        variant = row["variant"]
        if variant in pairs[key]:
            raise ValueError(f"duplicate task/seed/variant at line {index}")
        pairs[key][variant] = row
        revisions[variant].add(row["source_sha"])
    if any(len(shas) != 1 for shas in revisions.values()) or set(revisions) != {"baseline", "candidate"}:
        raise ValueError("each variant requires exactly one pinned source SHA")
    for key, pair in pairs.items():
        if set(pair) != {"baseline", "candidate"}:
            raise ValueError(f"unpaired task: {key}")
    metrics = {v: {"attempts": 0, "passes": 0, "cost_usd": 0.0, "latency_ms": 0.0, "security_violations": 0}
               for v in ("baseline", "candidate")}
    by_category = {cat: {v: {"attempts": 0, "passes": 0} for v in metrics} for cat in CATEGORIES}
    gains, regressions = 0, 0
    for (category, _task, _seed), pair in sorted(pairs.items()):
        if pair["candidate"]["passed"] and not pair["baseline"]["passed"]:
            gains += 1
        if pair["baseline"]["passed"] and not pair["candidate"]["passed"]:
            regressions += 1
        for variant, row in pair.items():
            m = metrics[variant]
            m["attempts"] += 1
            m["passes"] += int(row["passed"])
            m["cost_usd"] += row["cost_usd"]
            m["latency_ms"] += row["latency_ms"]
            m["security_violations"] += row["security_violations"]
            by_category[category][variant]["attempts"] += 1
            by_category[category][variant]["passes"] += int(row["passed"])
    for m in metrics.values():
        m["pass_rate"] = round(m["passes"] / m["attempts"], 6)
        m["mean_latency_ms"] = round(m.pop("latency_ms") / m["attempts"], 3)
        m["cost_usd"] = round(m["cost_usd"], 6)
        m["cost_per_pass_usd"] = round(m["cost_usd"] / m["passes"], 6) if m["passes"] else None
    covered = [c for c in CATEGORIES if by_category[c]["baseline"]["attempts"]]
    if len(covered) != len(CATEGORIES):
        decision = "insufficient_category_coverage"
    elif metrics["candidate"]["security_violations"] > 0 or regressions:
        decision = "regression_or_security_hold"
    elif gains == 0:
        decision = "no_measured_pass_gain"
    elif metrics["baseline"]["cost_per_pass_usd"] is not None and (
        metrics["candidate"]["cost_per_pass_usd"] > metrics["baseline"]["cost_per_pass_usd"]
    ):
        decision = "cost_regression_hold"
    else:
        decision = "eligible_for_independent_review"
    return {
        "schema_version": 1,
        "evidence_verification": "NOT_PERFORMED - hashes are references, not proof; verify originals independently",
        "source_shas": {k: next(iter(v)) for k, v in revisions.items()},
        "paired_tasks": len(pairs),
        "categories_covered": covered,
        "pass_gains": gains,
        "pass_regressions": regressions,
        "metrics": metrics,
        "by_category": by_category,
        "decision": decision,
        "deployment_authorized": False,
    }


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipts", type=Path, help="local paired JSONL input")
    args = parser.parse_args()
    try:
        result = summarize(load_jsonl(args.receipts))
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"benchmark invalid: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
