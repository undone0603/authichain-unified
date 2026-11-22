# AgentZ port 8000 runtime reconciliation (2026-11-22)

Read-only. Nothing was restarted, rebuilt, or deployed.

## Running process

| Item | Observed |
| --- | --- |
| Host | `LAPTOP-72MAGTL2`, `aarch64` |
| Listener | `127.0.0.1:8000`, pid 14196 |
| Command | `/home/zac/.agentz-venv/bin/python -m uvicorn agentz.api.main:app --host 127.0.0.1 --port 8000` |
| Interpreter | `/usr/bin/python3.12`, Python 3.12.3 (Ubuntu system build, in a venv) |
| Working directory | `~/worktrees/agentz-pinned-5ab5e2c93`, HEAD `5ab5e2c93e2c7ebf17ea37cbd9b725fc9bd49340`, 0 uncommitted files |

## Protected artifact compared

`AgentZ protected host artifact` run 44908378962 at `75e2c5b5d` (success,
2026-11-21). The `5ab5e2c9` build itself failed (run 44868895090), and
`75e2c5b5d` is its descendant.

| Component | Running | Protected artifact | Match |
| --- | --- | --- | --- |
| `agentz/` git tree | `e1c0cb46c46404b1368e3dc1ef4565172f1f8f7b` | `e1c0cb46c46404b1368e3dc1ef4565172f1f8f7b` | yes |
| `protocol/` git tree | `08b37df130034470cd96a932cb7993f836671a11` | `08b37df130034470cd96a932cb7993f836671a11` | yes |
| Python packages | `pip freeze`, 183 packages | `requirements-agentz.txt`, 183 pins | yes, every name and version |
| Entrypoint | `uvicorn agentz.api.main:app` | same module tree | yes |
| Python | 3.12.3 (Ubuntu) | 3.12.16 (`python:3.12-slim` arm64, base `sha256:5e2bdb1b…4fa5b`) | **no, patch level only** |
| Packaging | host venv | OCI image | different by design |

`requirements-agentz.txt` and `Dockerfile.agentz` are identical at
`75e2c5b5d` and current main `b4afbb3fc`.

## Conclusion

The running AgentZ is the protected source and dependency set. The only
divergence is the interpreter patch level (3.12.3 vs 3.12.16) and venv vs
image packaging. It is not byte-identical to the image, and nothing here claims
the archived image is the running image.

## Why the automated comparison never ran

`AgentZ protected host executable comparison` run 44958457902 stopped at
`sudo -n id -u`: the self-hosted runner's sudo needs a password. It failed
before comparing anything.

## Options to close the remaining gap (owner decision)

1. Run the service from the protected image, so interpreter and packaging match exactly.
2. Rebuild the host venv on Python 3.12.16 with the same pins and restart.
3. Accept the patch-level difference and record it as the reconciled baseline.

Python 3.12.3 is 13 patch releases behind, so options 1 or 2 also pick up
interpreter security fixes.
