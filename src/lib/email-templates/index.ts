/**
 * Nurture email templates for auto-replies
 * Each template generates a personalized email based on:
 * - Reply sentiment (positive, objection)
 * - Objection type (budget, timeline, competitor, etc.)
 * - Lead info (name, company)
 */

interface EmailTemplate {
  subject: string;
  body: string;
}

interface NurtureContext {
  leadName: string;
  leadCompany?: string;
  objectionDetails?: string;
  calendlyUrl?: string;
  pilotPrice?: string;
}

/**
 * Positive reply → encourage next meeting
 */
export function generatePositiveFollowupTemplate(ctx: NurtureContext): EmailTemplate {
  const calendlyUrl = ctx.calendlyUrl || 'https://calendly.com/authichain/demo';

  return {
    subject: `Let's schedule — ${ctx.leadName}`,
    body: `Hi ${ctx.leadName},

Thanks so much for your interest! I'm excited to move forward.

Let's schedule a brief 20-minute call to discuss how AuthiChain can streamline your ${ctx.leadCompany ? `${ctx.leadCompany}'s` : ''} blockchain authentication:

${calendlyUrl}

Looking forward to connecting!

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Objection: Budget → highlight flexible pricing
 */
export function generateObjectionBudgetTemplate(ctx: NurtureContext): EmailTemplate {
  const pilotPrice = ctx.pilotPrice || '$X/month';

  return {
    subject: `${ctx.leadName} — flexible options for your budget`,
    body: `Hi ${ctx.leadName},

Thanks for getting back to me on the proposal. I completely understand that cost is a key consideration.

Many of our clients start with a **pilot program** at ${pilotPrice}/month, which lets you validate ROI with zero long-term commitment. After 30 days, you'll have hard numbers on time saved and cost reduction.

Here's what we've seen:
- Average 40% reduction in authentication overhead
- 99.9% uptime SLA
- Seamless migration from existing systems

Would a pilot timeline work better for your budget? If so, I can have a custom proposal to you by EOD.

Let me know your thoughts!

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Objection: Timeline → offer phased approach or calendar check-in
 */
export function generateObjectionTimelineTemplate(ctx: NurtureContext): EmailTemplate {
  return {
    subject: `${ctx.leadName} — let's align on your timeline`,
    body: `Hi ${ctx.leadName},

Thanks for the quick reply! I totally understand that you're evaluating options and timing is important.

Rather than wait, here's what I'd suggest:

1. We conduct a **quick technical fit assessment** (15 min) to make sure AuthiChain aligns with your roadmap
2. You evaluate competitors in parallel
3. We reconnect in **Q2** when your priorities are clearer

This way, you're not locked in, but you have all the facts when decision time comes.

Does this phased approach work for you? If so, let's schedule that brief call this week.

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Objection: Competitor mentioned → differentiation
 */
export function generateObjectionCompetitorTemplate(ctx: NurtureContext): EmailTemplate {
  return {
    subject: `${ctx.leadName} — how AuthiChain differs from competitors`,
    body: `Hi ${ctx.leadName},

Thanks for mentioning that you're also evaluating other solutions. That's smart due diligence!

Here's how AuthiChain stands apart:

1. **Multi-chain support**: Polygon + Bitcoin Ordinals (competitors: Polygon-only)
2. **Compliance-first**: GDPR + SOC2 built-in (competitors: add-on)
3. **Turnkey integration**: 48-hour implementation vs. 12-week average

I'd love to show you a side-by-side comparison of our architecture vs. \[competitor\]. It's usually eye-opening.

Interested in a 20-min call this week?

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * No reply after 7 days → gentle reminder
 */
export function generateReminderTemplate(ctx: NurtureContext): EmailTemplate {
  return {
    subject: `Quick follow-up: ${ctx.leadName}`,
    body: `Hi ${ctx.leadName},

I wanted to reach out one more time on our proposal. I know inboxes get crazy!

If you're still interested in exploring AuthiChain, I'd love to set up a brief 20-minute call at your convenience.

If now's not the right time, just let me know and I'll follow up in a few weeks when things settle down.

Either way, happy to help!

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Decision-maker objection → escalation path
 */
export function generateObjectionDecisionMakerTemplate(ctx: NurtureContext): EmailTemplate {
  return {
    subject: `${ctx.leadName} — including your stakeholders`,
    body: `Hi ${ctx.leadName},

Thanks for looping me in that this needs approval from your team. That's totally normal!

Here's what I'd suggest:

1. I'll prepare a **1-page executive summary** tailored to your stakeholders' concerns (compliance, cost, security)
2. You can forward it to get initial buy-in
3. Once they're aligned, we schedule a full demo

This usually accelerates the approval process. Want me to send that summary?

Also, who else should be in the loop on your end? I'm happy to give them a quick brief too.

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Generic fallback for unknown objections
 */
export function generateObjectionGenericTemplate(ctx: NurtureContext): EmailTemplate {
  return {
    subject: `${ctx.leadName} — addressing your concerns`,
    body: `Hi ${ctx.leadName},

Thanks for the feedback on the proposal. I appreciate you taking the time to share your thoughts.

${ctx.objectionDetails ? `I wanted to address your comment: "${ctx.objectionDetails}"` : 'It sounds like there are some concerns to work through.'}

Could we schedule a quick call this week to discuss? I'm confident we can find a solution that works for your team.

Just let me know what time works best.

Best regards,
AuthiChain Sales Team`,
  };
}

/**
 * Select appropriate template based on sentiment and objection type
 */
export function selectTemplate(sentiment: string, objectionType: string | null | undefined): (ctx: NurtureContext) => EmailTemplate {
  if (sentiment === 'positive') {
    return generatePositiveFollowupTemplate;
  }

  if (sentiment === 'objection') {
    switch (objectionType) {
      case 'budget':
        return generateObjectionBudgetTemplate;
      case 'timeline':
        return generateObjectionTimelineTemplate;
      case 'competitor':
        return generateObjectionCompetitorTemplate;
      case 'decision_maker':
        return generateObjectionDecisionMakerTemplate;
      default:
        return generateObjectionGenericTemplate;
    }
  }

  // For neutral/negative, no auto-nurture (manual sales review)
  return generateObjectionGenericTemplate;
}
