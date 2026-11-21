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

The root-controlled observer is NOT included in this draft. A fixture with syntactically correct root ownership is not a real host attestation. The response deliberately reports host_observation_independently_verified=false. Before any host activation, an independent observer must obtain the actual running image ID, PID, process start, health, protected source SHA and artifact checksum from the host and CI evidence, write its root-owned receipt, and independently verify those values match the signer-bound hash. Reject self-reported process fields. Match service UID to configured systemd unit through trusted host metadata. Never treat the signature as authority to sign a transaction or create a spend permission.

## Local validation / review

Install in a disposable Linux test environment with Python 3.11+, OpenSSL 3 exposing KECCAK-256, and dependencies in agentz/treasury_proof/requirements.txt. From repository root run:

    python -m pip install -r agentz/treasury_proof/requirements.txt pytest
    python -m pytest -q agentz/tests/test_treasury_signer_review.py
    python -m compileall -q agentz/treasury_proof

The EIP-191 test generates disposable secp256k1 keys and independently recovers addresses; the Linux root test launches separate disposable UIDs and checks socket group, SO_PEERCRED, signer key denial, nonce replay after process restart, and no independent-host-verification claim. The multi-UID test skips without root privileges and must be re-run in a controlled privileged CI/VM before approval.

Review cryptography and OpenSSL versions, signing-key management, receipt trust, process lifecycle, SQLite filesystem/backup and tamper resilience, potential UID/group reuse, socket symlink races, OS-specific security controls and incident/rotation procedures. Key access remains exclusive to the signer. No production key was used.

## Release hold

This PR contains only reviewable source, local tests and documentation. It does not create systemd identities, install a key, activate the socket, modify Coinbase, dispatch CI deliberately, merge a branch, enable spend authority, or deploy production. Preserve all protected exact-head checks and code review requirements. A distinct owner-approved release and independent host-artifact attestation must precede any activation.
