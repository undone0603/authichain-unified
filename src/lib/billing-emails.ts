/**
 * Brand-aware transactional billing emails.
 *
 * One factory renders every billing email for every brand, pulling the
 * from-address, app URL, support email, and accent colour from the brand's
 * `billing` config (shared/brands.ts). Replaces the hardcoded single-brand HTML
 * previously inlined in /api/email and src/lib/dunning.ts.
 */

import { BRANDS, type BrandId } from '@shared/brands';
import { getBrandBilling } from './brand-billing';

export type BillingEmailType =
  | 'subscription_confirmed'
  | 'payment_failed'
  | 'trial_expiring'
  | 'winback';

export interface BillingEmailContext {
  /** Recipient's first name / display name, if known. */
  name?: string;
  /** Plan label, e.g. "Creator Pack" or "Theater 1: AgTech". */
  planName?: string;
  /** Days remaining (trial_expiring) or days since cancel (winback). */
  days?: number;
  /** Optional discount/offer code for win-back. */
  offerCode?: string;
}

export interface RenderedEmail {
  from: string;
  subject: string;
  html: string;
  text: string;
}

function shell(brandId: BrandId, bodyHtml: string): string {
  const brand = BRANDS[brandId];
  const { appUrl, supportEmail } = brand.billing;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:${brand.accentHex};">${brand.displayName}</span>
    </div>
    <div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;font-size:12px;color:#6b7280;margin-top:20px;">
      Questions? <a href="mailto:${supportEmail}" style="color:${brand.accentHex};text-decoration:none;">${supportEmail}</a><br/>
      <a href="${appUrl}" style="color:#6b7280;">${appUrl.replace(/^https?:\/\//, '')}</a> · &copy; ${new Date().getFullYear()} ${brand.displayName}
    </p>
  </div>
</body></html>`;
}

function button(brandId: BrandId, href: string, label: string): string {
  const accent = BRANDS[brandId].accentHex;
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:${accent};color:#0b0f17;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">${label}</a>
  </div>`;
}

/**
 * Render a billing email for a given brand + type. Returns from/subject/html/text
 * ready to pass straight to sendEmail().
 */
export function renderBillingEmail(
  type: BillingEmailType,
  brandId: BrandId,
  ctx: BillingEmailContext = {},
): RenderedEmail {
  const brand = BRANDS[brandId];
  const { emailFrom, appUrl } = getBrandBilling(brandId);
  const hi = ctx.name ? `Hi ${ctx.name},` : 'Hi there,';
  const plan = ctx.planName ?? 'your plan';

  switch (type) {
    case 'subscription_confirmed': {
      const subject = `Welcome to ${brand.displayName} — ${plan} is active`;
      const body = `<p>${hi}</p>
        <p>Your <strong>${plan}</strong> subscription is now active. Everything is provisioned and ready to use.</p>
        ${button(brandId, `${appUrl}/dashboard`, 'Open Dashboard')}
        <p style="font-size:13px;color:#9ca3af;">Thanks for choosing ${brand.displayName}.</p>`;
      return { from: emailFrom, subject, html: shell(brandId, body), text: `${hi}\n\nYour ${plan} subscription is active. Open your dashboard: ${appUrl}/dashboard` };
    }
    case 'payment_failed': {
      const subject = `Action needed: payment failed for ${brand.displayName}`;
      const body = `<p>${hi}</p>
        <p>We couldn't process the payment for your <strong>${plan}</strong> subscription. Your access stays active for a short grace period while you update your card.</p>
        ${button(brandId, `${appUrl}/billing`, 'Update Payment Method')}
        <p style="font-size:13px;color:#9ca3af;">If you've already updated it, you can ignore this email.</p>`;
      return { from: emailFrom, subject, html: shell(brandId, body), text: `${hi}\n\nWe couldn't process payment for your ${plan} subscription. Update your card: ${appUrl}/billing` };
    }
    case 'trial_expiring': {
      const d = ctx.days ?? 2;
      const subject = `Your ${brand.displayName} trial ends in ${d} day${d === 1 ? '' : 's'}`;
      const body = `<p>${hi}</p>
        <p>Your free trial ends in <strong>${d} day${d === 1 ? '' : 's'}</strong>. To keep uninterrupted access to ${brand.displayName}, no action is needed — your subscription will start automatically.</p>
        ${button(brandId, `${appUrl}/billing`, 'Manage Subscription')}
        <p style="font-size:13px;color:#9ca3af;">Want to change plans or cancel? You can do it anytime before the trial ends.</p>`;
      return { from: emailFrom, subject, html: shell(brandId, body), text: `${hi}\n\nYour ${brand.displayName} trial ends in ${d} day(s). Manage your subscription: ${appUrl}/billing` };
    }
    case 'winback': {
      const subject = `We'd love you back at ${brand.displayName}`;
      const offer = ctx.offerCode
        ? `<p>Use code <strong style="color:${brand.accentHex};">${ctx.offerCode}</strong> at checkout for a returning-customer discount.</p>`
        : '';
      const body = `<p>${hi}</p>
        <p>Your ${brand.displayName} subscription was cancelled${ctx.days ? ` ${ctx.days} days ago` : ''}. We've shipped a lot since then, and we'd love to have you back.</p>
        ${offer}
        ${button(brandId, `${appUrl}/pricing`, 'Reactivate')}
        <p style="font-size:13px;color:#9ca3af;">Not interested? No worries — we won't email you about this again.</p>`;
      return { from: emailFrom, subject, html: shell(brandId, body), text: `${hi}\n\nWe'd love you back at ${brand.displayName}. Reactivate: ${appUrl}/pricing${ctx.offerCode ? ` (code ${ctx.offerCode})` : ''}` };
    }
  }
}
