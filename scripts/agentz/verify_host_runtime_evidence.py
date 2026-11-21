#!/usr/bin/env python3
"""Offline, fail-closed comparison of protected ARM64 image and host runtime.

Inputs must be independently retrieved from the GitHub protected image-build
draft release and authenticated, fresh host-preflight job, respectively. This
does not authorize deployment, trading, or claim cryptographic host signing.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

SHA = re.compile(r"^[0-9a-f]{64}$")
IMAGE = re.compile(r"^sha256:[0-9a-f]{64}$")
SOURCE = re.compile(r"^[0-9a-f]{40}$")


class EvidenceHold(ValueError):
    pass


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise EvidenceHold(reason)


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def timestamp(value: str) -> dt.datetime:
    require(isinstance(value, str) and len(value) >= 20, "UTC timestamp missing")
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EvidenceHold("malformed timestamp") from exc
    require(result.tzinfo is not None, "timezone offset required")
    return result.astimezone(dt.timezone.utc)


def read_report(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").strip()
    if text.startswith("AGENTZ_RUNTIME_PREFLIGHT="):
        text = text.split("=", 1)[1]
    result = json.loads(text)
    require(isinstance(result, dict), "runtime report not a JSON object")
    return result


def compare(build: dict, report: dict, artifact_sha: str, receipt_sha: str,
            *, receipt_path: Path, archive_path: Path,
            now: dt.datetime, max_age: int = 600) -> dict:
    require(SHA.fullmatch(artifact_sha) is not None, "invalid approved archive SHA-256")
    require(SHA.fullmatch(receipt_sha) is not None, "invalid approved receipt SHA-256")
    require(digest(receipt_path) == receipt_sha, "release.json asset digest mismatch")
    require(digest(archive_path) == artifact_sha, "ARM64 image archive bytes mismatch")
    require(build.get("sha256") == artifact_sha, "archive digest differs from release.json")
    require(SOURCE.fullmatch(build.get("source_sha") or "") is not None,
            "protected source SHA missing")
    require(build.get("platform") == "linux/arm64", "protected build is not ARM64")
    require(IMAGE.fullmatch(build.get("image_id") or "") is not None,
            "protected Docker image ID invalid")
    require(build.get("filename") == archive_path.name,
            "archive filename does not match release.json")

    require(report.get("schema") == "authichain.agentz.local-runtime-preflight/1",
            "unexpected runtime report schema")
    require(report.get("result") == "LOCAL_ORIGIN_HEALTH_PROVEN",
            "host-local origin health not proven")
    require(report.get("process_count") == 1 and
            isinstance(report.get("api_pid"), int) and report["api_pid"] > 0,
            "single serving uvicorn process not established")
    require(report.get("process_identity_stable") is True,
            "PID reuse or unstable start ticks")
    require(isinstance(report.get("process_start_ticks"), int) and
            report["process_start_ticks"] > 0, "kernel start ticks absent")
    require(report.get("container_probe") == "unique-pid-namespace-match",
            "container identity unavailable or ambiguous")
    require(report.get("container_image_id") == build["image_id"],
            "running image ID differs from the protected build")
    require(report.get("image_source_revision_label") == build["source_sha"],
            "running image OCI source revision differs from protected commit")
    require(report.get("app_source_mount_shadowed") is False,
            "untrusted mount may shadow loaded application code")
    require(report.get("health_http_status") == 200 and
            report.get("health_json_valid") is True and
            SHA.fullmatch(report.get("health_response_sha256") or "") is not None,
            "fresh JSON health receipt invalid")
    require(report.get("architecture") in ("aarch64", "arm64"),
            "unexpected host architecture")
    require(isinstance(report.get("boot_id"), str) and
            len(report["boot_id"]) >= 20, "host boot identity missing")
    require(isinstance(report.get("github_run_id"), str) and
            report["github_run_id"].isdigit(), "host GitHub run ID missing")

    observed = timestamp(report.get("observed_at_utc"))
    process_start = timestamp(report.get("process_start_time_utc"))
    container_start = timestamp(report.get("container_started_at_utc"))
    age = (now.astimezone(dt.timezone.utc) - observed).total_seconds()
    require(-30 <= age <= max_age, "runtime observation stale or future-dated")
    require(container_start <= observed and process_start <= observed,
            "process/container start is later than observation")
    require(container_start - dt.timedelta(seconds=5) <= process_start,
            "PID predates container creation: identity mismatch")

    return {
        "verdict": "IMAGE_AND_RUNTIME_EVIDENCE_MATCHED_NOT_SIGNED",
        "source_sha": build["source_sha"],
        "image_id": build["image_id"],
        "image_archive_sha256": artifact_sha,
        "image_receipt_sha256": receipt_sha,
        "runtime_report_sha256": hashlib.sha256(
            json.dumps(report, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "host_run_id": report["github_run_id"],
        "host": report.get("host"),
        "pid": report["api_pid"],
        "process_start_utc": process_start.isoformat(),
        "container_started_at_utc": container_start.isoformat(),
        "observed_at_utc": observed.isoformat(),
        "freshness_seconds": round(age, 3),
        "host_signed": False,
        "permission_to_trade": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release-json", type=Path, required=True)
    parser.add_argument("--release-json-sha256", required=True)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--runtime-report", type=Path, required=True)
    parser.add_argument("--max-age-seconds", type=int, default=600)
    args = parser.parse_args()
    try:
        require(0 < args.max_age_seconds <= 3600, "invalid freshness bound")
        build = json.loads(args.release_json.read_text(encoding="utf-8"))
        require(isinstance(build, dict), "release.json is not an object")
        report = read_report(args.runtime_report)
        result = compare(
            build, report, args.archive_sha256, args.release_json_sha256,
            receipt_path=args.release_json, archive_path=args.archive,
            now=dt.datetime.now(dt.timezone.utc), max_age=args.max_age_seconds
        )
        print(json.dumps(result, sort_keys=True))
        return 0
    except (EvidenceHold, ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({
            "verdict": "HOLD", "reason": str(exc)[:220],
            "host_signed": False, "permission_to_trade": False
        }, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
