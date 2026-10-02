/**
 * "Scope a pilot" lead form for /battery-passport (AE-20261002-CFD-04).
 *
 * Copy: /workspace/drafts/battery-passport/page-section-lead-form.md (AuthiChain
 * Marketing draft), used as written. The consent line is NOT final: it renders
 * as a visible PLACEHOLDER until Zachary approves the wording (8:45 list,
 * Tier 2 item 6). Do not merge with the placeholder replaced by unapproved text.
 *
 * Endpoint: the existing POST /api/leads/capture on authichain-edge-router
 * (worker-app/lead-routes.ts). The form sends company, role, categories,
 * target_date and message as their own fields (stored once migration
 * 20261002125000 is applied and the edge router is redeployed) AND as a plain
 * text summary in product_interest, which the live handler already stores, so
 * nothing is lost whichever side deploys first.
 *
 * The browser script uses fetch + textContent only (no innerHTML).
 */

export const LEAD_FORM_ID = "scope-pilot";
export const LEAD_FORM_ENDPOINT = "/api/leads/capture";
export const LEAD_FORM_SOURCE = "battery-passport-page";

/** Visible until Zachary approves the consent/privacy wording (8:45 list item 6). */
export const LEAD_CONSENT_PLACEHOLDER =
  "PLACEHOLDER: consent and privacy wording pending Zac's approval (8:45 list, Tier 2 item 6).";

export const LEAD_FINE_PRINT =
  "AuthiChain is an independent brand of Zachary Kietzman and is not affiliated with, endorsed by, or acting on behalf of any government agency.";

export const LEAD_SUCCESS_MESSAGE =
  "Thanks. We've got your details and will reply by email to set up a scoping call.";

export const LEAD_ERROR_MESSAGE =
  "That didn't go through. Please try again, or reach us at authichain.com/contact.";

export const BATTERY_CATEGORIES = [
  "LMT (e-bikes, scooters)",
  "Industrial over 2 kWh",
  "Home storage",
  "EV",
  "Not sure yet",
] as const;

/**
 * Plain-JS packer shared by the browser script and the unit tests (tests load
 * it with `new Function`). Builds the product_interest string and the JSON
 * body for /api/leads/capture. Each field is whitespace-collapsed and capped.
 */
export const PACK_LEAD_JS = `function packLead(f, loc) {
  function clean(v, max) { return String(v == null ? "" : v).replace(/\\s+/g, " ").trim().slice(0, max); }
  var parts = ["battery-passport"];
  var company = clean(f.company, 200), role = clean(f.role, 120), target = clean(f.target, 60), notes = clean(f.notes, 1500);
  var cats = (f.categories || []).map(function (c) { return clean(c, 60); }).filter(Boolean);
  if (company) parts.push("Company: " + company);
  if (role) parts.push("Role: " + role);
  if (cats.length) parts.push("Battery categories: " + cats.join(", "));
  if (target) parts.push("Target date: " + target);
  if (notes) parts.push("Notes: " + notes);
  var body = {
    email: clean(f.email, 254),
    name: clean(f.name, 120),
    source: "${LEAD_FORM_SOURCE}",
    product_interest: parts.join(" | ").slice(0, 2000)
  };
  if (company) body.company = company;
  if (role) body.role = role;
  if (cats.length) body.categories = cats;
  if (target) body.target_date = target;
  if (notes) body.message = notes;
  if (loc) {
    body.page_url = String(loc.origin || "") + String(loc.pathname || "");
    var q = new URLSearchParams(loc.search || "");
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) { var v = clean(q.get(k), 120); if (v) body[k] = v; });
  }
  return body;
}`;

const LEAD_FORM_SCRIPT = `(function () {
  ${PACK_LEAD_JS}
  var form = document.getElementById("lead-form");
  var status = document.getElementById("lead-form-status");
  if (!form || !status || !window.fetch) return;
  var btn = form.querySelector("button[type=submit]");
  var btnLabel = btn ? btn.textContent : "";
  var OK_MSG = ${JSON.stringify(LEAD_SUCCESS_MESSAGE)};
  var ERR_MSG = ${JSON.stringify(LEAD_ERROR_MESSAGE)};
  function show(msg, kind) {
    status.textContent = msg;
    status.className = "lf-status lf-" + kind;
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    status.hidden = false;
    status.focus();
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var el = form.elements;
    var cats = [];
    form.querySelectorAll("input[name=categories]:checked").forEach(function (c) { cats.push(c.value); });
    var catBox = document.getElementById("lf-categories");
    var catErr = document.getElementById("lf-categories-error");
    if (!cats.length) {
      if (catErr) catErr.hidden = false;
      if (catBox) catBox.setAttribute("aria-invalid", "true");
      var first = form.querySelector("input[name=categories]");
      if (first) first.focus();
      return;
    }
    if (catErr) catErr.hidden = true;
    if (catBox) catBox.removeAttribute("aria-invalid");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (String(el.namedItem("website").value || "") !== "") { form.hidden = true; show(OK_MSG, "ok"); return; }
    var body = packLead({
      name: el.namedItem("name").value,
      email: el.namedItem("email").value,
      company: el.namedItem("company").value,
      role: el.namedItem("role").value,
      categories: cats,
      target: el.namedItem("target").value,
      notes: el.namedItem("notes").value
    }, window.location);
    if (btn) { btn.disabled = true; btn.textContent = "Sending\\u2026"; }
    status.hidden = true;
    fetch(${JSON.stringify(LEAD_FORM_ENDPOINT)}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok && data && data.ok === true) { form.hidden = true; show(OK_MSG, "ok"); }
        else { show(ERR_MSG, "error"); }
      });
    }).catch(function () { show(ERR_MSG, "error"); }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
    });
  });
})();`;

export const LEAD_FORM_CSS = `
    .lf-cards { margin-top:1rem; }
    .lf-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(14rem,1fr)); gap:.9rem 1.1rem; margin:1.25rem 0 .5rem; }
    .lf-form label, .lf-form legend { display:flex; flex-direction:column; gap:.3rem; font-size:.92rem; font-weight:600; }
    .lf-form input[type=text], .lf-form input[type=email], .lf-form textarea { padding:.55rem .65rem; border:1px solid var(--border); border-radius:.5rem; font:inherit; background:transparent; color:inherit; }
    .lf-form textarea { min-height:6rem; resize:vertical; }
    .lf-form fieldset { grid-column:1/-1; border:1px solid var(--border); border-radius:.5rem; padding:.6rem .9rem; margin:0; }
    .lf-form fieldset label { flex-direction:row; align-items:center; gap:.5rem; font-weight:500; margin:.3rem 1.2rem .3rem 0; display:inline-flex; }
    .lf-full, .lf-actions { grid-column:1/-1; }
    .lf-req { font-weight:400; color: var(--text-dim); }
    .lf-hp { position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden; }
    .lf-field-error { color:#c0392b; font-size:.88rem; margin:.35rem 0 0; }
    .lf-status { padding:.75rem 1rem; border-radius:.5rem; border:1px solid var(--border); margin:.75rem 0; }
    .lf-status.lf-error { border-color:#c0392b; color:#c0392b; }
    .lf-placeholder { display:inline-block; padding:.2rem .45rem; border:2px dashed #c0392b; color:#c0392b; font-weight:650; }
`;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

const CARDS: Array<{ title: string; body: string }> = [
  {
    title: "Gap analysis.",
    body: "Which required fields you have, which are missing, and who owns each one.",
  },
  {
    title: "Data map.",
    body: "Every field mapped to its source system or supplier and to its Annex XIII access tier.",
  },
  {
    title: "Complete passport record for one model.",
    body: "Built from your mapped fields to the Battery Pass data model.",
  },
];

export function batteryLeadFormSection(): string {
  const cards = CARDS.map(
    c =>
      `<article class="estate-card card"><p><strong>${esc(c.title)}</strong> ${esc(c.body)}</p></article>`
  ).join("");
  const categories = BATTERY_CATEGORIES.map(
    (c, i) =>
      `<label><input type="checkbox" name="categories" value="${esc(c)}" id="lf-cat-${i}"> ${esc(c)}</label>`
  ).join("");
  return `<section class="estate-section" id="${LEAD_FORM_ID}" aria-labelledby="scope-pilot-heading">
    <div class="wrap">
      <p class="estate-badge">EU Battery Regulation, Article 77</p>
      <h2>Battery passports are required from 18 February 2027.</h2>
      <p class="section-sub">From that date, LMT batteries (e-bikes, scooters and other light electric vehicles), industrial batteries over 2 kWh (including home storage), and EV batteries placed on the EU market need an electronic battery passport, reached through a QR code on the battery.</p>
      <p class="section-sub">The Battery Passport Readiness pilot is done for you. We review your in-scope batteries against Article 77 and Annex XIII, map every required field to its source and access tier, and build a complete passport record for one battery model, structured to the Battery Pass data model, so your team sees the full record before rolling it out.</p>
      <div class="estate-grid lf-cards">${cards}</div>
      <p class="bp-note">Live today: AuthiChain's open protocol spec (Apache-2.0) and its offline reference verifier. Certificate issuance and public verification are in development.</p>

      <h3 id="scope-pilot-heading">Scope a pilot</h3>
      <p class="section-sub">Tell us what you place on the EU market. We'll reply to set up a scoping call. Pricing is shared on the call.</p>
      <form class="lf-form" id="lead-form" action="${LEAD_FORM_ENDPOINT}" method="post" novalidate>
        <input type="hidden" name="source" value="${LEAD_FORM_SOURCE}">
        <label for="lf-name">Name <span class="lf-req">(required)</span>
          <input id="lf-name" name="name" type="text" required maxlength="120" autocomplete="name">
        </label>
        <label for="lf-email">Work email <span class="lf-req">(required)</span>
          <input id="lf-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email">
        </label>
        <label for="lf-company">Company <span class="lf-req">(required)</span>
          <input id="lf-company" name="company" type="text" required maxlength="200" autocomplete="organization">
        </label>
        <label for="lf-role">Role
          <input id="lf-role" name="role" type="text" maxlength="120" autocomplete="organization-title" placeholder="e.g. Compliance lead">
        </label>
        <fieldset id="lf-categories" aria-describedby="lf-categories-error">
          <legend>Battery categories <span class="lf-req">(required, choose at least one)</span></legend>
          ${categories}
          <p class="lf-field-error" id="lf-categories-error" hidden>Choose at least one battery category.</p>
        </fieldset>
        <label for="lf-target">Target EU launch or compliance date
          <input id="lf-target" name="target" type="text" maxlength="60" placeholder="e.g. Q1 2027">
        </label>
        <label for="lf-notes" class="lf-full">Anything else we should know
          <textarea id="lf-notes" name="notes" maxlength="1500" rows="4"></textarea>
        </label>
        <div class="lf-hp" aria-hidden="true"><label for="lf-website">Leave this field empty<input id="lf-website" name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
        <div class="lf-actions">
          <button class="btn btn-primary" type="submit">Request a scoping call</button>
          <p class="bp-note" id="lf-consent"><span class="lf-placeholder">${esc(LEAD_CONSENT_PLACEHOLDER)}</span></p>
        </div>
      </form>
      <noscript><p class="bp-note">Scope a pilot at <a href="https://authichain.com/contact">https://authichain.com/contact</a></p></noscript>
      <div id="lead-form-status" class="lf-status" tabindex="-1" aria-live="polite" hidden></div>
      <p class="bp-note">${esc(LEAD_FINE_PRINT)}</p>
    </div>
    <script>${LEAD_FORM_SCRIPT}</script>
  </section>`;
}
