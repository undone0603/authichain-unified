"""AgentZ key-possession check and owner-binding proof. Runs INSIDE the authichain-agentz container
(docker exec -i ... python3 - < possession.py). Prints JSON with public data only: never the key.

Env in:
  ROSTER_SRC  workers/authichain-com/src/bot-identities.ts from origin/main
  DID_DOC     live https://authichain.com/agents/agentz/did.json
  MODE        "check" (default) or "sign"
  MAIN_SHA, MAIN_DATE, OPERATOR_GITHUB, OPERATOR_DOMAIN   (sign mode)
"""
import base64, json, os, secrets
from datetime import datetime, timezone

# Container env exactly as the entrypoint loads it (docker exec does not inherit it).
env = {}
for l in open("/run/agentz/env", encoding="utf-8").read().splitlines():
    l = l.strip()
    if not l or l.startswith("#") or "=" not in l:
        continue
    if l.startswith("export "):
        l = l[7:].lstrip()
    k, v = l.split("=", 1)
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        v = v[1:-1]
    env[k.strip()] = v
key_dir = env.get("AGENTZ_KEY_DIR")

# AgentZ's own identity.py, with the roster supplied from main (the image may not ship it yet).
src = open("/app/agentz/core/identity.py").read()
roster = "/tmp/agentz-roster-check.ts"
open(roster, "w").write(os.environ["ROSTER_SRC"])
src = src.replace('Path(__file__).resolve().parents[2] / "workers/authichain-com/src/bot-identities.ts"',
                  f'Path("{roster}")')
ns = {"__name__": "agentz_identity_check"}
try:
    exec(compile(src, "identity.py", "exec"), ns)
finally:
    os.remove(roster)

out = {"agent_id": ns["AGENT_ID"], "did": ns["DID_WEB"], "roster_did_key": ns["DID_KEY"],
       "valid_until": ns["VALID_UNTIL"], "key_dir_set": bool(key_dir)}
poss = ns["_key_possession"](key_dir)
out["agentz_possession_check"] = poss

doc = json.loads(os.environ.get("DID_DOC") or "{}")
live = {"did:key:" + vm["publicKeyMultibase"] for vm in doc.get("verificationMethod", []) if vm.get("publicKeyMultibase")}
live |= {k for k in doc.get("alsoKnownAs", []) if str(k).startswith("did:key:")}
out["live_did_json_keys"] = sorted(live)

if poss["status"] != "proven":
    print(json.dumps(out, indent=2))
    raise SystemExit(1)

from cryptography.hazmat.primitives import serialization
pem = open(os.path.join(key_dir, ns["KEY_FILE"]), "rb").read()
priv = serialization.load_pem_private_key(pem, password=None)
derived = ns["did_key_from_pem"](pem)
out["derived_did_key"] = derived
out["matches_roster"] = derived == ns["DID_KEY"]
out["matches_live_did_json"] = derived in live

# Fresh challenge: sign a random nonce, verify with the PUBLISHED key (not the derived one).
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
n = 0
for c in ns["DID_KEY"].split("did:key:z", 1)[1]:
    n = n * 58 + B58.index(c)
pub_raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
pub = Ed25519PublicKey.from_public_bytes(pub_raw[2:])
nonce = secrets.token_bytes(32)
try:
    pub.verify(priv.sign(nonce), nonce)
    out["challenge"] = "pass"
except Exception as e:  # noqa: BLE001
    out["challenge"] = f"fail: {type(e).__name__}"
out["trusted_issuer"] = ns["DID_KEY"] in [s.strip() for s in env.get("AGENTZ_TRUSTED_ISSUERS", "").split(",")]
out["verified"] = bool(out["matches_roster"] and out["matches_live_did_json"] and out["challenge"] == "pass")

if os.environ.get("MODE") == "sign" and out["verified"]:
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {
        "type": "AgentZOperatorKeyPossessionProof",
        "agent_id": ns["AGENT_ID"],
        "did": ns["DID_WEB"],
        "did_key": ns["DID_KEY"],
        "did_document": "https://authichain.com/agents/agentz/did.json",
        "operator": {"github": os.environ["OPERATOR_GITHUB"], "domain": os.environ["OPERATOR_DOMAIN"]},
        "statement": (f"The operator of AgentZ ({ns['AGENT_ID']}) holds the private key for {ns['DID_KEY']} "
                      f"and controls GitHub account {os.environ['OPERATOR_GITHUB']} and the domain "
                      f"{os.environ['OPERATOR_DOMAIN']}, which publishes this key."),
        "issued_at": now,
        "freshness": {"repo": "undone0603/authichain-unified", "main_commit": os.environ["MAIN_SHA"],
                      "main_commit_date": os.environ["MAIN_DATE"]},
        "nonce": b64(secrets.token_bytes(16)),
        "limits": ("Proves the publisher held this key at issued_at (signed after main_commit existed) and, "
                   "via the publishing GitHub account, binds that account to the key. Does not prove that "
                   "AgentZ's outputs are accurate or safe, or any third-party endorsement."),
    }
    header = {"alg": "EdDSA", "kid": "did:web:authichain.com:agents:agentz#key-1", "typ": "agentz-possession+jws"}
    signing_input = b64(json.dumps(header, separators=(",", ":")).encode()) + "." + \
        b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    jws = signing_input + "." + b64(priv.sign(signing_input.encode()))
    pub.verify(base64.urlsafe_b64decode(jws.split(".")[2] + "=="), signing_input.encode())
    out["proof"] = {"jws": jws, "payload": payload}

print(json.dumps(out, indent=2))
raise SystemExit(0 if out["verified"] else 1)
