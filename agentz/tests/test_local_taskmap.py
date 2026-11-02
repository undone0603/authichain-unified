"""Roadie-style local map. Drives scope, map_pins, and offer."""

from datetime import datetime, timedelta, timezone

from agentz.core.local_taskmap import Gig, Place, Worker, map_pins, offer, render_board, scope

NOW = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
AUSTIN = Place(30.2672, -97.7431, "Austin")
NEAR = Place(30.27, -97.74, "near")
FAR = Place(32.78, -96.80, "Dallas")


def worker(**overrides) -> Worker:
    base = dict(
        id="agent-1",
        place=AUSTIN,
        qualifications=frozenset({"python", "a2a"}),
        range_km=40,
    )
    base.update(overrides)
    return Worker(**base)


def gig(**overrides) -> Gig:
    base = dict(
        id="gig-1",
        title="Review an A2A card",
        kind="a2a",
        place=NEAR,
        requirements=frozenset({"a2a"}),
        asking_price_usd=40,
        negotiable=True,
        timed=False,
        deadline=None,
    )
    base.update(overrides)
    return Gig(**base)


def test_scope_keeps_a_nearby_qualified_gig_and_hides_the_rest():
    rows = scope(
        worker(),
        [
            gig(),
            gig(id="far", place=FAR, title="Dallas deploy"),
            gig(id="skill", requirements=frozenset({"solidity"})),
            gig(
                id="late",
                timed=True,
                deadline=NOW - timedelta(hours=1),
            ),
            gig(
                id="soon",
                title="Timed review",
                timed=True,
                deadline=NOW + timedelta(hours=3),
                kind="developer",
                requirements=frozenset({"python"}),
            ),
        ],
        NOW,
    )
    ids = [row["id"] for row in rows]
    assert ids == ["gig-1", "soon"]
    assert rows[0]["distance_km"] <= rows[1]["distance_km"]
    assert rows[1]["timed"] is True
    assert rows[0]["timed"] is False
    assert rows[0]["deadline"] is None


def test_map_pins_place_only_visible_gigs():
    pins = map_pins(worker(), [gig(), gig(id="far", place=FAR)], NOW)
    roles = {pin["role"] for pin in pins}
    ids = {pin["id"] for pin in pins}
    assert "worker" in roles
    assert "gig-1" in ids
    assert "far" not in ids
    for pin in pins:
        assert 0 <= pin["x"] <= 100
        assert 0 <= pin["y"] <= 100


def test_offer_can_move_a_negotiable_price_and_is_not_cash():
    asked = gig()
    fixed = gig(id="fixed", negotiable=False, asking_price_usd=25)
    moved = offer(worker(), asked, 55, NOW)
    same = offer(worker(), fixed, 25, NOW)
    refused = offer(worker(), fixed, 10, NOW)
    hidden = offer(worker(), gig(id="far", place=FAR), 55, NOW)
    assert moved["status"] == "offered"
    assert moved["price_usd"] == 55
    assert moved["paid"] is False
    assert moved["stripe_revenue"] is False
    assert same["status"] == "offered"
    assert refused["status"] == "refused"
    assert hidden["status"] == "hidden"
    assert hidden["paid"] is False


def test_board_shows_only_reachable_gigs_and_the_live_checkout_links():
    html = render_board(worker(), [gig(title="Review an A2A card"), gig(id="far", place=FAR, title="Dallas deploy")], NOW)
    assert "Review an A2A card" in html
    assert "Dallas deploy" not in html
    assert "hidden:far" not in html
    assert "far" not in html
    assert "https://authichain.com/checkout/qron_launch" in html
    assert "Offers are not payments." in html


def test_board_escapes_untrusted_gig_content():
    injected = gig(
        title="<img src=x onerror=alert(1)>",
        kind="<script>alert(2)</script>",
        place=Place(30.27, -97.74, "Research & Review"),
    )
    html = render_board(worker(), [injected], NOW)
    assert "<img" not in html
    assert "<script>" not in html
    assert "&lt;img src=x onerror=alert(1)&gt;" in html
    assert "&lt;script&gt;alert(2)&lt;/script&gt;" in html
    assert "Research &amp; Review" in html


def test_board_does_not_disclose_filtered_gig_identifiers():
    blocked = gig(id="private-hidden-gig-identifier", place=FAR)
    html = render_board(worker(), [gig(), blocked], NOW)
    assert "private-hidden-gig-identifier" not in html
    assert "gig-1" not in html or "hidden:" not in html  # IDs are not leaked in comments.
