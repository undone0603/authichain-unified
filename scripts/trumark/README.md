# TruMark Vision v1 — local observation tool

This is a photo-quality and file-integrity diagnostic, **not a metal authenticator**. It performs no OCR or network access, logs no serial, and never outputs `VERIFIED`.

Install and test in an isolated environment:

```sh
python -m pip install -r scripts/trumark/requirements.txt
python -m unittest discover -s scripts/trumark -p 'test_vision_v1.py' -v
node --test protocol/inspection/inspection-gate.test.mjs
```

Private local photo intake, using true bytes from the owner; do NOT commit image files or resulting private review JSON:

```sh
python scripts/trumark/vision_v1.py \
  --front /secure/front.jpg --back /secure/back.jpg \
  --front-sha256 <64-hex-from-original> \
  --back-sha256 <64-hex-from-original> \
  --out /secure/vision-review.json
```

The dHash and Laplacian quality values are *unvalidated capture heuristics*, not a counterfeit classifier or calibrated likelihood. Diffuse lighting and better focus should be sought before any detail comparison. The sample pilot's originals showed visible glare and low-resolution fine detail; no serial reading was attempted.

The separate `protocol/inspection/inspection-gate.mjs` validates minimum report intake structure and always returns `EVIDENCE_ONLY_UNVERIFIED`; actual issuer authorization, signature validation, registry issuance, and production publication are separate security-gated services.

See `docs/pilots/trumark-inspection-intake.md` and `docs/pilots/trumark-bullion-dealer-pilot.md`.
