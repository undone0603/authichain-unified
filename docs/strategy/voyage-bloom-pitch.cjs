/* eslint-disable @typescript-eslint/no-require-imports -- This .cjs pitch-deck script intentionally uses CommonJS semantics. */
// Voyage Bloom Pack-to-NFT + Storymode — 8-slide pitch deck
// Neon festival palette aligned to packaging energy.

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333" x 7.5"
pres.title = "Voyage Bloom — Pack to NFT + Cinematic Storymode";
pres.author = "AuthiChain / StrainChain / QRON";
pres.subject = "Phygital packaging collectibles pitch";

const C = {
  bg: "0A0A0B",
  cream: "F4EFE6",
  pink: "FF1F6B",
  yellow: "E8FF38",
  orange: "FF5A1F",
  purple: "9B59B6",
  white: "FFFFFF",
  ink: "0A0A0B",
  muted: "8A8A8A",
  hair: "2A2A2C",
  green: "10B981",
};

const F = "Arial";
const NBSP = "\u00A0";

function noOrphan(s) {
  if (!s) return s;
  const t = s.replace(/\s+/g, " ").trim();
  const idx = t.lastIndexOf(" ");
  if (idx === -1) return t;
  return t.slice(0, idx) + NBSP + t.slice(idx + 1);
}

function topBar(s, left, right) {
  s.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.36,
    fill: { color: C.pink },
    line: { color: C.pink },
  });
  s.addText(
    [
      { text: left, options: { bold: true, color: C.white } },
      { text: "     ·     ", options: { color: C.white } },
      { text: right, options: { color: C.white } },
    ],
    {
      x: 0.4,
      y: 0,
      w: 12.5,
      h: 0.36,
      align: "left",
      valign: "middle",
      fontFace: F,
      fontSize: 9,
      charSpacing: 3,
      margin: 0,
    }
  );
}

function bottomBar(s, text) {
  s.addShape("rect", {
    x: 0,
    y: 7.14,
    w: 13.333,
    h: 0.36,
    fill: { color: C.yellow },
    line: { color: C.yellow },
  });
  s.addText(text, {
    x: 0,
    y: 7.14,
    w: 13.333,
    h: 0.36,
    align: "center",
    valign: "middle",
    fontFace: F,
    fontSize: 9,
    bold: true,
    color: C.ink,
    charSpacing: 3,
    margin: 0,
  });
}

function pageNum(s, n) {
  s.addText(String(n).padStart(2, "0"), {
    x: 12.4,
    y: 6.7,
    w: 0.7,
    h: 0.3,
    fontFace: F,
    fontSize: 11,
    color: C.muted,
    align: "right",
    margin: 0,
  });
}

// ============================================================
// 1 — Cover
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "VOYAGE BLOOM × AUTHICHAIN", "PACK GENESIS");
  bottomBar(s, "PHYSICAL PACKAGING  →  QRON  →  NFT  →  CINEMATIC STORYMODE");

  s.addText("PACK → NFT", {
    x: 0.7,
    y: 1.6,
    w: 12,
    h: 1.2,
    fontFace: F,
    fontSize: 64,
    bold: true,
    color: C.yellow,
    margin: 0,
  });
  s.addText(noOrphan("Turn every pouch into a portal."), {
    x: 0.7,
    y: 2.9,
    w: 11,
    h: 0.6,
    fontFace: F,
    fontSize: 28,
    color: C.cream,
    margin: 0,
  });
  s.addText(
    noOrphan(
      "Phygital collectibles with artistic QRON authenticity, creator royalties, and cinematic product history — built on StrainChain + Polygon."
    ),
    {
      x: 0.7,
      y: 3.7,
      w: 10,
      h: 1.2,
      fontFace: F,
      fontSize: 16,
      color: C.muted,
      margin: 0,
    }
  );

  s.addShape("rect", {
    x: 0.7,
    y: 5.2,
    w: 3.2,
    h: 0.55,
    fill: { color: C.pink },
    line: { color: C.pink },
  });
  s.addText("10 SKUS READY", {
    x: 0.7,
    y: 5.2,
    w: 3.2,
    h: 0.55,
    align: "center",
    valign: "middle",
    fontFace: F,
    fontSize: 12,
    bold: true,
    color: C.white,
    margin: 0,
  });
  s.addShape("rect", {
    x: 4.1,
    y: 5.2,
    w: 3.6,
    h: 0.55,
    fill: { color: C.hair },
    line: { color: C.hair },
  });
  s.addText("ZANGRIA HERO PILOT", {
    x: 4.1,
    y: 5.2,
    w: 3.6,
    h: 0.55,
    align: "center",
    valign: "middle",
    fontFace: F,
    fontSize: 12,
    bold: true,
    color: C.yellow,
    margin: 0,
  });
  pageNum(s, 1);
}

// ============================================================
// 2 — Problem
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "THE PROBLEM", "DEAD PACKAGING · LOST LOYALTY · FAKES");
  bottomBar(s, "CPG SPENDS ON ART THAT DIES AT THE CASH REGISTER");

  s.addText(noOrphan("Beautiful packaging. Zero afterlife."), {
    x: 0.7,
    y: 0.8,
    w: 12,
    h: 0.7,
    fontFace: F,
    fontSize: 32,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const cards = [
    {
      t: "Dead packaging",
      d: "Character art stops working the moment the bag is empty. No collectibility, no secondary market.",
    },
    {
      t: "Counterfeit risk",
      d: "Plain QR codes clone easily. Consumers cannot prove a unit is real in two seconds.",
    },
    {
      t: "No post-purchase loop",
      d: "Brands lose the relationship after sale. No story, no claim, no reason to buy the next SKU.",
    },
  ];
  cards.forEach((c, i) => {
    const x = 0.7 + i * 4.1;
    s.addShape("rect", {
      x,
      y: 2.0,
      w: 3.85,
      h: 3.6,
      fill: { color: C.hair },
      line: { color: C.hair },
    });
    s.addShape("rect", {
      x,
      y: 2.0,
      w: 3.85,
      h: 0.12,
      fill: { color: i === 1 ? C.pink : C.yellow },
      line: { color: i === 1 ? C.pink : C.yellow },
    });
    s.addText(c.t.toUpperCase(), {
      x: x + 0.25,
      y: 2.4,
      w: 3.35,
      h: 0.8,
      fontFace: F,
      fontSize: 16,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(noOrphan(c.d), {
      x: x + 0.25,
      y: 3.4,
      w: 3.35,
      h: 1.8,
      fontFace: F,
      fontSize: 14,
      color: C.cream,
      margin: 0,
    });
  });
  pageNum(s, 2);
}

// ============================================================
// 3 — Solution
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "THE SOLUTION", "ONE SCAN · FOUR FUNCTIONS");
  bottomBar(s, "AUTHENTICITY  ·  NFT CLAIM  ·  STORYMODE  ·  PERKS");

  s.addText(noOrphan("Scan once. Own forever."), {
    x: 0.7,
    y: 0.75,
    w: 12,
    h: 0.55,
    fontFace: F,
    fontSize: 30,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const steps = [
    { n: "01", t: "Physical pack", d: "Pouch or can with artistic QRON" },
    { n: "02", t: "Scan hub", d: "Verify batch + serial on ledger" },
    { n: "03", t: "Claim NFT", d: "Email or wallet · 1 serial" },
    { n: "04", t: "Storymode", d: "Cinematic origin · unlock chapters" },
  ];
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.15;
    s.addText(st.n, {
      x,
      y: 1.7,
      w: 2.9,
      h: 0.5,
      fontFace: F,
      fontSize: 22,
      bold: true,
      color: C.pink,
      margin: 0,
    });
    s.addText(st.t, {
      x,
      y: 2.3,
      w: 2.9,
      h: 0.45,
      fontFace: F,
      fontSize: 18,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(noOrphan(st.d), {
      x,
      y: 2.85,
      w: 2.9,
      h: 0.8,
      fontFace: F,
      fontSize: 13,
      color: C.muted,
      margin: 0,
    });
    if (i < 3) {
      s.addText("→", {
        x: x + 2.7,
        y: 2.2,
        w: 0.4,
        h: 0.4,
        fontFace: F,
        fontSize: 20,
        color: C.muted,
        margin: 0,
      });
    }
  });

  s.addShape("rect", {
    x: 0.7,
    y: 4.1,
    w: 11.9,
    h: 2.3,
    fill: { color: C.hair },
    line: { color: C.hair },
  });
  s.addText("STORYMODE = FIRST-CLASS QRON FUNCTION", {
    x: 1.0,
    y: 4.35,
    w: 11,
    h: 0.4,
    fontFace: F,
    fontSize: 14,
    bold: true,
    color: C.pink,
    margin: 0,
  });
  s.addText(
    noOrphan(
      "Chapter 0 plays free — no wallet. Claiming the NFT unlocks origin, conflict, and resolution chapters. Same scan hub as authenticity. Same code as collectible. Product history becomes entertainment."
    ),
    {
      x: 1.0,
      y: 4.9,
      w: 11.2,
      h: 1.2,
      fontFace: F,
      fontSize: 15,
      color: C.cream,
      margin: 0,
    }
  );
  pageNum(s, 3);
}

// ============================================================
// 4 — Live art / collection
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "COLLECTION", "VOYAGE BLOOM PACK GENESIS · 10 SKUS");
  bottomBar(s, "HERO PILOT: ZANGRIA · SLURMZ · GREASI LEMON");

  s.addText(noOrphan("Meme-grade packaging. Ready to mint."), {
    x: 0.7,
    y: 0.7,
    w: 12,
    h: 0.5,
    fontFace: F,
    fontSize: 28,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const skus = [
    ["Zangria", "Thin Mint GSC × Zkittles"],
    ["Slurmz", "Can · Highly Potent"],
    ["Greasi Lemon", "Gas-mask citrus"],
    ["Cream Smoothie", "Gelonade × C.R.E.A.M."],
    ["Fruit Stand", "Gelonade × Zangria"],
    ["Permanent Marker", "Biscotti × Sherb × Jealousy"],
    ["Watermelon Zmartini", "Bar Lab 88"],
    ["Cherry Expo", "Pistachio Gelato × Rainbow Beltz"],
    ["Crunch Berries", "Pirate voyage"],
    ["Cherry Popperz", "Premiere night"],
  ];

  skus.forEach((row, i) => {
    const col = i < 5 ? 0 : 1;
    const r = i % 5;
    const x = 0.7 + col * 6.3;
    const y = 1.45 + r * 0.85;
    s.addShape("rect", {
      x,
      y,
      w: 6.0,
      h: 0.72,
      fill: { color: C.hair },
      line: { color: C.hair },
    });
    s.addText(row[0], {
      x: x + 0.2,
      y: y + 0.08,
      w: 5.5,
      h: 0.3,
      fontFace: F,
      fontSize: 14,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(row[1], {
      x: x + 0.2,
      y: y + 0.36,
      w: 5.5,
      h: 0.28,
      fontFace: F,
      fontSize: 12,
      color: C.muted,
      margin: 0,
    });
  });
  pageNum(s, 4);
}

// ============================================================
// 5 — Architecture
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "ARCHITECTURE", "ALREADY BUILT ON AUTHICHAIN");
  bottomBar(s, "POLYGON NFT  ·  QRON ART  ·  STRAINCHAIN  ·  SUPABASE LEDGER");

  const layers = [
    { t: "QRON", d: "Artistic scannable codes · ControlNet · editable redirects · analytics" },
    { t: "Hub", d: "/v/vb/{sku}/{batch}/{serial} · Verify · Storymode · Claim tabs" },
    { t: "NFT", d: "AuthiChainNFT (Polygon) · serial-bound · EIP-2981 royalties" },
    { t: "Story", d: "Cinematic player · chapter unlocks · 9:16 mobile-first" },
  ];
  layers.forEach((L, i) => {
    const y = 1.0 + i * 1.25;
    s.addShape("rect", {
      x: 0.7,
      y,
      w: 1.6,
      h: 1.0,
      fill: { color: i % 2 === 0 ? C.pink : C.yellow },
      line: { color: i % 2 === 0 ? C.pink : C.yellow },
    });
    s.addText(L.t, {
      x: 0.7,
      y,
      w: 1.6,
      h: 1.0,
      align: "center",
      valign: "middle",
      fontFace: F,
      fontSize: 16,
      bold: true,
      color: C.ink,
      margin: 0,
    });
    s.addShape("rect", {
      x: 2.5,
      y,
      w: 10.1,
      h: 1.0,
      fill: { color: C.hair },
      line: { color: C.hair },
    });
    s.addText(noOrphan(L.d), {
      x: 2.8,
      y,
      w: 9.5,
      h: 1.0,
      valign: "middle",
      fontFace: F,
      fontSize: 16,
      color: C.cream,
      margin: 0,
    });
  });
  pageNum(s, 5);
}

// ============================================================
// 6 — Economics
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "ECONOMICS", "PHYSICAL UPLIFT + ROYALTIES + PLATFORM");
  bottomBar(s, "ARTIST 4%  ·  BRAND 3%  ·  PLATFORM 1%  ON SECONDARY");

  s.addText(noOrphan("Three revenue engines, one pouch."), {
    x: 0.7,
    y: 0.75,
    w: 12,
    h: 0.5,
    fontFace: F,
    fontSize: 28,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const econ = [
    { t: "Physical uplift", d: "Collectors buy more SKUs for the set. Free NFT with purchase bootstraps claims." },
    { t: "Primary / secondary NFT", d: "Optional paid rares. Automatic royalties forever on resale." },
    { t: "Platform fees", d: "QRON generation + analytics tiers + white-label Pack-to-NFT SaaS." },
  ];
  econ.forEach((e, i) => {
    const x = 0.7 + i * 4.1;
    s.addShape("rect", {
      x,
      y: 1.6,
      w: 3.9,
      h: 3.8,
      fill: { color: C.hair },
      line: { color: C.hair },
    });
    s.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.25,
      y: 1.9,
      w: 3.3,
      h: 0.4,
      fontFace: F,
      fontSize: 14,
      bold: true,
      color: C.pink,
      margin: 0,
    });
    s.addText(e.t, {
      x: x + 0.25,
      y: 2.5,
      w: 3.3,
      h: 0.7,
      fontFace: F,
      fontSize: 18,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(noOrphan(e.d), {
      x: x + 0.25,
      y: 3.4,
      w: 3.3,
      h: 1.6,
      fontFace: F,
      fontSize: 14,
      color: C.cream,
      margin: 0,
    });
  });
  pageNum(s, 6);
}

// ============================================================
// 7 — Demo / pilot
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "PILOT", "500–2,000 UNITS · 3 HERO SKUS");
  bottomBar(s, "DEMO HUB: strainchain.io/v/vb/zangria/demo/00001");

  s.addText(noOrphan("Ship a live scan experience."), {
    x: 0.7,
    y: 0.75,
    w: 12,
    h: 0.5,
    fontFace: F,
    fontSize: 28,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const metrics = [
    { k: "Scan success", v: ">95%" },
    { k: "Story Ch.0 complete", v: ">40%" },
    { k: "NFT claim rate", v: ">15%" },
  ];
  metrics.forEach((m, i) => {
    const x = 0.7 + i * 4.1;
    s.addShape("rect", {
      x,
      y: 1.5,
      w: 3.9,
      h: 1.8,
      fill: { color: C.hair },
      line: { color: C.hair },
    });
    s.addText(m.v, {
      x: x + 0.2,
      y: 1.75,
      w: 3.5,
      h: 0.7,
      fontFace: F,
      fontSize: 36,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(m.k.toUpperCase(), {
      x: x + 0.2,
      y: 2.6,
      w: 3.5,
      h: 0.4,
      fontFace: F,
      fontSize: 12,
      bold: true,
      color: C.muted,
      margin: 0,
    });
  });

  s.addShape("rect", {
    x: 0.7,
    y: 3.7,
    w: 11.9,
    h: 2.6,
    fill: { color: C.hair },
    line: { color: C.hair },
  });
  s.addText("LIVE DEMO PATH", {
    x: 1.0,
    y: 4.0,
    w: 11,
    h: 0.35,
    fontFace: F,
    fontSize: 12,
    bold: true,
    color: C.pink,
    margin: 0,
  });
  s.addText(
    noOrphan(
      "1) Scan demo QRON (or open hub URL)  →  2) Verify tab shows authentic Zangria  →  3) Play Storymode Ch.0 free  →  4) Claim demo NFT  →  5) Unlock remaining chapters."
    ),
    {
      x: 1.0,
      y: 4.5,
      w: 11.3,
      h: 1.4,
      fontFace: F,
      fontSize: 16,
      color: C.cream,
      margin: 0,
    }
  );
  pageNum(s, 7);
}

// ============================================================
// 8 — Ask / next
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  topBar(s, "THE ASK", "PILOT COMMITMENT · WHITE-LABEL PATH");
  bottomBar(s, "AUTHICHAIN  ·  STRAINCHAIN  ·  QRON  ·  21+ COLLECTIBLE ART");

  s.addText(noOrphan("Let's immortalize the pack."), {
    x: 0.7,
    y: 0.8,
    w: 12,
    h: 0.6,
    fontFace: F,
    fontSize: 32,
    bold: true,
    color: C.cream,
    margin: 0,
  });

  const asks = [
    { t: "Pilot SKU commitment", d: "Zangria + 2 more · print QRONs · free claim NFTs · Ch.0 trailer live" },
    { t: "Creative license", d: "Packaging artist + brand rights for NFT + Storymode credits forever" },
    { t: "Success metric", d: "Redemption rate, story completion, secondary interest — 90-day review" },
  ];
  asks.forEach((a, i) => {
    const y = 1.7 + i * 1.35;
    s.addShape("rect", {
      x: 0.7,
      y,
      w: 0.15,
      h: 1.1,
      fill: { color: C.pink },
      line: { color: C.pink },
    });
    s.addText(a.t, {
      x: 1.1,
      y,
      w: 11,
      h: 0.4,
      fontFace: F,
      fontSize: 18,
      bold: true,
      color: C.yellow,
      margin: 0,
    });
    s.addText(noOrphan(a.d), {
      x: 1.1,
      y: y + 0.45,
      w: 11,
      h: 0.5,
      fontFace: F,
      fontSize: 15,
      color: C.muted,
      margin: 0,
    });
  });
  pageNum(s, 8);
}

pres
  .writeFile({
    fileName: "/home/zac/authichain-unified/docs/strategy/Voyage_Bloom_Pack_to_NFT_Pitch.pptx",
  })
  .then(() => console.log("Wrote Voyage_Bloom_Pack_to_NFT_Pitch.pptx"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
