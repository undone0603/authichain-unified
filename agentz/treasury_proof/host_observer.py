"""Root-controlled independent Docker/OS host observation, without wallet keys.

This program is a manual, root-only host probe. It produces a receipt, never
claims production deployment or wallet spending authority. It will HOLD unless
an authenticated GitHub draft release receipt and matching archive are present
locally, Docker exposes one unshadowed matching process, and loopback health
is proven. The caller must supply the SHA-256 of release.json independently
retrieved from GitHub asset metadata, not from this repository or the host.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import urllib.request

REPO = "undone0603/authichain-unified"
COMMIT = re.compile(r"[a-f0-9]{40}\Z")
SHA = re.compile(r"[a-f0-9]{64}\Z")
IMAGE = re.compile(r"sha256:[a-f0-9]{64}\Z")

class HostHold(Exception):
    """No claim of host identity or protected artifact match is permitted."""

def require(condition: bool, why: str) -> None:
    if not condition:
        raise HostHold(why)

def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()

def docker_json(*arguments: str) -> object:
    try:
        proc = subprocess.run(["docker", *arguments], capture_output=True,
                              text=True, check=True, timeout=8)
        return json.loads(proc.stdout)
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise HostHold("trusted Docker inspection unavailable") from exc

def protected_receipt(archive: Path, release_json: Path,
                      github_asset_sha256: str) -> dict:
    require(bool(SHA.fullmatch(github_asset_sha256)), "invalid GitHub release.json SHA-256")
    require(digest(release_json) == github_asset_sha256, "release.json GitHub asset digest mismatch")
    evidence = json.loads(release_json.read_bytes())
    require(isinstance(evidence, dict) and evidence.get("repository") == REPO and
            evidence.get("platform") == "linux/arm64" and
            bool(COMMIT.fullmatch(str(evidence.get("source_sha", "")))) and
            bool(SHA.fullmatch(str(evidence.get("sha256", "")))) and
            bool(IMAGE.fullmatch(str(evidence.get("image_id", "")))) and
            str(evidence.get("run_id", "")).isdigit() and
            evidence.get("filename") == "agentz-linux-arm64.tar.gz",
            "invalid protected ARM64 release receipt")
    require(digest(archive) == evidence["sha256"], "protected archive bytes mismatch")
    return evidence

def _proc_start(pid: int) -> tuple[str, int]:
    # Linux /proc/pid/stat field 22 is boot-relative; comm can contain spaces.
    parts = Path(f"/proc/{pid}/stat").read_text().rsplit(") ", 1)[1].split()
    ticks = int(parts[19])
    boot = int(next(x.split()[1] for x in Path("/proc/stat").read_text().splitlines()
                    if x.startswith("btime ")))
    dt = datetime.fromtimestamp(boot + ticks / os.sysconf("SC_CLK_TCK"), timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ"), ticks

def observe_live(evidence: dict) -> dict:
    require(os.geteuid() == 0, "trusted root host probe required")
    try:
        listed = subprocess.run(["docker", "ps", "-q", "--no-trunc"], check=True,
                                timeout=8, capture_output=True, text=True).stdout.splitlines()
    except (OSError, subprocess.SubprocessError) as exc:
        raise HostHold("running-container inventory unavailable") from exc
    require(0 < len(listed) <= 128, "ambiguous or unbounded running-container inventory")
    matches = []
    for container_id in listed:
        data = docker_json("inspect", container_id)[0]
        if data.get("Image") == evidence["image_id"] and data.get("State", {}).get("Running"):
            matches.append(data)
    require(len(matches) == 1, "no uniquely running protected image")
    container = matches[0]
    image = docker_json("image", "inspect", evidence["image_id"])[0]
    labels = (image.get("Config") or {}).get("Labels") or {}
    require(labels.get("org.opencontainers.image.revision") == evidence["source_sha"],
            "live image source revision differs from protected source")
    require(not any(str(m.get("Destination", "")).rstrip("/") in ("/app", "/app/agentz")
                    or str(m.get("Destination", "")).startswith("/app/agentz/")
                    for m in container.get("Mounts", [])), "application source shadowed by mount")
    pid = container.get("State", {}).get("Pid")
    require(type(pid) is int and pid > 1, "invalid running host PID")
    before, ticks_before = _proc_start(pid)
    command = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\x00", b" ")
    require(b"uvicorn" in command and b"agentz.api.main:app" in command,
            "container PID not mapped to expected FastAPI")
    bindings = ((container.get("NetworkSettings") or {}).get("Ports") or {}).get("8000/tcp") or []
    require(len(bindings) == 1 and bindings[0].get("HostIp") == "127.0.0.1",
            "origin must have a unique loopback health binding")
    port = bindings[0].get("HostPort")
    require(str(port).isdigit() and 0 < int(port) <= 65535, "invalid health binding")
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=4) as response:
            health_status, data = response.status, response.read(65537)
        require(health_status == 200 and len(data) <= 65536 and
                isinstance(json.loads(data), dict), "unhealthy or malformed origin")
    except (OSError, ValueError) as exc:
        raise HostHold("origin loopback health failed") from exc
    after, ticks_after = _proc_start(pid)
    require(ticks_before == ticks_after, "PID changed during health observation")
    return {"pid": pid, "start_time_utc": after,
            "image_id": evidence["image_id"], "health_status": "healthy"}

def capture(archive: Path, release_json: Path, github_asset_sha256: str,
            observer_dir: Path, observer_gid: int) -> dict:
    evidence = protected_receipt(archive, release_json, github_asset_sha256)
    observed = observe_live(evidence)
    meta = observer_dir.lstat()
    require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0 and
            meta.st_gid == observer_gid and stat.S_IMODE(meta.st_mode) == 0o750,
            "observer directory requires root:observer 0750")
    receipt = {
        "observation_id": "host-" + secrets.token_hex(16),
        "observed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "host_process": observed,
        "provenance": {"source_sha": evidence["source_sha"],
                       "artifact_sha256": evidence["sha256"]},
    }
    raw = json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode()
    temporary = observer_dir / (".receipt-" + secrets.token_hex(16))
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                 os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    try:
        os.fchown(fd, 0, observer_gid)
        os.fchmod(fd, 0o640)
        if os.write(fd, raw) != len(raw):
            raise HostHold("short observer receipt write")
        os.fsync(fd)
    finally:
        os.close(fd)
    try:
        os.replace(temporary, observer_dir / "receipt.json")
        dirfd = os.open(observer_dir, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    return {"status": "ROOT_OBSERVATION_ONLY_NOT_ATTESTED",
            "observation_id": receipt["observation_id"],
            "observation_sha256": hashlib.sha256(raw).hexdigest(),
            "observed_host_pid": observed["pid"],
            "observed_image_id": observed["image_id"],
            "signer_authority_verified": False, "spend_authorized": False}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--release-json", type=Path, required=True)
    parser.add_argument("--github-receipt-sha256", required=True)
    parser.add_argument("--observer-dir", type=Path, required=True)
    parser.add_argument("--observer-gid", type=int, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(capture(args.archive, args.release_json, args.github_receipt_sha256,
                                 args.observer_dir, args.observer_gid), sort_keys=True))
    except (HostHold, OSError, ValueError, TypeError, KeyError, IndexError) as exc:
        print(json.dumps({"status": "HOLD", "reason": str(exc)}))
        raise SystemExit(1)

if __name__ == "__main__":
    main()
