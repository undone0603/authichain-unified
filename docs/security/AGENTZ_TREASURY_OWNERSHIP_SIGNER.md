# AgentZ treasury wallet ownership signer: security review (DRAFT)

This component is an offline, disabled-by-default EIP-191 ownership challenge signer. It MUST NOT be invoked through the public AgentZ API, MCP, a trading agent, or a delegated wallet endpoint. It NEVER grants spending permission, transfers funds, signs transactions, or creates Coinbase/Base Account permissions. A valid signature proves only that an isolated signer with the specified private key answered a particular one-time ownership challenge; host/runtime provenance requires additional independent evidence.

## Process and filesystem boundaries

Use three different principals: a non-root signer UID, a non-root operator UID, and a root-controlled external host observer. The operator UID must never equal the signer UID, and neither may be root. Use a purpose-specific socket group shared only by the signer and authorized operator. Use a different observer group for signer read access to observations. Do not put the operator in the observer group.

| Resource | Owner / group | Mode | Access |
|---|---|---|---|
| Runtime socket directory | signer UID / socket group | 0750 | Operator traverses via socket group |
| ownership.sock | signer UID / socket group | 0660 | Kernel permits operator group to connect |
| Private signer-key directory | signer UID / signer-private group | 0700 | Operator cannot traverse or read |
| Signer key | signer UID / signer-private group | 0600 | Signer only |
| Durable nonce directory | signer UID / signer-private group | 0700 | Signer only |
| Durable SQLite nonce DB | signer UID / signer-private group | 0600 | Signer only |
| Root observer receipt directory | root / observer group | 0750 | Signer reads; operator cannot traverse |
| Root observer receipt | root / observer group | 0640 | Signer reads, root observer writes |

The signer refuses mismatched owners, modes, symlinks for key/receipt files, hardlinks, unsafe nonce DB modes, a same-UID signer/operator, missing root-owned observations, and stale receipts. It also authenticates the connecting UID with Linux SO_PEERCRED, independently of socket filesystem group membership. Thus an intruder who somehow joins the socket group still cannot request a signature unless their kernel UID matches the configured operator UID. Restrict group membership and ensure no other code path can run under that operator UID. Do not add the operator UID to the signer-private group or grant read ACLs to the key or nonce store.

The caller must independently check SO_PEERCRED on the returned connection to authenticate the signer UID. Credentials are kernel-observed, not caller-supplied JSON identity fields. The operator must also correlate the signer PID to the protected system service, cgroup, image and live process by a separate privileged observation mechanism.

Use systemd User/Group/SupplementaryGroups, RuntimeDirectory or a reviewed tmpfiles configuration to create these paths with the correct owners and modes; do not run startup setup as the operator and do not make the signer run as root. Configure NoNewPrivileges, ProtectSystem, PrivateTmp as applicable, ProtectHome, CapabilityBoundingSet, and narrow ReadWritePaths after testing. Do not set supplementary signer-private group access on the operator. Do not use abstract sockets or HTTP proxying as a shortcut around peer identity.

## Replay and proof limitations

Challenges contain exactly four fields: a 32-byte nonce, a five-minute UTC expiry, the expected wallet address, and the literal purpose wallet-ownership-only. Arbitrary payloads, transaction-like fields, other purposes and unexpected addresses are refused. Nonces are inserted into a persistent SQLite table in an immediate transaction with FULL synchronous durability before any signature is issued. Replays remain refused after signer restart; do not delete, roll back, or recreate the nonce store. Crash after commit may consume a nonce without a response; issue a new challenge instead of retrying the consumed nonce.

The signed human-readable EIP-191 message binds the chain ID, wallet, nonce, expiry, signer service name, signer UID and PID, independently supplied observation ID and SHA-256 of the root-owned receipt. Every verifier must compare the recovered EIP-191 address with the separately authorized expected wallet, check message format and nonce issuance/expiry, confirm signer peer identity and verify the observation receipt through a separate trusted observer. Signature verification alone cannot prove that a real process served a specific container image.

Root-controlled observer and independent verifier source are included in this draft, but neither has run against the actual AgentZ host. A fixture with syntactically correct root ownership is not real host attestation. The response deliberately reports host_observation_independently_verified=false. Before any host activation, an independent observer must obtain the actual running image ID, PID, process start, health, protected source SHA and artifact checksum from the host and CI evidence, write its root-owned receipt, and independently verify those values match the signer-bound hash. Reject self-reported process fields. Match service UID to configured systemd unit through trusted host metadata. Never treat the signature as authority to sign a transaction or create a spend permission.

## Local validation / review

Install in a disposable Linux test environment with Python 3.11+, OpenSSL 3 exposing KECCAK-256, and dependencies in agentz/treasury_proof/requirements.txt. From repository root run:

    python -m pip install -r agentz/treasury_proof/requirements.txt pytest eth-account==0.13.7
    python -m pytest -q agentz/tests/test_treasury_signer_review.py agentz/tests/test_treasury_attestation_adversarial.py
    python -m compileall -q agentz/treasury_proof

The EIP-191 test generates disposable secp256k1 keys and independently recovers addresses; the Linux root test launches separate disposable UIDs and checks socket group, SO_PEERCRED, signer key denial, nonce replay after process restart, and no independent-host-verification claim. The multi-UID test skips without root privileges and must be re-run in a controlled privileged CI/VM before approval.

Review cryptography and OpenSSL versions, signing-key management, receipt trust, process lifecycle, SQLite filesystem/backup and tamper resilience, potential UID/group reuse, socket symlink races, OS-specific security controls and incident/rotation procedures. Key access remains exclusive to the signer. No production key was used.

## Release hold

This PR contains only reviewable source, local tests and documentation. It does not create systemd identities, install a key, activate the socket, modify Coinbase, dispatch CI deliberately, merge a branch, enable spend authority, or deploy production. Preserve all protected exact-head checks and code review requirements. A distinct owner-approved release and independent host-artifact attestation must precede any activation.

## Evidence-first commercial boundary

AuthiChain's model is **free truth, paid recording, evidence-based value**:
- Public verification and re-verification of existing records, signed ownership
  proofs and evidence-integrity checks must remain free, transparent, and
  independently reproducible; never require a payment to learn whether a
  claim is verified or unverified.
- Charge only for separately authorized record creation, durable issuance,
  anchoring, retention or paid evidence-handling services, with a disclosed
  price and settled payment before an entitlement is issued.
- A signature is not a sale, transaction approval, payment mandate,
  verification of the physical product, or permission to move treasury funds.
  Disclose source, proof level, evidence limitations and revocation state.
- No billing, credit consumption, x402 call, wallet permission, trade,
  entitlement issuance, or production write is added by this change.

## Further signer hardening (draft, not activated)

The signer allows software-key signing only in a clearly marked disposable
test fixture and only when its private directory is under /tmp. **Never**
copy a Coinbase recovery phrase, Base treasury key, live private key or wallet
backup there, or into a GitHub secret, Docker build, logs or project file.
A hardware-backed, nonexportable ownership-only signing adapter is NOT
implemented and requires separate review/consent. A review must ensure
hardware-wallet prompts cannot approve transactions or permissions.

Authenticated requests are bounded to six attempts per rolling minute,
including rejected authorized requests. The socket has a one-second read
deadline and a bounded queue. The signer refuses when durable nonce storage
has under 2 MiB free or UTC time moves backward by more than two seconds
relative to the durable high-watermark. Nonces are inserted before signing.
Records are retained for 90 days past issuance and pruning happens only
for expired records, in one durable transaction. No rollback or recreation
of the nonce store is permitted after crash or backup restoration.

## Protected build, actual host and independent verification

GitHub contains a protected ARM64 **build** evidence release, not proof
of a running AgentZ service:

- Draft release: agentz-evidence-44908378962-1
- Protected source: 75e2c5b5d1e900e56cf60b021e9d53d6c81dc7fe
- Archive digest: 86bbae418805902a45dea9892809dede966915eeafe9bee56dfcc559966a4f9e
- release.json GitHub asset digest:
  e504942018146d1ff20d36986f87bc0f9a45370487617d0dc9c4a12d74b2fc5a

Obtain both assets independently from the corresponding protected GitHub
draft release on the authorized host. The root-only host observer requires
the release.json GitHub asset digest, validates archive bytes, observes
one live Docker container with the exact image ID and expected source
revision label, rejects shadowed application mounts, captures the real
process PID/start, verifies loopback health and emits a root-owned receipt.

Example invocation (reviewed paths/UIDs required; **read-only**, no launch):

    sudo python -m agentz.treasury_proof.host_observer \
      --archive /evidence/agentz-linux-arm64.tar.gz \
      --release-json /evidence/release.json \
      --github-receipt-sha256 e504942018146d1ff20d36986f87bc0f9a45370487617d0dc9c4a12d74b2fc5a \
      --observer-dir /run/authichain-proof-observer \
      --observer-gid 63005

If the actual host is not running the protected image, output is HOLD.
Do not start or replace its process to force a match. The observer output
is NOT ownership proof. For full independent verification, separately
issue a fresh challenge as root, collect a real local socket response from
an authorized, isolated hardware-backed signer, and run
agentz.treasury_proof.host_verifier with its explicit challenge, proof,
release, image receipt and reviewed signer systemd service. The verifier
re-queries host Docker/proc/systemd evidence and recovers the Ethereum
EIP-191 signer using the standard eth-account library. It never authorizes
spending or asserts that signed JSON alone proves host provenance.

## CI review gates

The CircleCI extras lane is a disposable Docker executor. It runs
agentz/tests/test_treasury_attestation_adversarial.py and the existing
proof suite as an ordinary user, then explicitly re-runs the real multi-UID
socket access test with sudo **inside that disposable executor**. It must
not run privileged untrusted PR code on persistent WSL runners.
Adversarial scenarios cover stale/forged receipts, wrong wallet, service
identity mismatch, unauthorized UIDs, restart/replay, tampered build
archive, clock rollback, disk pressure, request limits, and Ethereum-library
signature interoperability.

No proof of host activation has yet been observed, no real treasury
key has been touched, and no signer or protected artifact was deployed.
Keep this PR draft and preserve protected-merge and separately approved
release gates.

## Actual protected-host preflight observed (not signer attestation)

The read-only GitHub Actions host preflight job 136962378045, run
44925181450, reported at 2026-11-21T19:43:22Z:
- Host LAPTOP-72MAGTL2 (aarch64), one FastAPI process PID 1537;
  process start 2026-11-21T17:36:49.390000Z.
- Loopback /health HTTP 200 and stable PID/start; local origin health proven.
- Running checkout HEAD 5ab5e2c93e2c7ebf17ea37cbd9b725fc9bd49340.
- No uniquely matching Docker container, no image ID, and no independently
  matched protected artifact. Explicit attestation_signed=false.

Therefore the available observation supports a live, healthy local origin,
**not** a match to the protected ARM64 image and **not** a host signer
attestation. The new host observer should HOLD until there is a uniquely
matching running Docker image and independently checked protected receipt.
Do not change the host deployment or install a live wallet key merely to
make this check pass.
