"""Federation gossip: convergence, refusal paths and the HTTP surface.

No network: peers are Node objects behind a fake post() that round-trips JSON
the way the wire would.
"""
import json
import random

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import FastAPI
from fastapi.testclient import TestClient

from agentz.federation import routes
from agentz.federation.gossip import (
    MAX_BATCH, FederationError, Node, _b64, advisory, canonical, did_key_of, gossip_round,
    public_key_of,
)

T0 = 1_795_440_000.0  # 2026-11-23


class Clock:
    def __init__(self, t=T0):
        self.t = t

    def __call__(self):
        return self.t


def mesh(n, clock=None, **kw):
    keys = [Ed25519PrivateKey.generate() for _ in range(n)]
    members = [did_key_of(k) for k in keys]
    clock = clock or Clock()
    return [Node(k, members, clock=clock, **kw) for k in keys], clock


def fake_post(nodes):
    by_url = {f"node{i}": node for i, node in enumerate(nodes)}

    def post(peer, path, body):
        node = by_url[peer]
        wire = json.loads(json.dumps(body))
        handler = node.handle_exchange if path == "/federation/exchange" else node.handle_push
        return json.loads(json.dumps(handler(wire)))

    return post, list(by_url)


def converge(nodes, rounds, seed=7, groups=None):
    rng = random.Random(seed)
    post, urls = fake_post(nodes)
    for _ in range(rounds):
        for i, node in enumerate(nodes):
            peers = [u for j, u in enumerate(urls) if j != i
                     and (groups is None or groups[j] == groups[i])]
            gossip_round(node, peers, post, fanout=1, rng=rng)


def test_did_key_round_trips_to_the_signing_key():
    key = Ed25519PrivateKey.generate()
    did = did_key_of(key)
    assert did.startswith("did:key:z6Mk")
    public_key_of(did).verify(key.sign(b"x"), b"x")
    with pytest.raises(FederationError):
        public_key_of("did:web:authichain.com")


def test_mesh_of_six_converges_on_every_message():
    nodes, _ = mesh(6)
    for i, node in enumerate(nodes):
        for k in range(3):
            node.publish("status.update", {"node": i, "k": k})
    converge(nodes, rounds=8)
    expected = {(n.did, s) for n in nodes for s in (1, 2, 3)}
    for node in nodes:
        assert {(e["origin"], e["seq"]) for e in node.messages()} == expected
        assert node.vector() == {n.did: 3 for n in nodes}


def test_partitioned_halves_converge_after_healing():
    nodes, _ = mesh(6)
    for i, node in enumerate(nodes):
        node.publish("status.update", {"node": i})
    groups = [0, 0, 0, 1, 1, 1]
    converge(nodes, rounds=6, groups=groups)
    assert len(nodes[0].messages()) == 3 and len(nodes[5].messages()) == 3
    converge(nodes, rounds=6)
    assert all(len(n.messages()) == 6 for n in nodes)


def test_tampered_payload_is_rejected():
    a, b = mesh(2)[0]
    env = a.publish("status.update", {"ok": True})
    forged = {**env, "payload": {"ok": False}}
    result = b.ingest([forged])
    assert result["accepted"] == 0 and result["rejected"][0]["reason"] == "bad_signature"


def test_non_member_origin_is_rejected_even_when_signed():
    (a,), clock = mesh(1)
    outsider = Node(Ed25519PrivateKey.generate(), [a.did], clock=clock)
    env = outsider.publish("status.update", {"hi": 1})
    assert a.ingest([env])["rejected"][0]["reason"] == "untrusted_origin"


def test_duplicates_are_idempotent_and_equivocation_is_caught():
    (a, b), clock = mesh(2)
    env = a.publish("status.update", {"v": 1})
    assert b.ingest([env])["accepted"] == 1
    assert b.ingest([env]) == {"accepted": 0, "duplicate": 1, "rejected": []}
    # Same seq, different body, validly signed by a's key: a misused key.
    body = {k: env[k] for k in ("v", "origin", "seq", "ts", "topic")} | {"payload": {"v": 2}}
    twin = {**body, "sig": _b64(a._key.sign(canonical(body)))}
    result = b.ingest([twin])
    assert result["rejected"][0]["reason"] == "equivocation"
    assert b.equivocations == [{"origin": a.did, "seq": 1}]
    assert b.messages()[0]["payload"] == {"v": 1}


def test_future_dated_envelope_is_rejected():
    (a, b), clock = mesh(2)
    clock.t = T0 + 3600
    env = a.publish("status.update", {})
    clock.t = T0
    assert b.ingest([env])["rejected"][0]["reason"] == "future_timestamp"


def test_publish_refuses_bad_topics_and_oversized_payloads():
    (a,), _ = mesh(1)
    with pytest.raises(FederationError, match="bad_topic"):
        a.publish("Bad Topic!", {})
    with pytest.raises(FederationError, match="bad_payload"):
        a.publish("blob", {"x": "y" * 20_000})


def test_own_seq_survives_restart(tmp_path):
    key = Ed25519PrivateKey.generate()
    first = Node(key, [], state_dir=tmp_path)
    first.publish("status.update", {})
    first.publish("status.update", {})
    again = Node(key, [], state_dir=tmp_path)
    assert again.publish("status.update", {})["seq"] == 3


def test_requests_must_be_signed_fresh_and_single_use():
    (a, b), clock = mesh(2)
    outsider = Node(Ed25519PrivateKey.generate(), [a.did], clock=clock)

    req = a.sign_request("exchange", {"vector": {}})
    b.handle_exchange(req)
    with pytest.raises(FederationError, match="replayed_request"):
        b.handle_exchange(req)
    with pytest.raises(FederationError, match="not_a_member"):
        b.handle_exchange(outsider.sign_request("exchange", {"vector": {}}))
    with pytest.raises(FederationError, match="bad_request"):
        b.handle_push(a.sign_request("exchange", {"vector": {}}))
    tampered = {**a.sign_request("exchange", {"vector": {}}), "body": {"vector": {"x": 1}}}
    with pytest.raises(FederationError, match="bad_signature"):
        b.handle_exchange(tampered)
    stale = a.sign_request("exchange", {"vector": {}})
    clock.t = T0 + 3600
    with pytest.raises(FederationError, match="stale_request"):
        b.handle_exchange(stale)


def test_large_backlog_moves_in_batches():
    (a, b), _ = mesh(2)
    for k in range(MAX_BATCH + 50):
        a.publish("log", {"k": k})
    post, urls = fake_post([a, b])
    gossip_round(b, [urls[0]], post, fanout=1)
    assert b.vector()[a.did] == MAX_BATCH
    gossip_round(b, [urls[0]], post, fanout=1)
    assert b.vector()[a.did] == MAX_BATCH + 50


def test_unreachable_peer_does_not_stop_the_round():
    (a, b), _ = mesh(2)
    post, urls = fake_post([a, b])

    def flaky(peer, path, body):
        if peer == "down":
            raise ConnectionError("refused")
        return post(peer, path, body)

    report = gossip_round(a, ["down", urls[1]], flaky, fanout=2, rng=random.Random(1))
    assert {r["peer"]: "error" in r for r in report} == {"down": True, "node1": False}


def test_gossiped_capabilities_are_advisory_only():
    (a,), _ = mesh(1)
    deploy = advisory(a.publish("task.proposal", {"capability": "deploy"}))
    research = advisory(a.publish("task.proposal", {"capability": "research"}))
    assert deploy["allowed"] is False and deploy["executed"] is False
    assert research["allowed"] is True and research["executed"] is False


def test_http_routes_503_until_configured_then_serve_signed_exchange():
    app = FastAPI()
    app.include_router(routes.router)
    client = TestClient(app)
    try:
        routes.set_node(None)
        assert client.post("/federation/exchange", json={}).status_code == 503

        (a, b), _ = mesh(2)
        b.publish("status.update", {"from": "b"})
        routes.set_node(b)
        resp = client.post("/federation/exchange", json=a.sign_request("exchange", {"vector": {}}))
        assert resp.status_code == 200
        assert a.ingest(resp.json()["envelopes"])["accepted"] == 1
        bad = client.post("/federation/push", json={"kind": "push", "from": "did:key:zNope"})
        assert bad.status_code == 403
        assert routes.status()["held"] == 1
    finally:
        routes.set_node(None)
