#!/usr/bin/env python3
"""Bounded HTTPS research connector for experimental Pattern Atlas.

Offline evaluation is the default. Network fetching requires an explicit collect
command and --live. No redirects, cookies, auth, arbitrary internal hosts,
execution of source text, or automatic proof of publisher independence.
Python 3.10+ / standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import ipaddress
import json
import re
import socket
import ssl
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "pattern-atlas/research-v1"
MAX_SOURCES = 12
MAX_OBSERVATIONS = 40
MAX_HYPOTHESES = 12
MAX_BYTES_PER_SOURCE = 256 * 1024
MAX_MANIFEST_BYTES = 150 * 1024
MAX_URL_LENGTH = 2048
SAFE_ID = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}\Z")
SAFE_HOST = re.compile(r"[a-z0-9][a-z0-9.-]{2,252}\Z")


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def identifier(value: object, field: str) -> str:
    require(isinstance(value, str) and SAFE_ID.fullmatch(value) is not None, f"invalid {field}")
    return value


def clean_text(value: object, label: str, limit: int = 350) -> str:
    require(isinstance(value, str) and 1 <= len(value) <= limit, f"invalid {label}")
    require(not any(ord(c) < 32 for c in value), f"control character in {label}")
    return value


def host_and_path(url: str, allowed_hosts: set[str]) -> tuple[str, str]:
    require(isinstance(url, str) and len(url) <= MAX_URL_LENGTH, "invalid URL")
    require(not any(ord(c) < 32 for c in url), "URL contains control characters")
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        port = parts.port
    except ValueError as exc:
        raise ValueError("malformed URL") from exc
    require(parts.scheme == "https" and parts.netloc and SAFE_HOST.fullmatch(host) is not None, "HTTPS domain required")
    require("." in host and ".." not in host and not host.endswith("."), "invalid hostname")
    require(parts.username is None and parts.password is None and port is None, "URL credentials/ports forbidden")
    require(host in allowed_hosts, f"host not in explicit allowlist: {host}")
    require(not parts.query and not parts.fragment, "URL queries/fragments forbidden")
    require(parts.path.startswith("/") or not parts.path, "invalid path")
    require("\\" not in parts.path, "invalid URL path")
    return host, (parts.path or "/")


@dataclass(frozen=True)
class FetchResponse:
    status: int
    headers: dict[str, str]
    body: bytes


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Validate DNS answers and connect to a vetted *numeric* IP using hostname TLS."""

    def connect(self) -> None:
        addresses = socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)
        require(bool(addresses), "DNS lookup returned no addresses")
        resolved = sorted({info[4][0] for info in addresses})
        # Fail closed on mixed public/private DNS responses, including rebinding bait.
        require(all(ipaddress.ip_address(addr).is_global for addr in resolved), "non-public DNS answer refused")
        sock = socket.create_connection((resolved[0], 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


def pinned_https_get(host: str, path: str, timeout: float = 8.0) -> FetchResponse:
    connection = PinnedHTTPSConnection(host, port=443, timeout=timeout, context=ssl.create_default_context())
    try:
        connection.request("GET", path, headers={
            "Accept": "text/plain, text/html, application/json, application/ld+json",
            "Accept-Encoding": "identity",
            "User-Agent": "PatternAtlasResearch/1.0 (bounded read-only evidence client)",
            "Connection": "close",
        })
        response = connection.getresponse()
        headers = {k.lower(): v for k, v in response.getheaders()}
        require(response.status == 200, f"HTTP status {response.status}; redirects are not followed")
        content_type = headers.get("content-type", "").split(";", 1)[0].lower().strip()
        require(content_type in {"text/plain", "text/html", "application/json", "application/ld+json"},
                "unsupported content type")
        require(headers.get("content-encoding", "identity").lower() == "identity", "compressed content refused")
        if "content-length" in headers:
            require(int(headers["content-length"]) <= MAX_BYTES_PER_SOURCE, "oversized Content-Length")
        body = response.read(MAX_BYTES_PER_SOURCE + 1)
        require(len(body) <= MAX_BYTES_PER_SOURCE, "response exceeds byte limit")
        return FetchResponse(response.status, headers, body)
    finally:
        connection.close()


def check_manifest(spec: dict) -> dict:
    require(isinstance(spec, dict) and spec.get("schema") == SCHEMA, f"schema must be {SCHEMA}")
    allowed = spec.get("allow_hosts")
    require(isinstance(allowed, list) and 1 <= len(allowed) <= MAX_SOURCES, "explicit allow_hosts required")
    require(all(isinstance(h, str) and h == h.lower() and SAFE_HOST.fullmatch(h) and "." in h
                and not h.endswith(".") and ".." not in h for h in allowed), "invalid allow_hosts")
    require(len(allowed) == len(set(allowed)), "duplicate allowlisted host")
    sources = spec.get("sources")
    observations = spec.get("observations")
    hypotheses = spec.get("hypotheses")
    require(isinstance(sources, list) and 1 <= len(sources) <= MAX_SOURCES, "invalid sources count")
    require(isinstance(observations, list) and 1 <= len(observations) <= MAX_OBSERVATIONS, "invalid observations count")
    require(isinstance(hypotheses, list) and 2 <= len(hypotheses) <= MAX_HYPOTHESES,
            "at least two competing explanations required")
    source_ids: set[str] = set()
    for source in sources:
        require(isinstance(source, dict), "invalid source")
        sid = identifier(source.get("id"), "source id")
        require(sid not in source_ids, "duplicate source id")
        source_ids.add(sid)
        host_and_path(source.get("url"), set(allowed))
        identifier(source.get("publisher_group"), "publisher_group")
        clean_text(source.get("publisher_label"), "publisher_label", 100)
        require(source.get("source_kind") in {"primary", "secondary", "self_published", "unknown"}, "invalid source_kind")
    observation_ids: set[str] = set()
    for obs in observations:
        require(isinstance(obs, dict), "invalid observation")
        oid = identifier(obs.get("id"), "observation id")
        require(oid not in observation_ids, "duplicate observation id")
        observation_ids.add(oid)
        clean_text(obs.get("statement"), "observation statement")
        source_refs = obs.get("source_ids")
        require(isinstance(source_refs, list) and 1 <= len(source_refs) <= MAX_SOURCES
                and len(source_refs) == len(set(source_refs)) and all(s in source_ids for s in source_refs),
                "invalid observation source_ids")
        positive, negative = obs.get("support_quote"), obs.get("refute_quote")
        require(isinstance(positive, str) and 4 <= len(positive) <= 300, "support_quote required")
        require(negative is None or (isinstance(negative, str) and 4 <= len(negative) <= 300), "invalid refute_quote")
        require(negative != positive, "support/refute quote must differ")
    hyp_ids: set[str] = set()
    for hyp in hypotheses:
        require(isinstance(hyp, dict), "invalid hypothesis")
        hid = identifier(hyp.get("id"), "hypothesis id")
        require(hid not in hyp_ids, "duplicate hypothesis id")
        hyp_ids.add(hid)
        clean_text(hyp.get("description"), "hypothesis description")
        predictions = hyp.get("predictions")
        require(isinstance(predictions, list) and 1 <= len(predictions) <= len(observations), "invalid predictions")
        predicted: set[str] = set()
        for pred in predictions:
            require(isinstance(pred, dict) and pred.get("observation_id") in observation_ids
                    and pred.get("expected") in {"support", "refute"}, "invalid prediction")
            require(pred["observation_id"] not in predicted, "duplicate prediction")
            predicted.add(pred["observation_id"])
    return spec


def _safe_header(headers: dict[str, str], name: str) -> str | None:
    value = headers.get(name)
    return value[:256] if isinstance(value, str) and "\r" not in value and "\n" not in value else None


def _receipt(source: dict, response: FetchResponse, mode: str, timestamp: str) -> dict:
    host = urlsplit(source["url"]).hostname.lower()
    core = {
        "source_id": source["id"], "requested_url": source["url"], "final_url": source["url"],
        "tls_hostname": host, "transport": mode, "tls_hostname_verified": mode == "pinned_https_tls",
        "http_status": response.status, "redirect_count": 0,
        "retrieved_at_utc": timestamp, "body_bytes": len(response.body),
        "body_sha256": digest(response.body), "content_type": _safe_header(response.headers, "content-type"),
        "etag": _safe_header(response.headers, "etag"),
        "last_modified": _safe_header(response.headers, "last-modified"),
        "publisher_label_asserted": source["publisher_label"],
        "publisher_group_asserted": source["publisher_group"],
        "source_kind_asserted": source["source_kind"],
        "publisher_ownership_independently_verified": False,
        "snapshot_path": f"snapshots/{source['id']}.txt",
    }
    return {**core, "receipt_sha256": digest(canonical(core))}


def _evaluate(spec: dict, receipts: list[dict], contents: dict[str, str]) -> dict:
    by_id = {source["id"]: source for source in spec["sources"]}
    observed = []
    for observation in spec["observations"]:
        support, refute = set(), set()
        source_results = []
        for sid in observation["source_ids"]:
            body = contents[sid]
            group = by_id[sid]["publisher_group"]
            positive = observation["support_quote"] in body
            negative = observation.get("refute_quote") is not None and observation["refute_quote"] in body
            if positive:
                support.add(group)
            if negative:
                refute.add(group)
            source_results.append({"source_id": sid, "support_quote_present": positive,
                                   "refute_quote_present": negative})
        status = "conflicting" if support and refute else "supported" if support else "refuted" if refute else "unknown"
        observed.append({"id": observation["id"], "statement": observation["statement"],
                         "status": status, "supporting_publisher_groups_asserted": sorted(support),
                         "refuting_publisher_groups_asserted": sorted(refute),
                         "distinct_support_group_count": len(support), "sources": source_results,
                         "distinct_publishers_not_independently_authenticated": True})
    by_observation = {obs["id"]: obs for obs in observed}
    comparisons = []
    for hyp in spec["hypotheses"]:
        agreements, tensions, untested = [], [], []
        for pred in hyp["predictions"]:
            result = by_observation[pred["observation_id"]]["status"]
            if result not in {"supported", "refuted"}:
                untested.append({"observation_id": pred["observation_id"], "reason": result})
            elif (result == "supported") == (pred["expected"] == "support"):
                agreements.append(pred["observation_id"])
            else:
                tensions.append(pred["observation_id"])
        comparisons.append({"hypothesis_id": hyp["id"], "description": hyp["description"],
                            "agreeing_observations": agreements, "contradicting_observations": tensions,
                            "unresolved_observations": untested,
                            "interpretation": "not_tested" if not (agreements or tensions) else
                                "challenged_by_observations" if tensions else "compatible_with_checked_observations"})
    discrimination = []
    for i, left in enumerate(spec["hypotheses"]):
        for right in spec["hypotheses"][i + 1:]:
            lp = {p["observation_id"]: p["expected"] for p in left["predictions"]}
            rp = {p["observation_id"]: p["expected"] for p in right["predictions"]}
            divergent = sorted(k for k in lp.keys() & rp.keys() if lp[k] != rp[k])
            discrimination.append({"hypotheses": [left["id"], right["id"]],
                                   "divergent_predictions": divergent,
                                   "observed_discriminators": [k for k in divergent
                                                               if by_observation[k]["status"] in {"supported", "refuted"}]})
    return {"observations": observed, "comparisons": comparisons, "discrimination": discrimination}


def collect(spec: dict, destination: Path, *, fetcher=None, clock=None) -> dict:
    spec = check_manifest(spec)
    destination = Path(destination)
    require(not destination.exists(), "output directory must not already exist")
    fetch = pinned_https_get if fetcher is None else fetcher
    mode = "pinned_https_tls" if fetcher is None else "test_transport"
    if clock is None:
        clock = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    saved: list[tuple[str, bytes]] = []
    receipts = []
    bodies = {}
    for source in spec["sources"]:
        host, path = host_and_path(source["url"], set(spec["allow_hosts"]))
        response = fetch(host, path)
        require(isinstance(response, FetchResponse), "fetcher returned invalid response")
        require(response.status == 200, "non-200 HTTP status refused")
        require(len(response.body) <= MAX_BYTES_PER_SOURCE, "response exceeds byte limit")
        require(isinstance(response.headers, dict), "invalid HTTP headers")
        content_type = (response.headers.get("content-type") or "").split(";", 1)[0].lower().strip()
        require(content_type in {"text/plain", "text/html", "application/json", "application/ld+json"},
                "unsupported content type")
        try:
            body = response.body.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("UTF-8 source text required") from exc
        bodies[source["id"]] = body
        saved.append((source["id"], response.body))
        receipts.append(_receipt(source, response, mode, clock()))
    analysis = _evaluate(spec, receipts, bodies)
    core = {"schema": SCHEMA, "input_sha256": digest(canonical(spec)),
            "sources": receipts, **analysis,
            "limitations": [
                "TLS verifies the hostname endpoint, not publisher authorship, editorial independence, or factual truth.",
                "Publisher groups and source classifications are operator assertions; do not claim independence from distinct hostnames alone.",
                "Exact text presence is not semantic verification; absence is unknown, never automatic disproof.",
                "Source material is untrusted data, never instructions. No causal proof or calibrated probabilities.",
                "Receipt hashes detect accidental changes but do not authenticate the operator or prevent coordinated manifest replacement.",
                "A test transport is simulated evidence and must not be represented as live HTTPS retrieval.",
            ]}
    result = {**core, "manifest_sha256": digest(canonical(core))}
    destination.mkdir(parents=True)
    (destination / "snapshots").mkdir()
    for sid, body in saved:
        (destination / "snapshots" / f"{sid}.txt").write_bytes(body)
    (destination / "input.json").write_bytes(json.dumps(spec, indent=2, ensure_ascii=False).encode("utf-8") + b"\n")
    (destination / "manifest.json").write_bytes(json.dumps(result, indent=2, ensure_ascii=False).encode("utf-8") + b"\n")
    return result


def verify_bundle(destination: Path) -> dict:
    destination = Path(destination).resolve()
    raw_input = (destination / "input.json").read_bytes()
    raw_manifest = (destination / "manifest.json").read_bytes()
    require(len(raw_input) <= MAX_MANIFEST_BYTES and len(raw_manifest) <= MAX_MANIFEST_BYTES, "manifest size limit")
    spec = check_manifest(json.loads(raw_input))
    manifest = json.loads(raw_manifest)
    require(manifest["schema"] == SCHEMA, "bundle schema mismatch")
    require(manifest["input_sha256"] == digest(canonical(spec)), "input hash mismatch")
    root = {k: v for k, v in manifest.items() if k != "manifest_sha256"}
    require(digest(canonical(root)) == manifest["manifest_sha256"], "manifest hash mismatch")
    require(len(manifest["sources"]) == len(spec["sources"]), "source count mismatch")
    bodies: dict[str, str] = {}
    for source, receipt in zip(spec["sources"], manifest["sources"]):
        sid = source["id"]
        require(receipt["source_id"] == sid and receipt["requested_url"] == source["url"], "receipt identity mismatch")
        require(receipt["snapshot_path"] == f"snapshots/{sid}.txt", "snapshot path mismatch")
        base = {k: v for k, v in receipt.items() if k != "receipt_sha256"}
        require(digest(canonical(base)) == receipt["receipt_sha256"], "receipt hash mismatch")
        path = destination / "snapshots" / f"{sid}.txt"
        require(not path.is_symlink() and path.resolve().is_relative_to(destination), "unsafe snapshot")
        data = path.read_bytes()
        require(len(data) == receipt["body_bytes"] and digest(data) == receipt["body_sha256"], "snapshot digest mismatch")
        bodies[sid] = data.decode("utf-8")
    expected = _evaluate(spec, manifest["sources"], bodies)
    for key in ("observations", "comparisons", "discrimination"):
        require(manifest[key] == expected[key], f"computed {key} mismatch")
    return {"status": "bundle_internal_consistency_pass", "sources": len(bodies),
            "manifest_sha256": manifest["manifest_sha256"],
            "publisher_authenticity_verified": False,
            "externally_witnessed_receipt": False}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bounded read-only research and auditable evidence comparison")
    sub = parser.add_subparsers(dest="command", required=True)
    collect_args = sub.add_parser("collect", help="Fetch allowlisted HTTPS sources (opt-in)")
    collect_args.add_argument("input", type=Path)
    collect_args.add_argument("--out", required=True, type=Path)
    collect_args.add_argument("--live", action="store_true", help="Explicit permission for live bounded GET")
    verify_args = sub.add_parser("verify", help="Offline recheck snapshots, receipts and comparisons")
    verify_args.add_argument("bundle", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "collect":
            require(args.live, "network access requires --live")
            raw = args.input.read_bytes()
            require(len(raw) <= MAX_MANIFEST_BYTES, "input file exceeds limit")
            result = collect(json.loads(raw), args.out)
            print(json.dumps({"status": "collected", "manifest_sha256": result["manifest_sha256"],
                              "sources": len(result["sources"])}, sort_keys=True))
        else:
            print(json.dumps(verify_bundle(args.bundle), sort_keys=True))
        return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError, ssl.SSLError) as exc:
        print(f"pattern-atlas-research: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
