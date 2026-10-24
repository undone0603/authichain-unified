function htmlDecision(
  body: Record<string, unknown>,
  destination?: string,
  modeId?: string
): string {
  const decision = escapeHtml(String(body.decision || "indeterminate"));
  const contract = escapeHtml(
    String(body.decision_contract || DECISION_CONTRACT)
  );
  const dest =
    destination && /^https?:\/\//i.test(destination)
      ? `<p><a href="${escapeHtml(destination)}">Open destination</a></p>`
      : "";
  const footerLink = modeId
    ? `https://authichain.com/generate?mode=${escapeHtml(modeId)}&utm_source=qr_footer&utm_medium=scan`
    : "https://authichain.com/generate?utm_source=qr_footer&utm_medium=scan";
  const footer = `<div style="font-size:12px;color:#888;text-align:center;margin-top:2rem;">Create your own Living QR — <a href="${footerLink}">free to try</a></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${decision}</title></head><body><h1>${decision}</h1><p>${contract}</p>${dest}${footer}</body></html>`;
}
