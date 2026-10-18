/**
 * build-entry.cjs
 * Shared catalogue builder for scripts/gen-seo-pages.cjs.
 * This module does not write pages.json. The generator calls assembleCatalogue
 * and only then writes. Hold slugs keep the committed page and refresh the
 * Get started block. Goal slugs must match the one public goal's slots.
 */
const BRANDS = {
  authichain: { name: 'AuthiChain', domain: 'authichain.com', origin: 'authichain.com', price: 'EU DPP Readiness is $299 one-time.' },
  strainchain: { name: 'StrainChain', domain: 'strainchain.io', price: 'Genetics passport is $49 one-time.' },
  govchain: { name: 'GovChain', domain: 'govchain.us', price: 'No enterprise contract — public-sector pricing.' },
  qron: { name: 'QRON', domain: 'qron.space', price: 'QRON packs from $29 one-time.' },
};

const LIVE_MONEY = {
  authichainDppCheckout: 'https://authichain.com/checkout/dpp_readiness',
  authichainDppPay: 'https://authichain.com/checkout/dpp_readiness',
  authichainPricing: 'https://authichain.com/pricing',
  authichainDppCheck: 'https://authichain.com/dpp-check',
  strainchainPassportCheckout: 'https://authichain.com/checkout/strainchain_passport',
  strainchainPassportPay: 'https://authichain.com/checkout/strainchain_passport',
  // Public sample of the $299 assessment (#1340); shown before checkout on
  // battery pages so a buyer sees what they get before paying.
  batterySampleAudit: 'https://authichain.com/battery-passport/sample-audit',
};

function isDppKeyword(keyword) {
  return /digital product passport|\bdpp\b|batter(?:y|ies)|textiles/i.test(keyword);
}

function isBatteryKeyword(keyword) {
  return /batter(?:y|ies)|\blmt\b|e-bike|e-scooter/i.test(keyword);
}

function isCannabisKeyword(keyword) {
  return /\b(cannabis|metrc|strain|coa|dispensary|biotrack)\b/i.test(keyword);
}

function isMusaKeyword(keyword) {
  return /made in (usa|america)|origin claim|16 cfr|ftc made in|buy american/i.test(keyword);
}

function isTrumarkKeyword(keyword) {
  return /trumark/i.test(keyword);
}

function isCheckoutUrl(href) {
  return /\/api\/checkout\/|\/checkout\//.test(href);
}

function checkoutEmailFormHtml(action, label) {
  return (
    `<form class="checkout-email-form" action="${esc(action).replace(/"/g, "&quot;")}" method="${isCheckoutUrl(action) && /^https:\/\/authichain\.com\/checkout\//.test(action) ? "post" : "get"}">` +
    `<label class="checkout-email-label" for="checkout-email">Work email` +
    `<input id="checkout-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com">` +
    `</label>` +
    `<p class="checkout-email-hint">We use this for your receipt and to follow up if checkout doesn't finish. No newsletter.</p>` +
    `<button class="btn btn-primary" type="submit">${esc(label)}</button>` +
    `</form>`
  );
}

function moneyCtaHtml(brandKey, keyword, brand) {
  let primaryHref;
  let primaryLabel;
  let secondaryHref = null;
  let secondaryLabel = null;
  const cannabis = isCannabisKeyword(keyword);
  const dpp = isDppKeyword(keyword);
  const battery = isBatteryKeyword(keyword);
  const musa = isMusaKeyword(keyword);
  const trumark = isTrumarkKeyword(keyword);
  if (trumark) {
    primaryHref = LIVE_MONEY.strainchainPassportCheckout;
    primaryLabel = 'Start StrainChain passport checkout';
    secondaryHref = 'https://authichain.govchain.us/trumark';
    secondaryLabel = 'Read the TruMark brief';
  } else if (musa || ((dpp || brandKey === 'authichain') && !cannabis)) {
    primaryHref = LIVE_MONEY.authichainDppCheckout;
    primaryLabel = 'Start DPP readiness checkout';
    secondaryHref = musa
      ? 'https://authichain.govchain.us/made-in-america'
      : LIVE_MONEY.authichainPricing;
    secondaryLabel = musa ? 'Read the Made in America brief' : 'View AuthiChain pricing';
  } else if (cannabis || brandKey === 'strainchain') {
    if (cannabis) {
      primaryHref = LIVE_MONEY.strainchainPassportCheckout;
      primaryLabel = 'Start StrainChain passport checkout';
      secondaryHref = `https://${BRANDS.strainchain.domain}/pricing`;
      secondaryLabel = 'View StrainChain pricing';
    } else {
      primaryHref = `https://${BRANDS.strainchain.domain}/pricing`;
      primaryLabel = 'View StrainChain pricing';
    }
  } else if (brandKey === 'govchain') {
    primaryHref = `https://${brand.domain}/onboard`;
    primaryLabel = 'Request GovChain access';
  } else {
    primaryHref = `https://${brand.domain}/pricing`;
    primaryLabel = `View ${brand.name} pricing`;
  }
  if (isCheckoutUrl(primaryHref)) {
    const pay =
      primaryHref === LIVE_MONEY.strainchainPassportCheckout
        ? `<p><a href="${LIVE_MONEY.strainchainPassportPay}">Pay $49 on Stripe</a></p>`
        : primaryHref === LIVE_MONEY.authichainDppCheckout
          ? `<p><a href="${LIVE_MONEY.authichainDppPay}">Pay $299 on Stripe</a></p>`
          : '';
    const extra = secondaryHref
      ? `<p><a href="${secondaryHref}">${esc(secondaryLabel)}</a>. ${esc(brand.price)}</p>`
      : `<p>${esc(brand.price)}</p>`;
    // Farm is not a public offer. The generator must not emit its checkout.
    const farm = '';
    const freeCheck =
      dpp && primaryHref === LIVE_MONEY.authichainDppCheckout
        ? `<p>Not sure what applies to you? <a href="${LIVE_MONEY.authichainDppCheck}">Take the free DPP readiness check</a> first.</p>`
        : '';
    const batterySample =
      battery && primaryHref === LIVE_MONEY.authichainDppCheckout
        ? `<p>Want to see a fictional walkthrough first? <a href="${LIVE_MONEY.batterySampleAudit}">Read the fictional e-bike walkthrough</a>.</p>`
        : '';
    return (
      `<h2>Get started</h2>` +
      freeCheck +
      batterySample +
      checkoutEmailFormHtml(primaryHref, primaryLabel) +
      pay +
      farm +
      extra
    );
  }
  const links =
    `<a href="${primaryHref}">${esc(primaryLabel)}</a>` +
    (secondaryHref ? ` · <a href="${secondaryHref}">${esc(secondaryLabel)}</a>` : '');
  return `<h2>Get started</h2><p>${links}. ${esc(brand.price)}</p>`;
}

function brandKeyForPage(page) {
  const byName = Object.keys(BRANDS).find((k) => BRANDS[k].name === page.brand);
  if (byName) return byName;
  return Object.keys(BRANDS).find((k) => BRANDS[k].domain === page.domain) || null;
}

// authichain.govchain.us is only a fallback host. Seed pages that still name
// it in jsonLd hand their canonical (worker-app renders jsonLd.url as
// <link rel=canonical>) to the wrong host. Root seed URLs 301 to /p/<slug>.
const AUTHICHAIN_ROOT_PAGES = new Set(['authentic-agentic-economy']);
function normalizeAuthichainHost(page) {
  if (page.domain !== 'authichain.com' || !page.jsonLd) return page;
  const target = AUTHICHAIN_ROOT_PAGES.has(page.slug)
    ? `https://authichain.com/${page.slug}`
    : `https://authichain.com/p/${page.slug}`;
  const json = JSON.stringify(page.jsonLd)
    .split(`https://authichain.govchain.us/${page.slug}"`).join(`${target}"`)
    .split('https://authichain.govchain.us').join('https://authichain.com');
  return { ...page, jsonLd: JSON.parse(json) };
}

function ensureMoneyCta(page) {
  if (typeof page.bodyHtml !== 'string') return page;
  const brandKey = brandKeyForPage(page);
  if (!brandKey) return page;
  const cta = moneyCtaHtml(brandKey, page.keyword || '', BRANDS[brandKey]);
  const startMarker = '<h2>Get started</h2>';
  const start = page.bodyHtml.indexOf(startMarker);
  if (start === -1) {
    const faq = page.bodyHtml.indexOf('<h2>FAQ</h2>');
    const bodyHtml =
      faq === -1
        ? page.bodyHtml + cta
        : page.bodyHtml.slice(0, faq) + cta + page.bodyHtml.slice(faq);
    return { ...page, bodyHtml };
  }
  const after = start + startMarker.length;
  const nextH2 = page.bodyHtml.indexOf('<h2>', after);
  const end = nextH2 === -1 ? page.bodyHtml.length : nextH2;
  return {
    ...page,
    bodyHtml: page.bodyHtml.slice(0, start) + cta + page.bodyHtml.slice(end),
  };
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ACRONYMS = { qr: 'QR', eu: 'EU', us: 'US', gs1: 'GS1', epcis: 'EPCIS', dscsa: 'DSCSA', dpp: 'DPP', eudr: 'EUDR', ppwr: 'PPWR', did: 'DID', cen: 'CEN', cenelec: 'CENELEC', espr: 'ESPR', nft: 'NFT', fsma: 'FSMA', iso: 'ISO', sd: 'SD', jwt: 'JWT', eudi: 'EUDI', cbam: 'CBAM', w3c: 'W3C', api: 'API', iec: 'IEC', jtc: 'JTC', dfars: 'DFARS', agec: 'AGEC', sb: 'SB', epr: 'EPR', usa: 'USA', usda: 'USDA', weee: 'WEEE', dsa: 'DSA', sme: 'SME', eudamed: 'EUDAMED', udi: 'UDI', ai: 'AI', fmd: 'FMD', emvs: 'EMVS', csddd: 'CSDDD', ftc: 'FTC', oid4vci: 'OID4VCI', uk: 'UK', eo: 'EO', trumark: 'TruMark', jcs: 'JCS', rdf: 'RDF', cmmc: 'CMMC', mcp: 'MCP', fips: 'FIPS', rfc: 'RFC' };
const titleCase = (s) =>
  s.split(/\b/).map((w) => {
    const lw = w.toLowerCase();
    if (ACRONYMS[lw]) return ACRONYMS[lw];
    return w.replace(/^[a-z]/, (c) => c.toUpperCase());
  }).join('');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function clampMeta(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.]+$/, '') + '.';
}
function clampTitle(kwTitle, brand, max = 60) {
  const suffix = ` | ${brand}`;
  const full = `${kwTitle}${suffix}`;
  if (full.length <= max) return full;
  const room = max - suffix.length;
  const cut = kwTitle.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  const kw = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s|,;:-]+$/, '');
  return `${kw}${suffix}`;
}

function buildEntry(d) {
  const b = BRANDS[d.brand];
  const kwTitle = titleCase(d.keyword);
  const slug = slugify(d.keyword);
  const url = `https://${b.origin || b.domain}/p/${slug}`;
  // d.title / d.h1 (optional) override the keyword-derived title and h1 without
  // moving the slug. Used where the keyword reads as an offering the page says
  // does not exist (RES pq-page check, item 9). d.title is the full <title>.
  const title = d.title || clampTitle(kwTitle, b.name);
  const firstSentence = d.lead.split('. ')[0].replace(/\.$/, '');
  // d.meta (optional) pins the meta description to the lead's first sentence
  // without the price suffix. Used where a claims removal (RES-13) shortened
  // a lead and the template would otherwise pull a new $ clause into meta.
  // A lead that already says an offer is not public must keep that sentence.
  // The price suffix would replace it ("Farm is not a public offer.").
  const metaDescription = d.meta
    ? clampMeta(d.meta, 158)
    : /not a public offer/i.test(d.lead)
      ? clampMeta(d.lead, 158)
      : clampMeta(`${firstSentence}. ${b.name} — ${b.price}`, 158);
  const h1 = d.h1 || kwTitle;
  const bodyHtml =
    `<p>${esc(d.lead)}</p>` +
    (d.bullets.length
      ? `<h2>Why ${esc(b.name)}</h2>` + `<ul>${d.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '') +
    `<h2>How it works</h2>` +
    // d.howItWorks (optional) overrides the How-it-works line for one entry (RES-100 F5).
    `<p>${d.howItWorks ? esc(d.howItWorks) : 'Issue a unique identifier per unit and link it to a signed record.'} ${esc(b.price)}</p>` +
    moneyCtaHtml(d.brand, d.keyword, b) +
    (d.faqs.length ? `<h2>FAQ</h2>` + d.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': d.schemaType,
        ...(d.schemaType === 'Article' ? { headline: h1, name: h1 } : { name: `${b.name} — ${kwTitle}` }),
        ...(d.schemaType === 'Product'
          ? { brand: { '@type': 'Brand', name: b.name } }
          : d.schemaType === 'Article'
            ? { publisher: { '@type': 'Organization', name: b.name, url: `https://${b.origin || b.domain}` } }
            : { provider: { '@type': 'Organization', name: b.name, url: `https://${b.origin || b.domain}` } }),
        description: d.lead,
        url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: b.name, item: `https://${b.origin || b.domain}` },
          { '@type': 'ListItem', position: 2, name: h1, item: url },
        ],
      },
      ...(d.faqs.length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: d.faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ]
        : []),
    ],
  };
  // noindex: true keeps a page reachable at /p/<slug> but out of
  // sitemap-slugs.json; worker-app/dynamic-pages.ts emits robots noindex for it.
  return { slug, keyword: d.keyword, brand: b.name, domain: b.domain, title, metaDescription, h1, bodyHtml, jsonLd, ...(d.noindex ? { noindex: true } : {}) };
}

function pageText(page) {
  if (!page) return '';
  return [
    page.title || '',
    page.h1 || '',
    page.metaDescription || '',
    page.bodyHtml || '',
    page.jsonLd ? JSON.stringify(page.jsonLd) : '',
  ].join('\n');
}

function recordsForSlug(claims, slug) {
  return claims.filter((c) => Array.isArray(c.slugs) && c.slugs.includes(slug));
}

function explicitOwners(records) {
  return records.filter((c) => c.publicGoal === true);
}

function emitFor(records) {
  if (records.some((c) => c.emit === 'hold')) return 'hold';
  if (records.some((c) => c.emit === 'goal')) return 'goal';
  return 'source';
}

function assertStatusLegal(claims) {
  const ids = new Set();
  for (const c of claims) {
    if (!c.id) throw new Error('claim record is missing id');
    if (ids.has(c.id)) throw new Error(`${c.id}: duplicate claim id`);
    ids.add(c.id);
    if (c.class !== 'copy-only' && c.class !== 'behavior-later') {
      throw new Error(`${c.id}: class must be copy-only or behavior-later`);
    }
    if (c.status === 'done') {
      if (c.class === 'copy-only') {
        throw new Error(`${c.id}: copy-only cannot be status done`);
      }
      if (c.blockedBy !== 'none') {
        throw new Error(`${c.id}: blockedBy is set, so status done is illegal`);
      }
    }
  }
}

function ownerForSlug(claims, slug) {
  const records = recordsForSlug(claims, slug);
  const owners = explicitOwners(records);
  if (owners.length > 1) {
    throw new Error(
      `${slug}: ${owners.length} publicGoal records (${owners.map((o) => o.id).join(', ')})`
    );
  }
  if (owners.length === 1) return owners[0];
  const fallbacks = claims.filter((c) => c.publicGoalIfNoOtherOwner === true);
  if (fallbacks.length === 1) return fallbacks[0];
  throw new Error(`${slug}: no public goal owner`);
}

function openHowItWorksAllowed(record) {
  return record.id === 'generated-how-it-works' && record.status === 'open';
}

function checkEmittedPage(page, records, emit) {
  const text = pageText(page);
  const owner = explicitOwners(records)[0] || null;
  if (emit !== 'hold' && emit !== 'goal') return;
  for (const c of records) {
    if (c.limitPermanent === true && c.currentSentence && !text.includes(c.currentSentence)) {
      throw new Error(`${c.id}: permanent limit missing on ${page.slug}: ${c.currentSentence}`);
    }
    if (
      c.limitPermanent !== true &&
      c.currentSentence &&
      !openHowItWorksAllowed(c) &&
      text.includes(c.currentSentence)
    ) {
      throw new Error(`${c.id}: banned currentSentence would be emitted on ${page.slug}`);
    }
    for (const phrase of c.bannedRestorations || []) {
      if (phrase && text.includes(phrase)) {
        throw new Error(`${c.id}: banned restoration would be emitted on ${page.slug}`);
      }
    }
  }
  if (emit === 'goal' && owner) {
    if (owner.goalSentence && !text.includes(owner.goalSentence)) {
      throw new Error(`${owner.id}: owner goal missing on ${page.slug}`);
    }
    if (/\bOur goal\b/i.test(page.metaDescription || '') || /\bOur goal\b/i.test(page.title || '') || /\bOur goal\b/i.test(page.h1 || '')) {
      throw new Error(`${owner.id}: goal inside title, h1, or meta on ${page.slug}`);
    }
    for (const c of records) {
      if (c.publicGoal || !c.goalSentence || openHowItWorksAllowed(c)) continue;
      if (owner.goalSentence && c.goalSentence === owner.goalSentence) continue;
      if (text.includes(c.goalSentence)) {
        throw new Error(`${c.id}: sibling goal rendered on ${page.slug}`);
      }
    }
  }
}

function assertDataMatchesSlots(entry, owner) {
  const slots = owner && owner.slots;
  if (!slots) return;
  if (slots.lead != null && entry.lead !== slots.lead) {
    throw new Error(`${owner.id}: DATA lead does not equal slots.lead on ${entry.keyword}`);
  }
  if (slots.meta != null && entry.meta !== slots.meta) {
    throw new Error(`${owner.id}: DATA meta does not equal slots.meta on ${entry.keyword}`);
  }
  if (slots.howItWorks != null && entry.howItWorks !== slots.howItWorks) {
    throw new Error(`${owner.id}: DATA howItWorks does not equal slots.howItWorks on ${entry.keyword}`);
  }
  if (slots.bullets != null && JSON.stringify(entry.bullets) !== JSON.stringify(slots.bullets)) {
    throw new Error(`${owner.id}: DATA bullets do not equal slots.bullets on ${entry.keyword}`);
  }
  if (slots.faqs != null && JSON.stringify(entry.faqs) !== JSON.stringify(slots.faqs)) {
    throw new Error(`${owner.id}: DATA faqs do not equal slots.faqs on ${entry.keyword}`);
  }
}

function firstParagraph(html) {
  const match = String(html || '').match(/<p>([\s\S]*?)<\/p>/);
  return match ? match[1] : '';
}

function assembleCatalogue({ data, existing, claims, protectedSeedSlugs, outLabel }) {
  assertStatusLegal(claims);
  const label = outLabel || 'content/seo/pages.json';
  const generated = [];
  for (const entry of data) {
    const built = buildEntry(entry);
    const slug = built.slug;
    if (protectedSeedSlugs && protectedSeedSlugs.has(slug)) {
      throw new Error(
        `A DATA keyword slugifies to a protected hand-authored seed slug, which would ` +
          `silently overwrite bespoke copy with the generic template: ${slug}. ` +
          `Rename the DATA keyword, or if replacing the seed is intentional, remove its ` +
          `slug from PROTECTED_SEED_SLUGS in this file first.`
      );
    }
    const records = recordsForSlug(claims, slug);
    ownerForSlug(claims, slug);
    const emit = emitFor(records);
    const committed = existing.find((p) => p.slug === slug) || null;
    if (emit === 'hold') {
      if (!committed) throw new Error(`${slug}: emit hold but the committed page is missing`);
      const page = ensureMoneyCta(committed);
      checkEmittedPage(page, records, 'hold');
      generated.push(page);
      continue;
    }
    if (emit === 'goal') {
      const owner = explicitOwners(records)[0];
      assertDataMatchesSlots(entry, owner);
      checkEmittedPage(built, records, 'goal');
      generated.push(built);
      continue;
    }
    for (const c of records) {
      if (c.limitPermanent === false && c.currentSentence && committed && !openHowItWorksAllowed(c)) {
        const committedText = pageText(committed);
        const builtText = pageText(built);
        if (!committedText.includes(c.currentSentence) && builtText.includes(c.currentSentence)) {
          throw new Error(`${c.id}: regen would restore a banned sentence on ${slug}`);
        }
      }
    }
    generated.push(built);
  }
  const genSlugs = new Set(generated.map((g) => g.slug));
  const seeds = existing
    .filter((e) => !genSlugs.has(e.slug))
    .map(ensureMoneyCta)
    .map(normalizeAuthichainHost);
  const merged = [...seeds, ...generated];
  const slugCounts = new Map();
  for (const p of merged) slugCounts.set(p.slug, (slugCounts.get(p.slug) || 0) + 1);
  const duplicateSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
  if (duplicateSlugs.length > 0) {
    throw new Error(
      `Duplicate slug(s) in ${label}, one page would silently shadow another: ` +
        `${duplicateSlugs.join(', ')}. Give each page a distinct slug before writing.`
    );
  }
  return {
    merged,
    seeds,
    generated,
    firstParagraph,
  };
}

module.exports = {
  BRANDS,
  LIVE_MONEY,
  buildEntry,
  ensureMoneyCta,
  normalizeAuthichainHost,
  moneyCtaHtml,
  slugify,
  pageText,
  recordsForSlug,
  emitFor,
  assertStatusLegal,
  ownerForSlug,
  checkEmittedPage,
  assertDataMatchesSlots,
  assembleCatalogue,
  firstParagraph,
};
