#!/usr/bin/env python3
"""Verify an AgentZ operator key-possession proof. Anyone can run this; it needs only
`pip install cryptography` and network access.

    python3 verify_proof.py <proof.jws | https URL to a raw .jws> [--gist <gist id or URL>]

Checks:
 1. The EdDSA signature verifies with the key published at https://authichain.com/agents/agentz/did.json
    (the key referenced by the JWS `kid`).
 2. The payload's did_key is that published key.
 3. The payload's freshness commit exists on GitHub and is not newer than issued_at.
 4. With --gist: the gist is owned by the payload's operator GitHub account and contains this exact proof.
"""
import base64, json, sys, urllib.request
from datetime import datetime

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

DID_DOC = "https://authichain.com/agents/agentz/did.json"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "agentz-verify/1", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def main(argv):
    if not argv:
        sys.exit(__doc__)
    src = argv[0]
    jws = (get(src).decode() if src.startswith("https://") else open(src).read()).strip()
    gist = argv[argv.index("--gist") + 1] if "--gist" in argv else None

    h64, p64, s64 = jws.split(".")
    header, payload = json.loads(b64d(h64)), json.loads(b64d(p64))
    ok = True

    def check(name, cond, detail=""):
        nonlocal ok
        ok &= bool(cond)
        print(f"{'PASS' if cond else 'FAIL'}  {name}{('  ' + detail) if detail else ''}")

    check("alg is EdDSA", header.get("alg") == "EdDSA")
    doc = json.loads(get(DID_DOC))
    vm = next((v for v in doc["verificationMethod"] if v["id"] == header.get("kid")), None)
    check("kid resolves in live did.json", vm is not None, header.get("kid", ""))
    jwk_vm = next(v for v in doc["verificationMethod"] if v.get("publicKeyJwk", {}).get("crv") == "Ed25519")
    pub = Ed25519PublicKey.from_public_bytes(b64d(jwk_vm["publicKeyJwk"]["x"]))
    try:
        pub.verify(b64d(s64), f"{h64}.{p64}".encode())
        check("signature verifies with the published key", True)
    except Exception:  # noqa: BLE001
        check("signature verifies with the published key", False)
    check("payload did_key is the published key", payload.get("did_key") in doc.get("alsoKnownAs", []),
          payload.get("did_key", ""))
    check("payload did matches did.json id", payload.get("did") == doc.get("id"))

    fr = payload.get("freshness", {})
    try:
        c = json.loads(get(f"https://api.github.com/repos/{fr['repo']}/commits/{fr['main_commit']}"))
        cdate = c["commit"]["committer"]["date"]
        fresh = datetime.fromisoformat(cdate.replace("Z", "+00:00")) <= \
            datetime.fromisoformat(payload["issued_at"].replace("Z", "+00:00"))
        check("freshness commit exists and predates issued_at", fresh, f"{fr['main_commit'][:12]} @ {cdate}")
    except Exception as e:  # noqa: BLE001
        check("freshness commit exists and predates issued_at", False, type(e).__name__)

    if gist:
        gid = gist.rstrip("/").split("/")[-1]
        g = json.loads(get(f"https://api.github.com/gists/{gid}"))
        owner = (g.get("owner") or {}).get("login")
        check("gist owner is the operator GitHub account", owner == payload["operator"]["github"],
              f"owner={owner} operator={payload['operator']['github']}")
        contents = [f.get("content", "").strip() for f in g.get("files", {}).values()]
        check("gist contains this exact proof", jws in contents)

    print()
    print(json.dumps(payload, indent=2))
    print("\nRESULT:", "VERIFIED" if ok else "NOT VERIFIED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
