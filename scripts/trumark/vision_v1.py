#!/usr/bin/env python3
"""TruMark Vision v1: local, privacy-preserving photographic intake.

Metrics and same-view similarity do NOT authenticate physical goods, issuer,
metal composition, tamper resistance or serial numbers. No OCR/network calls.

Requires opencv-python and numpy. Use only authorized, local image files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np

STATUS = "EVIDENCE_ONLY_UNVERIFIED"


def _read(path: Path):
    raw = path.read_bytes()
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("file does not decode as an image")
    return raw, img


def difference_hash(img) -> str:
    """64-bit dHash for repeat-photo comparisons; not a uniqueness fingerprint."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    return f"{sum(int(bit) << i for i, bit in enumerate((small[:, 1:] > small[:, :-1]).flat)):016x}"


def hamming64(hex_a: str, hex_b: str) -> int:
    return (int(hex_a, 16) ^ int(hex_b, 16)).bit_count()


def inspect_image(path: Path, expected_sha256: str | None = None) -> dict:
    raw, img = _read(path)
    sha = hashlib.sha256(raw).hexdigest()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    glare = np.logical_and(hsv[:, :, 2] >= 250, hsv[:, :, 1] <= 45)
    glare_pct = round(float(glare.mean() * 100), 3)
    focus = round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 3)
    flags = []
    if img.shape[0] < 700 or img.shape[1] < 700:
        flags.append("LOW_IMAGE_DIMENSIONS")
    if focus < 75:
        flags.append("FINE_DETAIL_REVIEW_RECOMMENDED")
    if glare_pct > 1.0:
        flags.append("SPECULAR_GLARE_PRESENT")
    if expected_sha256 and sha != expected_sha256.lower().removeprefix("sha256:"):
        flags.append("SOURCE_HASH_MISMATCH")
    return {
        "sha256": sha,
        "pixelWidth": int(img.shape[1]),
        "pixelHeight": int(img.shape[0]),
        "focusLaplacianVariance": focus,
        "specularGlarePercent": glare_pct,
        "dHash64": difference_hash(img),
        "flags": flags,
        "byteIntegrity": "MATCH" if expected_sha256 and "SOURCE_HASH_MISMATCH" not in flags else ("MISMATCH" if expected_sha256 else "NOT_REFERENCED"),
        "calibration": "unvalidated capture-quality heuristics; thresholds are not a forgery detector",
    }


def evaluate_photo_pair(front: Path, back: Path, expected: dict[str, str] | None = None) -> dict:
    expected = expected or {}
    observations = {
        "front": inspect_image(front, expected.get("front")),
        "back": inspect_image(back, expected.get("back")),
    }
    return {
        "schemaVersion": "authichain.trumark.vision.v1",
        "status": STATUS,
        "source": "local user-supplied photographs; not an inspector report",
        "images": observations,
        "ocrPerformed": False,
        "serialComparisonPerformed": False,
        "manufacturerMatchPerformed": False,
        "physicalAuthentication": False,
        "faceToFacePhotographicComparisonPerformed": False,
        "nextAction": "independent examiner must evaluate physical bar and document scope/method/results",
        "warnings": ["No claim of metal purity, originality, ownership or genuine manufacturer issuance.", "dHash similarity can be spoofed and is not a physical security feature."],
    }


def compare_same_view(reference: Path, candidate: Path) -> dict:
    """Diagnostic only. Never compare front to reverse as an authenticity test."""
    _, a = _read(reference)
    _, b = _read(candidate)
    distance = hamming64(difference_hash(a), difference_hash(b))
    return {"distanceOf64Bits": distance, "interpretation": "visual similarity diagnostic only", "authenticityVerdict": "NOT_EVALUATED"}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--front", type=Path, required=True)
    p.add_argument("--back", type=Path, required=True)
    p.add_argument("--front-sha256", default=None)
    p.add_argument("--back-sha256", default=None)
    p.add_argument("--out", type=Path)
    args = p.parse_args()
    result = evaluate_photo_pair(args.front, args.back, {"front": args.front_sha256, "back": args.back_sha256})
    data = json.dumps(result, indent=2) + "\n"
    if args.out:
        args.out.write_text(data, encoding="utf-8")
    else:
        print(data, end="")
    if any("SOURCE_HASH_MISMATCH" in v["flags"] for v in result["images"].values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
