"""AgentZ federation: signed, allowlisted mesh gossip between AgentZ nodes.

Off unless configured (see agentz.federation.routes). Gossip carries data;
it never executes capabilities (see gossip.advisory).
"""
from agentz.federation.gossip import FederationError, Node, advisory, gossip_round

__all__ = ["FederationError", "Node", "advisory", "gossip_round"]
