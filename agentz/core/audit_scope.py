# AgentZ port of AI Adapt research build 2026-10-29 AuditScope (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-29-auditscope-auditable-detector.md
"""auditscope — auditable AI-text provenance classifier (prototype).

Technique: DetectorScope (arXiv:2610.30006, Google DeepMind / UPenn, Apache-2.0).
Pipeline: SAE features from a detector's residual stream -> auto-interp label per
feature -> keep only features whose description passes a fidelity threshold ->
train a lightweight classifier on the kept, human-readable features only.

This module implements the post-SAE half (feature filter, classifier, evidence,
sealed audit receipt) in pure stdlib. Feature extraction is an injected callable,
so production can plug in the released liamdugan/detector-scope SAE (Gemma
license) or any API; tests use a mocked extractor. Written fresh, not copied.
"""
from __future__ import annotations
import hashlib, json, math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Sequence

@dataclass(frozen=True)
class Feature:
    fid: str
    description: str   # auto-interpretation label, human readable
    fidelity: float    # 0..1 agreement of the description with activations

def select_interpretable(features: Sequence[Feature], threshold: float = 0.7) -> List[Feature]:
    """Global fidelity gate: only features whose description can be trusted survive."""
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must be in [0,1]")
    return sorted([f for f in features if f.fidelity >= threshold], key=lambda f: f.fid)

def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z); return e / (1.0 + e)

@dataclass
class AuditableDetector:
    features: List[Feature]
    weights: Dict[str, float] = field(default_factory=dict)
    bias: float = 0.0
    model_version: str = "auditscope-0.1"

    def fit(self, rows: Sequence[Dict[str, float]], labels: Sequence[int],
            epochs: int = 400, lr: float = 0.5, l1: float = 1e-3) -> "AuditableDetector":
        """L1-regularised logistic regression on kept features only (1 = AI-generated)."""
        if len(rows) != len(labels) or not rows:
            raise ValueError("rows and labels must be same non-zero length")
        ids = [f.fid for f in self.features]
        self.weights = {i: 0.0 for i in ids}; self.bias = 0.0; n = len(rows)
        for _ in range(epochs):
            gw = {i: 0.0 for i in ids}; gb = 0.0
            for x, y in zip(rows, labels):
                err = self._prob(x) - y
                for i in ids: gw[i] += err * x.get(i, 0.0)
                gb += err
            for i in ids:
                w = self.weights[i] - lr * gw[i] / n
                # soft-threshold (proximal L1) keeps the model sparse = readable
                self.weights[i] = math.copysign(max(abs(w) - lr * l1, 0.0), w)
            self.bias -= lr * gb / n
        return self

    def _prob(self, x: Dict[str, float]) -> float:
        return _sigmoid(self.bias + sum(w * x.get(i, 0.0) for i, w in self.weights.items()))

    def explain(self, x: Dict[str, float], top_k: int = 3) -> dict:
        p = self._prob(x)
        desc = {f.fid: f.description for f in self.features}
        contrib = sorted(((w * x.get(i, 0.0), i) for i, w in self.weights.items() if w),
                         key=lambda t: -abs(t[0]))[:top_k]
        return {"p_ai": round(p, 4),
                "verdict": "likely_ai" if p >= 0.5 else "likely_human",
                "evidence": [{"feature": i, "tell": desc[i], "contribution": round(c, 4)}
                             for c, i in contrib]}

def seal_receipt(text: str, result: dict, model_version: str, prev_sha256: str = "0" * 64) -> dict:
    """Hash-chained audit receipt. Stores a text digest, never the raw text."""
    body = {"text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "model_version": model_version, "result": result, "prev_sha256": prev_sha256}
    canon = json.dumps(body, sort_keys=True, separators=(",", ":"))
    body["receipt_sha256"] = hashlib.sha256(canon.encode()).hexdigest()
    return body

def verify_chain(receipts: Sequence[dict]) -> bool:
    prev = "0" * 64
    for r in receipts:
        body = {k: v for k, v in r.items() if k != "receipt_sha256"}
        if body.get("prev_sha256") != prev: return False
        canon = json.dumps(body, sort_keys=True, separators=(",", ":"))
        if hashlib.sha256(canon.encode()).hexdigest() != r["receipt_sha256"]: return False
        prev = r["receipt_sha256"]
    return True

def audit(text: str, extractor: Callable[[str], Dict[str, float]], det: AuditableDetector,
          prev_sha256: str = "0" * 64) -> dict:
    kept = {f.fid for f in det.features}
    x = {k: v for k, v in extractor(text).items() if k in kept}  # drop unlabelled features
    return seal_receipt(text, det.explain(x), det.model_version, prev_sha256)
