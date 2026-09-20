#!/usr/bin/env python3
"""One-off import helper: copy Undone0603 pulls with import header + QRON price scrub."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/tmp/undone-pack/pulled-from-undone0603")

IMPORT_NOTE = (
    "> Imported from Undone0603 sibling repo on 2026-09-20. "
    "Historical prices scrubbed — use live Stripe/`plans.ts` only.\n\n"
)

QRON_PRICING = (
    "See live pricing at [qron.space/pricing](https://qron.space/pricing) "
    "(also [authichain.com/pricing](https://authichain.com/pricing))."
)
AUTH_PRICING = "See live pricing at [authichain.com/pricing](https://authichain.com/pricing)."

# QRON portal list prices (excludes $500-style comparison amounts).
PRODUCT_PRICE = re.compile(
    r"(?<![0-9,$])"
    r"\$(?:\d{1,2}(?:\.\d{2})?(?:\s*[-–—]\s*\$?\d{1,2}(?:\.\d{2})?)?|\d{2,3}\+)"
    r"(?:\s*/\s*(?:portal|listing|code|mo(?:nth)?))?"
)


def polish_scrub_artifacts(text: str) -> str:
    p = re.escape(QRON_PRICING)
    text = re.sub(rf"{p}\.\.", QRON_PRICING, text)
    text = re.sub(rf"{p}\. \(", " (", text)
    text = re.sub(rf"{p}\. per (?:QRON )?portal\.?", QRON_PRICING, text, flags=re.I)
    text = re.sub(rf"{p}\. to upgrade:", f"{QRON_PRICING} To upgrade:", text, flags=re.I)
    text = re.sub(rf"Stand out for {p}\.:", f"Stand out — {QRON_PRICING}", text, flags=re.I)
    text = re.sub(rf"Upgrade for {p}\.:", f"Upgrade — {QRON_PRICING}", text, flags=re.I)
    text = re.sub(rf"Cosmic Nebula mode: {p}\.", f"Cosmic Nebula mode — {QRON_PRICING}", text)
    text = re.sub(rf"TEAL PULSE mode: {p}\.", f"TEAL PULSE mode — {QRON_PRICING}", text)
    text = re.sub(rf"{p}\. depending on style\.?", QRON_PRICING, text, flags=re.I)
    text = re.sub(rf"{p}\. \(one-time\)", QRON_PRICING, text, flags=re.I)
    text = re.sub(rf"Usually {p}\. \(and ugly\)", "Usually free generic codes (and ugly)", text)
    text = re.sub(
        rf"QRON Living Portal: {p}\. \(and stunning\)",
        f"QRON Living Portal — {QRON_PRICING} (and stunning)",
        text,
    )
    text = re.sub(
        rf"QR code that appears on ALL of these: Usually {p}\. \(and ugly\)",
        "QR code that appears on ALL of these: Usually free generic codes (and ugly)",
        text,
    )
    text = re.sub(
        r"• (Logo design|Website|Business cards|Marketing materials) \(typical vendor spend — not QRON portal pricing\) \(also [^\)]+\)\.\)",
        r"• \1 (typical vendor spend — not QRON portal pricing)",
        text,
    )
    text = re.sub(rf"{p}\. to upgrade:", f"{QRON_PRICING} To upgrade:", text, flags=re.I)
    text = re.sub(rf"Upgrade for {p}\.:", f"Upgrade — {QRON_PRICING}", text, flags=re.I)
    text = re.sub(rf"Stand out for {p}\.:", f"Stand out — {QRON_PRICING}", text, flags=re.I)
    text = re.sub(
        rf"See live pricing at \[qron\.space/pricing\]\([^\)]+\) \(also \[authichain\.com/pricing\]\([^\)]+\)\)\. - ",
        f"{QRON_PRICING}\n- ",
        text,
    )
    text = re.sub(
        rf"See live pricing at \[qron\.space/pricing\]\([^\)]+\) \(also \[authichain\.com/pricing\]\([^\)]+\)\)\.\+ - ",
        f"{QRON_PRICING}\n- ",
        text,
    )
    text = re.sub(
        r"Logo design: [^\n]+",
        "Logo design: typical vendor spend varies (not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"Business cards: [^\n]+",
        "Business cards: typical vendor spend varies (not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"Website: [^\n]+",
        "Website: typical vendor spend varies (not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"Marketing materials: [^\n]+",
        "Marketing materials: typical vendor spend varies (not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"• Logo design \([^\)]+\)",
        "• Logo design (typical vendor spend — not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"• Website \([^\)]+\)",
        "• Website (typical vendor spend — not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"• Business cards \([^\)]+\)",
        "• Business cards (typical vendor spend — not QRON portal pricing)",
        text,
    )
    text = re.sub(
        r"• Marketing materials \([^\)]+\)",
        "• Marketing materials (typical vendor spend — not QRON portal pricing)",
        text,
    )
    text = text.replace("$XX/portal", QRON_PRICING)
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Core \(Neon Glitch, Matrix, Teal Pulse\))",
        rf"- **Core styles** (Neon Glitch, Matrix, Teal Pulse) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Signature \(Holographic, Prism, Bioluminescent\))",
        rf"- **Signature styles** (Holographic, Prism, Bioluminescent) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Premium \(Cosmic Nebula, Aurora Dreams\))",
        rf"- **Premium styles** (Cosmic Nebula, Aurora Dreams) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Core styles \(Glitch, Matrix\))",
        rf"- **Core styles** (Glitch, Matrix) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Signature \(Holographic, Prism\))",
        rf"- **Signature styles** (Holographic, Prism) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}: (Premium \(Cosmic, Aurora\))",
        rf"- **Premium styles** (Cosmic, Aurora) — {QRON_PRICING}",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"- \*\*Tier pricing:\*\* Core \(Neon Glitch, Matrix, Teal Pulse\)\n"
        r"- \*\*Tier pricing:\*\* Signature \(Holographic, Prism, Bioluminescent\)\n"
        r"- \*\*Tier pricing:\*\* Premium \(Cosmic Nebula, Aurora Dreams\)",
        f"{QRON_PRICING}\n\n"
        "- **Core styles:** Neon Glitch, Matrix, Teal Pulse\n"
        "- **Signature styles:** Holographic, Prism, Bioluminescent\n"
        "- **Premium styles:** Cosmic Nebula, Aurora Dreams",
        text,
    )
    return text


def scrub_qron_marketing(text: str) -> str:
    text = re.sub(
        r"### Suggested Price: \$[^\n]+",
        f"### Pricing\n\n{QRON_PRICING}",
        text,
        flags=re.I,
    )
    text = re.sub(
        r"(🌟 PREMIUM TIER|✨ SIGNATURE TIER|⚡ CORE TIER)\s*\(\$[^\)]+\)",
        rf"\1 — {QRON_PRICING}",
        text,
    )
    text = re.sub(
        r"- \*\*Target:\*\* \$[^\n]+",
        "- **Target:** _Historical forecast removed — plan against live Stripe/`plans.ts`._",
        text,
    )
    text = re.sub(
        r"(?i)^.*Average order (?:value|target):.*$",
        f"_Historical AOV targets removed — {QRON_PRICING}_",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"\(\$[^)]+\)",
        f"({QRON_PRICING})",
        text,
    )
    text = re.sub(
        r"(?i)^.*\$\d[\d,]+.*(?:revenue|MRR|annual revenue|additional annual|worth of premium).*",
        "_Historical revenue figures removed — see live Stripe/`plans.ts`._",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"(?i)^.*(?:pay \$|Free marketing\. \$|Total development cost: \$|How I built QRON.*\$0 budget).*$",
        "_Historical founder-story figures removed._",
        text,
        flags=re.M,
    )
    text = re.sub(r"(?i)\$\d+k[^\n]*", "_Historical revenue goal removed._", text)
    text = re.sub(
        r"(?i)^.*\$\d{1,3},\d{3}.*$",
        "_Historical revenue figure removed._",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"(?i)^(?:Pricing:|Price:|From \$|💰 \$|→ \$).*",
        QRON_PRICING,
        text,
        flags=re.M,
    )
    # Replace standalone product price tokens (tables, tiers, tweets).
    text = PRODUCT_PRICE.sub(QRON_PRICING, text)
    text = re.sub(
        rf"{re.escape(QRON_PRICING)}\.?\s*per (?:QRON )?portal\.?",
        QRON_PRICING,
        text,
        flags=re.I,
    )
    text = re.sub(
        rf"{re.escape(QRON_PRICING)}\.?\s*each \(normally {re.escape(QRON_PRICING)}\.\)",
        QRON_PRICING,
        text,
        flags=re.I,
    )
    text = re.sub(
        rf"^{re.escape(QRON_PRICING)}:\s*",
        "- **Tier pricing:** ",
        text,
        flags=re.M,
    )
    # Lines that became only pricing after scrub — collapse duplicates on adjacent lines.
    lines: list[str] = []
    for line in text.splitlines():
        if line.strip() == QRON_PRICING and lines and lines[-1].strip() == QRON_PRICING:
            continue
        lines.append(line)
    text = "\n".join(lines)
    if not text.endswith("\n"):
        text += "\n"
    text = polish_scrub_artifacts(text)
    return text


def scrub_starter_readme(text: str) -> str:
    text = re.sub(
        r"- \*\*Pro\*\* \(\$\d+\.\d+/mo\):[^\n]+",
        f"- **Pro**: Unlimited generations, all modes except Enterprise — {AUTH_PRICING}",
        text,
    )
    return text


COPY_MAP: list[tuple[Path, Path, str]] = [
    (
        SRC / "qron-webapp/QRON-LIVING-PORTALS-MASTER-STRATEGY.md",
        ROOT / "docs/marketing/qron/QRON-LIVING-PORTALS-MASTER-STRATEGY.md",
        "qron",
    ),
    (
        SRC / "qron-webapp/ONE-CLICK-LAUNCH-CHECKLIST.md",
        ROOT / "docs/launch/qron-one-click-checklist.md",
        "qron",
    ),
    (
        SRC / "qron-webapp/SAMPLE-CATALOG.md",
        ROOT / "docs/marketing/qron/SAMPLE-CATALOG.md",
        "qron",
    ),
    (
        SRC / "qron-webapp/TWITTER-READY-TO-POST.md",
        ROOT / "content/social/archive-qron-2025/TWITTER-READY-TO-POST.md",
        "qron",
    ),
    (
        SRC / "qron-webapp/SOCIAL-MEDIA-CONTENT-LIBRARY.md",
        ROOT / "content/social/archive-qron-2025/SOCIAL-MEDIA-CONTENT-LIBRARY.md",
        "qron",
    ),
    (
        SRC / "qron-webapp/INSTAGRAM-LINKEDIN-READY.md",
        ROOT / "content/social/archive-qron-2025/INSTAGRAM-LINKEDIN-READY.md",
        "qron",
    ),
    (
        SRC / "authichain-unified-revenue-engine/ARCHITECTURE.md",
        ROOT / "docs/strategy/legacy-revenue-engine-ARCHITECTURE.md",
        "strategy",
    ),
    (
        SRC / "authichain-protocol/HISTORICAL_PRICING_TIERS.md",
        ROOT / "docs/strategy/historical-protocol-pricing-tiers.md",
        "historical",
    ),
    (
        SRC / "qron-starter-v2/README.md",
        ROOT / "docs/qron/starter-legacy-readme.md",
        "starter",
    ),
]

OPS = [
    (
        Path("/tmp/undone-pack/UNDONE0603_REPO_INVENTORY_2026-09-20.md"),
        ROOT / "docs/operations/UNDONE0603_REPO_INVENTORY_2026-09-20.md",
    ),
    (
        Path("/tmp/undone-pack/UNDONE0603_PULL_CANDIDATES_2026-09-20.md"),
        ROOT / "docs/operations/UNDONE0603_PULL_CANDIDATES_2026-09-20.md",
    ),
]

STRATEGY_NOTE = (
    "> Imported from Undone0603 sibling repo on 2026-09-20. "
    "**Legacy / non-live reference** — do not treat as current production architecture or pricing.\n\n"
)

HISTORICAL_BANNER = (
    "> **NOT LIVE — DO NOT PUBLISH AS CURRENT PRICING.**\n"
    "> Imported from Undone0603 `authichain-protocol` on 2026-09-20. "
    "Reconcile any customer-facing use with live Stripe / `src/lib/plans.ts` only.\n\n"
)


def main() -> None:
    for src, dest, kind in COPY_MAP:
        dest.parent.mkdir(parents=True, exist_ok=True)
        text = src.read_text(encoding="utf-8")
        if kind == "qron":
            text = scrub_qron_marketing(text)
            header = IMPORT_NOTE
        elif kind == "historical":
            header = HISTORICAL_BANNER
        elif kind == "starter":
            text = scrub_starter_readme(text)
            header = STRATEGY_NOTE
        else:
            header = STRATEGY_NOTE
        dest.write_text(header + text, encoding="utf-8")
        print(f"wrote {dest.relative_to(ROOT)}")

    for src, dest in OPS:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
