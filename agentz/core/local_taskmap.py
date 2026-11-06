"""A Roadie-style map for A2A and developer work.

A worker sees only gigs they are qualified for and can reach.
Timed gigs disappear after the deadline. Untimed gigs stay open.
An offer may differ from the asking price only when the gig is
negotiable. An offer is not a payment and is not Stripe revenue.
"""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any

EARTH_KM = 6371.0


@dataclass(frozen=True)
class Place:
    lat: float
    lng: float
    label: str = ""


@dataclass(frozen=True)
class Gig:
    id: str
    title: str
    kind: str
    place: Place
    requirements: frozenset[str]
    asking_price_usd: float
    negotiable: bool
    timed: bool
    deadline: datetime | None = None


@dataclass(frozen=True)
class Worker:
    id: str
    place: Place
    qualifications: frozenset[str]
    range_km: float


def distance_km(a: Place, b: Place) -> float:
    lat1, lat2 = radians(a.lat), radians(b.lat)
    dlat = radians(b.lat - a.lat)
    dlng = radians(b.lng - a.lng)
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * EARTH_KM * asin(sqrt(h))


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def qualified(worker: Worker, gig: Gig) -> bool:
    return gig.requirements <= worker.qualifications


def reachable(worker: Worker, gig: Gig) -> bool:
    return distance_km(worker.place, gig.place) <= worker.range_km


def still_open(gig: Gig, now: datetime) -> bool:
    if not gig.timed:
        return True
    if gig.deadline is None:
        return False
    return _aware(gig.deadline) > _aware(now)


def scope(worker: Worker, gigs: list[Gig], now: datetime) -> list[dict[str, Any]]:
    """Gigs this worker may see, nearest first."""
    rows: list[dict[str, Any]] = []
    for gig in gigs:
        if not qualified(worker, gig) or not reachable(worker, gig):
            continue
        if not still_open(gig, now):
            continue
        rows.append(
            {
                "id": gig.id,
                "title": gig.title,
                "kind": gig.kind,
                "lat": gig.place.lat,
                "lng": gig.place.lng,
                "label": gig.place.label,
                "asking_price_usd": gig.asking_price_usd,
                "negotiable": gig.negotiable,
                "timed": gig.timed,
                "deadline": gig.deadline.isoformat() if gig.timed and gig.deadline else None,
                "distance_km": distance_km(worker.place, gig.place),
            }
        )
    rows.sort(key=lambda row: (row["distance_km"], row["id"]))
    return rows


def map_pins(worker: Worker, gigs: list[Gig], now: datetime) -> list[dict[str, Any]]:
    """Place the visible gigs on a local 0–100 board around the worker."""
    visible = scope(worker, gigs, now)
    points = [(worker.place.lat, worker.place.lng)] + [
        (row["lat"], row["lng"]) for row in visible
    ]
    lats = [lat for lat, _ in points]
    lngs = [lng for _, lng in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)
    lat_span = max(max_lat - min_lat, 0.01)
    lng_span = max(max_lng - min_lng, 0.01)

    def pin(lat: float, lng: float) -> tuple[float, float]:
        x = (lng - min_lng) / lng_span * 100
        y = (max_lat - lat) / lat_span * 100
        return round(x, 2), round(y, 2)

    worker_x, worker_y = pin(worker.place.lat, worker.place.lng)
    pins = [
        {
            "id": worker.id,
            "role": "worker",
            "x": worker_x,
            "y": worker_y,
            "lat": worker.place.lat,
            "lng": worker.place.lng,
        }
    ]
    for row in visible:
        x, y = pin(row["lat"], row["lng"])
        pins.append({**row, "role": "gig", "x": x, "y": y})
    return pins


def offer(
    worker: Worker,
    gig: Gig,
    price_usd: float,
    now: datetime,
) -> dict[str, Any]:
    """Record a price offer. This does not pay anyone."""
    visible = {row["id"] for row in scope(worker, [gig], now)}
    if gig.id not in visible:
        return {
            "status": "hidden",
            "reason": "The worker is not qualified, not in range, or the gig has expired.",
            "paid": False,
            "stripe_revenue": False,
        }
    if price_usd <= 0:
        return {
            "status": "refused",
            "reason": "The offer must be greater than zero.",
            "paid": False,
            "stripe_revenue": False,
        }
    if not gig.negotiable and price_usd != gig.asking_price_usd:
        return {
            "status": "refused",
            "reason": "This gig is not negotiable.",
            "paid": False,
            "stripe_revenue": False,
        }
    return {
        "status": "offered",
        "gig_id": gig.id,
        "worker_id": worker.id,
        "price_usd": price_usd,
        "asking_price_usd": gig.asking_price_usd,
        "negotiable": gig.negotiable,
        "paid": False,
        "stripe_revenue": False,
    }


def render_board(worker: Worker, gigs: list[Gig], now: datetime) -> str:
    """HTML board. Pins come from map_pins. Prices on the board are not charges."""
    pins = [pin for pin in map_pins(worker, gigs, now) if pin["role"] == "gig"]
    cards = []
    for pin in pins:
        price = f"${pin['asking_price_usd']:g}"
        window = "timed" if pin["timed"] else "untimed"
        talk = "negotiable" if pin["negotiable"] else "fixed price"
        cards.append(
            "<article class=\"gig\" style=\"left:{x}%;top:{y}%\">"
            "<h2>{title}</h2>"
            "<p>{kind} · {label} · {km:.1f} km</p>"
            "<p>{price} · {talk} · {window}</p>"
            "</article>".format(
                x=pin["x"],
                y=pin["y"],
                title=escape(str(pin["title"]), quote=True),
                kind=escape(str(pin["kind"]), quote=True),
                label=escape(str(pin["label"]), quote=True),
                km=pin["distance_km"],
                price=price,
                talk=talk,
                window=window,
            )
        )
    body = "\n".join(cards) if cards else "<p>No gigs in range for this worker.</p>"
    return (
        "<!doctype html><title>Local task map</title>"
        "<p>Offers are not payments.</p>"
        "<p><a href=\"https://authichain.com/checkout/qron_launch\">QRON Launch $19/mo</a>"
        " · <a href=\"https://authichain.com/checkout/qron_launch_annual\">QRON Launch annual $190/yr</a></p>"
        f"<section id=\"map\">{body}</section>"
    )
