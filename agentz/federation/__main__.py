"""CLI: python -m agentz.federation {status|publish TOPIC JSON|round}

`round` dials AGENTZ_FEDERATION_PEERS once and prints the per-peer report.
Nothing runs on a timer here; schedule `round` externally if wanted.
"""
from __future__ import annotations

import json
import sys

from agentz.federation.gossip import FederationError, gossip_round
from agentz.federation.routes import _split, httpx_post, load_node, status


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "status"
    if cmd == "status":
        print(json.dumps(status(), indent=2))
        return 0
    node = load_node()
    if node is None:
        print("federation not configured (AGENTZ_KEY_DIR + AGENTZ_FEDERATION_MEMBERS)", file=sys.stderr)
        return 2
    if cmd == "publish" and len(argv) == 3:
        try:
            env = node.publish(argv[1], json.loads(argv[2]))
        except (FederationError, ValueError) as exc:
            print(f"refused: {getattr(exc, 'reason', exc)}", file=sys.stderr)
            return 1
        print(json.dumps({"origin": env["origin"], "seq": env["seq"], "topic": env["topic"]}))
        return 0
    if cmd == "round":
        peers = _split("AGENTZ_FEDERATION_PEERS")
        if not peers:
            print("no AGENTZ_FEDERATION_PEERS set", file=sys.stderr)
            return 2
        print(json.dumps(gossip_round(node, peers, httpx_post()), indent=2))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
