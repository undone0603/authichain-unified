# SPDX-License-Identifier: Apache-2.0
"""Command line interface, same contract as the npm ``authichain-verify`` CLI.

    authichain-verify [--jwks <jwks.json>] <record.json> [anchor.json]
    authichain-verify --jwks <jwks.json> <seal.jws>

Prints the result as JSON on stdout. Exit 0 for verified / valid-unanchored /
valid-offline, 1 for invalid, 2 for usage errors. ALLOW_TESTNET=1 accepts
testnet anchors (SPEC 4.1).
"""

from __future__ import annotations

import json
import os
import sys
from typing import List, Optional

from .verifier import verify_attestation_jws, verify_record

USAGE = (
    "usage: authichain-verify [--jwks <jwks.json>] <record.json> [anchor.json]\n"
    "       authichain-verify --jwks <jwks.json> <seal.jws>"
)


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def main(argv: Optional[List[str]] = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    jwks = None
    if args and args[0] == "--jwks":
        if len(args) < 3:
            print(USAGE, file=sys.stderr)
            return 2
        jwks = json.loads(_read(args[1]))
        args = args[2:]
        text = _read(args[0]).strip()
        if not text.startswith("{"):
            result = verify_attestation_jws(text, jwks)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 1 if result["verdict"] == "invalid" else 0

    if not args or args[0] in ("-h", "--help"):
        print(USAGE, file=sys.stderr)
        return 2
    record = json.loads(_read(args[0]))
    anchor = json.loads(_read(args[1])) if len(args) > 1 else None
    result = verify_record(
        record,
        anchor,
        allow_testnet=os.environ.get("ALLOW_TESTNET") == "1",
        jwks=jwks,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 1 if result["verdict"] == "invalid" else 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
