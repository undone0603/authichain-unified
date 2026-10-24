/**
 * Viral footer for mode-generated Living QRs.
 * Inject into resolve/presentation HTML when modeId is one of the core modes.
 * Non-intrusive. UTM for measurement. $0.
 */

export function modeFooterHtml(modeId: string): string {
  if (!["stellar_seal", "batch_verify", "limited_drop"].includes(modeId)) return "";
  return `<div style="font-size:12px;color:#666;margin-top:24px;text-align:center;opacity:0.8;">Create your own Living QR — <a href="https://authichain.com/generate?mode=${encodeURIComponent(modeId)}&utm_source=qr_footer&utm_medium=scan">free to try</a></div>`;
}
