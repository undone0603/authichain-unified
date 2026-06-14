"""Idempotent self-serve tier links (setup one-time + monthly recurring).

For each of the 3 licensing tiers, ensure Stripe has:
  - a product tagged metadata.authichain_tier=<key>
  - a one-time SETUP price + active payment link (metadata.authichain_tier=<key>)
  - a recurring MONTHLY price + active payment link (metadata.authichain_tier_monthly=<key>)
Reuses anything already present (keyed on the metadata markers); creates only what's missing.
Prints tier -> setup URL + monthly URL.

DRY RUN by default. Pass --apply to actually create missing objects.
"""
import sys
import httpx
from agentz.core.credentials import get
from agentz.core.licensing import LICENSE_TIERS

APPLY = "--apply" in sys.argv
k = get("stripe_secret")
h = {"Authorization": f"Bearer {k}", "Content-Type": "application/x-www-form-urlencoded"}
BASE = "https://api.stripe.com/v1"


def search_product(tier_key):
    r = httpx.get(f"{BASE}/products/search", headers=h,
                  params={"query": f"metadata['authichain_tier']:'{tier_key}'", "limit": 1}, timeout=25)
    data = r.json().get("data", [])
    return data[0] if data else None


def find_price(product_id, amount, recurring):
    r = httpx.get(f"{BASE}/prices", headers=h,
                  params={"product": product_id, "active": "true", "limit": 100}, timeout=25)
    for pr in r.json().get("data", []):
        is_rec = bool(pr.get("recurring"))
        if pr.get("unit_amount") == amount and is_rec == recurring:
            return pr
    return None


def find_link(price_id, meta_key, tier_key):
    r = httpx.get(f"{BASE}/payment_links", headers=h, params={"active": "true", "limit": 100}, timeout=25)
    for l in r.json().get("data", []):
        if l.get("metadata", {}).get(meta_key) == tier_key:
            li = httpx.get(f"{BASE}/payment_links/{l['id']}/line_items?limit=5", headers=h, timeout=25).json().get("data", [])
            if any(it.get("price", {}).get("id") == price_id for it in li):
                return l
    return None


def post(path, data):
    r = httpx.post(f"{BASE}{path}", headers=h, data=data, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"POST {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


def ensure_link(prod, amount, recurring, meta_key, tier_key):
    kind = "monthly" if recurring else "setup"
    price = find_price(prod["id"], amount, recurring)
    if not price:
        if not APPLY:
            print(f"   would CREATE {kind} price ${amount/100:,.0f}")
            return None
        data = {"product": prod["id"], "unit_amount": str(amount), "currency": "usd"}
        if recurring:
            data["recurring[interval]"] = "month"
        price = post("/prices", data)
        print(f"   created {kind} price {price['id']}")
    else:
        print(f"   {kind} price exists {price['id']}")
    link = find_link(price["id"], meta_key, tier_key)
    if not link:
        if not APPLY:
            print(f"   would CREATE {meta_key} link")
            return None
        link = post("/payment_links", {"line_items[0][price]": price["id"], "line_items[0][quantity]": "1",
                                       f"metadata[{meta_key}]": tier_key})
        print(f"   created {kind} link {link['id']}")
    else:
        print(f"   {kind} link exists {link['id']}")
    return link["url"]


print(f"{'APPLY' if APPLY else 'DRY-RUN'} mode\n")
results = {}
for key, t in LICENSE_TIERS.items():
    label = f"{t.name} (${t.setup_fee_usd:,} setup + ${t.monthly_usd:,}/mo)"
    prod = search_product(key)
    if not prod:
        if not APPLY:
            print(f"[{label}] would CREATE product")
            results[key] = (None, None)
            continue
        prod = post("/products", {"name": f"{t.name} — Setup", "metadata[authichain_tier]": key,
                                  "description": t.ideal_for[:200]})
        print(f"[{label}] created product {prod['id']}")
    else:
        print(f"[{label}] product exists {prod['id']}")
    setup_url = ensure_link(prod, t.setup_fee_usd * 100, False, "authichain_tier", key)
    monthly_url = ensure_link(prod, t.monthly_usd * 100, True, "authichain_tier_monthly", key)
    results[key] = (setup_url, monthly_url)

print("\n=== SELF-SERVE TIER LINKS ===")
for key, t in LICENSE_TIERS.items():
    s, m = results.get(key, (None, None))
    print(f"  {t.name:30} setup ${t.setup_fee_usd:>6,} -> {s or '(missing)'}")
    print(f"  {'':30} mo    ${t.monthly_usd:>6,} -> {m or '(missing)'}")
