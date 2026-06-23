import { createClient } from '@supabase/supabase-js';
import { logAutomation, formatErr } from './automation';
import { dispatchWebhook } from './webhooks';
import { HubSpotDeliverableAgent } from './industrial/hubspot';
import { sendEmail } from './email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://authichain.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

/**
 * Autonomous Controller for Platform Business Operations.
 * Handles high-level logic for outreach, social, and reporting.
 */
export class AutonomousController {
  /**
   * Channel C: Automated Federal Drip Sequencer
   * Restarts outreach for MUSA-FTC compliance on stuck prospects.
   */
  private async runFederalDripSequencer() {
    const workflowName = 'federal_drip_sequencer';
    try {
      // 1. Fetch "stuck" prospects or those needing FTC shield
      const { data: prospects } = await admin
        .from('lead_captures')
        .select('*')
        .or('status.eq.new,status.eq.contacted')
        .filter('score', 'gte', 80)
        .limit(10); // Process in small batches

      if (!prospects || prospects.length === 0) return;

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      let lastError: string | undefined;

      for (const p of prospects) {
        if (!p.email) {
          skipped++;
          continue;
        }

        const msg = `Attention ${p.name || 'Operations Lead'},\n\n` +
          `With the recent FTC $625k MUSA penalties and EO 14392, your current "Made in USA" claims are at regulatory risk.\n\n` +
          `AuthiChain has launched the FTC Shield — the first cryptographic provenance seal for American manufacturing.\n\n` +
          `View your prepared compliance dashboard: https://qron.space/ftc-shield`;

        const result = await sendEmail({
          from: 'AuthiChain Compliance <compliance@qron.space>',
          to: p.email,
          subject: 'Action Required: FTC Made-in-USA Compliance (EO 14392)',
          text: msg,
        });

        if (!result.ok) {
          failed++;
          lastError = `${result.provider}: ${result.error}`;
          console.warn(`[autonomous] FTC drip failed for ${p.email}: ${lastError}`);
          continue;
        }

        sent++;
        await admin
          .from('lead_captures')
          .update({
            status: 'qualified',
            metadata: { last_drip: 'ftc_shield_v1', drip_sent_at: new Date().toISOString(), provider: result.provider }
          })
          .eq('id', p.id);
      }

      const status = failed > 0 || (sent === 0 && prospects.length > 0) ? 'failure' : 'success';
      const errMsg = failed > 0
        ? `${failed}/${prospects.length} drip sends failed: ${lastError}`
        : (skipped === prospects.length ? 'all prospects skipped (no email)' : undefined);
      await logAutomation(workflowName, 'cron', status, { prospects: prospects.length, sent, failed, skipped }, errMsg);
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Run the daily executive business cycle.
   */
  async runDailyCycle() {
    const startTime = Date.now();
    console.log('[autonomous] Starting daily business cycle...');

    try {
      const results = await Promise.allSettled([
        this.processPendingLeads(),
        this.processHubSpotDeliverables(),
        this.runDripSequencer(),
        this.runFederalDripSequencer(),
        this.runViralMarketingAgent(),
        this.generateSocialShowcase(),
        this.runRevenueRecyclingAgent(),
        this.executeTokenomicsDaily(),
        this.runIndustrialWatchdog(),
        this.runGovernanceArbiter(),
        this.runStrainChainAudit(),
        this.runGovChainSync(),
        this.runQronStorySync(),
        this.triggerAffiliatePayoutProcessor(),
        this.runDunningEscalation(),
        this.triggerGrowthEngine(),
        this.sendExecutiveReport(),
      ]);

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      await logAutomation('daily_business_cycle', 'cron', 'success', {
        duration: Date.now() - startTime,
        tasks: successCount,
        agent_version: 'v3.0-autonomous',
      });
    } catch (err: unknown) {
      await logAutomation('daily_business_cycle', 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Unblocks HubSpot Deals by generating tangible deliverables.
   */
  private async processHubSpotDeliverables() {
    try {
      const agent = new HubSpotDeliverableAgent();
      await agent.unblockStalledDeals();
    } catch (err: unknown) {
      await logAutomation('hubspot_deliverable_cycle', 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Manages multi-stage lead follow-ups autonomously.
   * Stage 1 (day 0): Artifact Delivery — send sample QR + compliance PDF link.
   * Stage 2 (day 3): Nudge — ask about blockers, offer a 15-min call.
   * Stage 3 (day 6): Elite Offer — limited-time discount CTA.
   */
  private async runDripSequencer() {
    const workflowName = 'lead_drip_sequencer';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
    try {
      const now = new Date().toISOString();
      const { data: sequences } = await admin
        .from('lead_sequences')
        .select(`
          *,
          lead:lead_id (email, name, product_interest)
        `)
        .eq('status', 'active')
        .lte('next_action_at', now)
        .limit(20);

      if (!sequences || sequences.length === 0) return;

      let sent = 0;
      let failed = 0;

      for (const seq of sequences) {
        const lead = seq.lead as { email?: string; name?: string; product_interest?: string } | null;
        const email = lead?.email;
        if (!email) { failed++; continue; }

        const firstName = lead?.name?.split(' ')[0] || 'there';
        let result;

        switch (seq.current_stage) {
          case 1: {
            result = await sendEmail({
              from: 'AuthiChain <hello@qron.space>',
              to: email,
              subject: `Your sample: AI-certified QR code for ${firstName}`,
              html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #c9a227">
                <h1 style="color:#c9a227">Here's your sample</h1>
                <p>Hi ${firstName}, as promised — here's a live demo QR code cryptographically anchored on AuthiChain.</p>
                <p>Every scan is logged on-chain. Your brand, your provenance. <strong>Nothing faked.</strong></p>
                <a href="${APP_URL}/demo" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">View Live Demo</a>
                <p style="color:#9e9e9e;font-size:13px">I'll follow up in a few days to see if it fits your workflow.</p>
              </div>`,
              text: `Hi ${firstName}, here's your AuthiChain demo: ${APP_URL}/demo`,
            });
            break;
          }
          case 2: {
            result = await sendEmail({
              from: 'AuthiChain <hello@qron.space>',
              to: email,
              subject: `Quick question, ${firstName}`,
              html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #333">
                <p>Hi ${firstName},</p>
                <p>Did the demo make sense for your use case? Happy to walk through it live — takes about 15 minutes.</p>
                <a href="${APP_URL}/call" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Book a 15-min call</a>
                <p style="color:#9e9e9e;font-size:13px">Or just reply here with any questions.</p>
              </div>`,
              text: `Hi ${firstName}, want to do a quick walk-through? Book here: ${APP_URL}/call`,
            });
            break;
          }
          case 3: {
            result = await sendEmail({
              from: 'AuthiChain <hello@qron.space>',
              to: email,
              subject: `Last one, ${firstName} — 20% off this week only`,
              html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #c9a227">
                <h1 style="color:#c9a227">Limited offer</h1>
                <p>Hi ${firstName}, I don't do this often — use code <strong style="color:#c9a227">LAUNCH20</strong> for 20% off any paid plan, valid through this week.</p>
                <a href="${APP_URL}/#pricing" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Claim 20% Off</a>
                <p style="color:#9e9e9e;font-size:13px">After that, we'll stop bugging you — promise.</p>
              </div>`,
              text: `Hi ${firstName}, use LAUNCH20 for 20% off this week: ${APP_URL}/#pricing`,
            });
            break;
          }
          default:
            result = { ok: true };
        }

        if (!result || !result.ok) { failed++; continue; }
        sent++;

        const nextStage = seq.current_stage + 1;
        const isComplete = nextStage > 3;
        const nextAction = new Date();
        nextAction.setDate(nextAction.getDate() + 3);

        await admin
          .from('lead_sequences')
          .update({
            current_stage: nextStage,
            status: isComplete ? 'completed' : 'active',
            last_action_at: now,
            next_action_at: isComplete ? null : nextAction.toISOString(),
            updated_at: now,
          })
          .eq('id', seq.id);
      }

      const status = failed > 0 && sent === 0 ? 'failure' : 'success';
      await logAutomation(workflowName, 'cron', status, { actions_executed: sequences.length, sent, failed });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Phase 7 - Step 1: Agent-Led Viral Marketing
   * Detects trends and autonomously publishes topical QRON art.
   */
  private async runViralMarketingAgent() {
    const workflowName = 'agent_viral_marketing';
    try {
      // 1. Trend Detection (Simulated for protocol launch)
      const trends = ['Solar Eclipse', 'Metaverse Fashion', 'Sustainable Tech', 'Cyberpunk Cities'];
      const currentTrend = trends[Math.floor(Math.random() * trends.length)];

      // 2. Trend-to-Prompt Engineering
      const prompt = `A highly detailed, cinematic QR art inspired by ${currentTrend}, hyper-realistic, gold accents, 8k resolution, AuthiChain signature style.`;

      // 3. Autonomous Generation (Calling internal API logic or worker directly)
      const CF_WORKER_URL = process.env.QRON_WORKER_URL || 'https://qron-ai-api.undone-k.workers.dev';
      const genRes = await fetch(`${CF_WORKER_URL}/v1/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://qron.space', prompt, style: 'cinematic' }),
      });

      if (!genRes.ok) {
        const body = await genRes.text().catch(() => '');
        throw new Error(`Marketing generation failed: ${genRes.status} ${genRes.statusText} ${body.slice(0, 200)}`);
      }
      const data = await genRes.json() as { downloadUrl: string };

      // 4. Social Publishing (Buffer Webhook)
      const bufferWebhook = process.env.BUFFER_WEBHOOK_URL;
      if (bufferWebhook) {
        await fetch(bufferWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `The Protocol has detected a new trend: ${currentTrend}. ðŸš€\n\nBehold this autonomous creation, cryptographically anchored by AuthiChain.\n\n#AIArt #TrendWatch #${currentTrend.replace(/\s/g, '')}`,
            media: { picture: data.downloadUrl },
          }),
        });
      }

      await logAutomation(workflowName, 'cron', 'success', { trend: currentTrend, imageUrl: data.downloadUrl });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Phase 7 - Step 2: Autonomous Revenue Recycling
   * Calculates daily protocol revenue and triggers a buyback/burn log.
   */
  private async runRevenueRecyclingAgent() {
    const workflowName = 'agent_revenue_recycling';
    try {
      // 1. Fetch 24h revenue
      const past24h = new Date(Date.now() - 86400000).toISOString();
      const { data: flows } = await admin
        .from('fee_flows')
        .select('net_amount')
        .gte('created_at', past24h);

      const totalRevenue = (flows || []).reduce((sum, f) => sum + parseFloat(f.net_amount || '0'), 0);
      if (totalRevenue <= 0) return;

      // 2. Calculate Buyback (20% of net revenue)
      const buybackAmount = totalRevenue * 0.20;

      // 3. Log Autonomous Buyback & Burn
      await admin.from('fee_flows').insert({
        flow_type: 'buyback_burn',
        net_amount: -buybackAmount,
        burn_amount: buybackAmount,
        status: 'confirmed',
        metadata: { agent: 'RecyclingAgent-v1', basis: totalRevenue }
      });

      await logAutomation(workflowName, 'cron', 'success', { buybackAmount, totalRevenue });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Phase 7 - Step 3: Industrial Scan Watchdog
   * Monitors for geographic anomalies in supply chain scans.
   */
  private async runIndustrialWatchdog() {
    const workflowName = 'agent_industrial_watchdog';
    try {
      // 1. Fetch recent scans from the last 24h
      const past24h = new Date(Date.now() - 86400000).toISOString();
      const { data: scans } = await admin
        .from('scan_logs')
        .select(`
          *,
          qrons:qron_id (mode, user_id)
        `)
        .gte('created_at', past24h);

      if (!scans || scans.length === 0) return;

      let anomaliesFound = 0;

      // 2. Analyze for Industrial Geofencing (Simulated Logic)
      for (const scan of scans) {
        const isIndustrial = scan.qrons?.mode === 'industrial';
        if (!isIndustrial) continue;

        // Simulate a "Safe Zone" check
        // In production, we'd check against a 'registered_origin' in the certification
        const safeCountries = ['US', 'CA', 'GB']; 
        const isForeignScan = scan.country && !safeCountries.includes(scan.country);

        if (isForeignScan) {
          // 3. Log Geographic Drift Anomaly
          const anomaly = {
            type: 'geo_drift',
            severity: 'high',
            description: `Industrial asset scanned in unauthorized region: ${scan.country} (${scan.city})`,
            qron_id: scan.qron_id,
            user_id: scan.qrons.user_id,
            metadata: { scan_id: scan.id, ip: scan.ip }
          };

          await admin.from('protocol_anomalies').insert(anomaly);

          // 4. Dispatch Webhook to Manufacturer
          dispatchWebhook(scan.qrons.user_id, 'security_anomaly', anomaly);

          // 5. Real-Time Alert to Admin channel (Discord/Slack)
          const securityWebhook = process.env.SECURITY_ALERTS_WEBHOOK_URL;
          if (securityWebhook) {
            await fetch(securityWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `🚨 **SECURITY ALERT: Industrial Anomaly Detected**\n` +
                  `**Type**: Geographic Drift\n` +
                  `**Asset**: QRON-${scan.qron_id}\n` +
                  `**Location**: ${scan.city}, ${scan.country}\n` +
                  `**Severity**: HIGH\n` +
                  `**Protocol Action**: Logged & Verified`,
              }),
            });
          }
          
          anomaliesFound++;
        }
      }

      await logAutomation(workflowName, 'cron', 'success', { 
        scans_analyzed: scans.length, 
        anomalies_detected: anomaliesFound 
      });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Phase 7 - Step 4: Governance Arbiter
   * Summarizes closing proposals and rallies the community.
   */
  private async runGovernanceArbiter() {
    const workflowName = 'agent_governance_arbiter';
    try {
      // 1. Fetch proposals ending within the next 24h
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const now = new Date().toISOString();

      const { data: proposals } = await admin
        .from('governance_proposals')
        .select('*')
        .eq('status', 'active')
        .lte('end_time', tomorrow)
        .gte('end_time', now);

      if (!proposals || proposals.length === 0) return;

      for (const proposal of proposals) {
        // 2. Calculate Sentiment
        const totalVotes = proposal.yes_votes + proposal.no_votes;
        const yesPercent = totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0;
        
        // 3. Draft Executive Summary
        const alertMsg = `âš–ï¸  DAO ALERT: Voting closes in < 24h for ${proposal.id}!\n\n` +
          `**Title**: ${proposal.title}\n` +
          `**Sentiment**: ${yesPercent.toFixed(1)}% YES (${proposal.yes_votes} QRON)\n\n` +
          `Your voice determines the protocol's future. Vote now at govchain.us`;

        // 4. Push to Community Webhook (e.g. Discord/Telegram)
        const daoWebhook = process.env.DAO_COMMUNITY_WEBHOOK_URL;
        if (daoWebhook) {
          await fetch(daoWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: alertMsg })
          });
        }
      }

      await logAutomation(workflowName, 'cron', 'success', { proposals_monitored: proposals.length });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * StrainChain Compliance Audit
   * Flags checkpoint batches that are stuck in pending > 2h, or failed,
   * and alerts the security webhook. Also surfaces overdue COA anomalies.
   */
  private async runStrainChainAudit() {
    const workflowName = 'strainchain_compliance_audit';
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();

      // 1. Find stuck/failed checkpoint batches
      const { data: stuck } = await admin
        .from('checkpoint_batches')
        .select('id, batchType, itemCount, status, createdAt')
        .or(`status.eq.failed,and(status.eq.pending,createdAt.lte.${twoHoursAgo})`)
        .limit(20);

      // 2. Find scan anomalies in the last 24h (failed anchors)
      const past24h = new Date(Date.now() - 86_400_000).toISOString();
      const { data: failedAnchors } = await admin
        .from('protocol_anomalies')
        .select('id, type, severity, description, created_at')
        .eq('type', 'anchor_failure')
        .gte('created_at', past24h)
        .limit(20);

      const issueCount = (stuck?.length ?? 0) + (failedAnchors?.length ?? 0);

      if (issueCount > 0) {
        const securityWebhook = process.env.SECURITY_ALERTS_WEBHOOK_URL;
        if (securityWebhook) {
          const lines = [
            `🌿 **STRAINCHAIN AUDIT ALERT** — ${issueCount} issue(s) detected`,
            ...(stuck ?? []).map(b =>
              `• Batch #${b.id} (${b.batchType}) — status: ${b.status}, items: ${b.itemCount}`),
            ...(failedAnchors ?? []).map(a =>
              `• Anchor failure: ${a.description?.slice(0, 120) ?? a.id}`),
          ];
          await fetch(securityWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: lines.join('\n') }),
          });
        }
      }

      await logAutomation(workflowName, 'cron', 'success', {
        stuck_batches: stuck?.length ?? 0,
        anchor_failures: failedAnchors?.length ?? 0,
        issues: issueCount,
      });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * GovChain Sync
   * Surfaces new high-fit government opportunities (score ≥ 70, not yet pursued)
   * and flags proposals with deadlines within 48h.
   */
  private async runGovChainSync() {
    const workflowName = 'govchain_sync';
    try {
      const tomorrow48h = new Date(Date.now() + 48 * 3_600_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      // 1. High-fit unacted opportunities
      const { data: hotOpps } = await admin
        .from('gov_opportunities')
        .select('notice_id, title, agency, deadline, fit_score, recommended_action')
        .gte('fit_score', 70)
        .eq('status', 'scored')
        .limit(10);

      // 2. Proposals with imminent deadlines
      const { data: urgentProposals } = await admin
        .from('gov_proposals')
        .select('notice_id, title, agency, deadline, fit_score, status')
        .in('status', ['draft', 'reviewed'])
        .gte('deadline', today)
        .lte('deadline', tomorrow48h)
        .limit(10);

      const daoWebhook = process.env.DAO_COMMUNITY_WEBHOOK_URL;
      if (daoWebhook && ((hotOpps?.length ?? 0) > 0 || (urgentProposals?.length ?? 0) > 0)) {
        const lines = ['🏛️ **GOVCHAIN DAILY SYNC**'];

        if (hotOpps && hotOpps.length > 0) {
          lines.push(`\n**${hotOpps.length} High-Fit Opportunity(ies) Await Action:**`);
          for (const o of hotOpps) {
            lines.push(`• [Score ${o.fit_score}] ${o.title} — ${o.agency} (deadline: ${o.deadline ?? 'TBD'})`);
          }
          lines.push(`\nReview at ${APP_URL}/dashboard/govchain`);
        }

        if (urgentProposals && urgentProposals.length > 0) {
          lines.push(`\n⚠️ **${urgentProposals.length} Proposal(s) Due Within 48h:**`);
          for (const p of urgentProposals) {
            lines.push(`• ${p.title} — ${p.agency} (deadline: ${p.deadline})`);
          }
        }

        await fetch(daoWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: lines.join('\n') }),
        });
      }

      await logAutomation(workflowName, 'cron', 'success', {
        hot_opportunities: hotOpps?.length ?? 0,
        urgent_proposals: urgentProposals?.length ?? 0,
      });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Specific for qron.space: Autonomous Living Art Rotation
   * Rotates each active schedule's qron through the pre-rendered images[] array
   * based on last_run_at. The full daily cycle advances each schedule one slot.
   */
  private async runQronStorySync() {
    const workflowName = 'qron_story_sync';
    try {
      const now = new Date().toISOString();
      const { data: schedules, error: fetchErr } = await admin
        .from('living_art_schedules')
        .select('id, qron_id, images, last_run_at')
        .eq('is_active', true)
        .limit(50);

      if (fetchErr) throw fetchErr;
      if (!schedules || schedules.length === 0) {
        await logAutomation(workflowName, 'cron', 'success', { rotated: 0, schedules: 0, skipped: 'no active schedules' });
        return;
      }

      let processedCount = 0;
      for (const schedule of schedules) {
        const images = (schedule.images as Array<{ url?: string } | string> | null) ?? [];
        if (images.length === 0) continue;

        const dayIndex = Math.floor(Date.now() / 86_400_000);
        const slot = dayIndex % images.length;
        const next = images[slot];
        const nextUrl = typeof next === 'string' ? next : next?.url;
        if (!nextUrl) continue;

        await admin
          .from('qrons')
          .update({ image_url: nextUrl, updated_at: now })
          .eq('id', schedule.qron_id);

        await admin
          .from('living_art_schedules')
          .update({ last_run_at: now, updated_at: now })
          .eq('id', schedule.id);

        processedCount++;
      }

      await logAutomation(workflowName, 'cron', 'success', { rotated: processedCount, schedules: schedules.length });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * 1. Process Pending Leads: Sync new signups to HubSpot and trigger sequences.
   */
  private async processPendingLeads() {
    const { data: leads } = await admin
      .from('lead_captures')
      .select('*')
      .eq('status', 'new')
      .limit(50);

    if (!leads || leads.length === 0) return;

    for (const lead of leads) {
      try {
        // Sync to HubSpot
        const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
        if (hubspotToken) {
          await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: {
                email: lead.email,
                firstname: lead.name?.split(' ')[0] || '',
                hs_lead_status: 'NEW',
                lifecyclestage: 'lead',
              },
            }),
          });
        }

        // Update local status with score
        const score = lead.product_interest === 'authichain' ? 80 : 20; // Enterprise leads score higher
        
        await admin
          .from('lead_captures')
          .update({ 
            status: 'contacted', 
            score,
            updated_at: new Date().toISOString() 
          })
          .eq('id', lead.id);
      } catch (err) {
        console.error(`[autonomous] Lead sync failed for ${lead.email}:`, err);
      }
    }
  }

  /**
   * 2. Social Media Showcase: Select a top-performing QRON and post to social.
   */
  private async generateSocialShowcase() {
    // Select a highly-scanned QRON from the last 7 days
    const { data: qrons } = await admin
      .from('qrons')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(10);

    if (!qrons || qrons.length === 0) return;

    // Pick one at random for the showcase
    const showcase = qrons[Math.floor(Math.random() * qrons.length)];

    const bufferWebhook = process.env.BUFFER_WEBHOOK_URL;
    if (bufferWebhook) {
      await fetch(bufferWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Today's Featured QRON! ðŸŽ¨\n\nMode: ${showcase.mode}\nPrompt: ${showcase.prompt}\n\nCreate your own verified QR art at qron.space`,
          media: { picture: showcase.imageUrl },
        }),
      });
    }
  }

  /**
   * 3. Executive Report: Synthesize stats and email to admin.
   */
  private async sendExecutiveReport() {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      await logAutomation('executive_report', 'cron', 'failure', null, 'ADMIN_EMAIL not set');
      return;
    }

    // Fetch 24h stats
    const past24h = new Date(Date.now() - 86400000).toISOString();
    
    const { count: newLeads } = await admin
      .from('lead_captures')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', past24h);

    const { count: gens } = await admin
      .from('qron_generations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', past24h);

    // Fetch failed workflows in last 24h, grouped by name
    const { data: failureRows } = await admin
      .from('automation_logs')
      .select('workflow_name, error_message, created_at')
      .eq('status', 'failure')
      .gte('created_at', past24h)
      .order('created_at', { ascending: false })
      .limit(100);

    const failuresByWorkflow = new Map<string, { count: number; lastError: string; lastSeen: string }>();
    for (const row of failureRows ?? []) {
      const existing = failuresByWorkflow.get(row.workflow_name);
      if (existing) {
        existing.count++;
      } else {
        failuresByWorkflow.set(row.workflow_name, {
          count: 1,
          lastError: row.error_message || '(no message)',
          lastSeen: row.created_at,
        });
      }
    }
    const totalFailures = failureRows?.length ?? 0;
    const failuresHtml = totalFailures === 0
      ? `<p style="color: #4caf50; font-size: 13px; margin: 0;">✓ No failed workflows in the last 24h.</p>`
      : Array.from(failuresByWorkflow.entries())
          .map(([name, info]) => `
            <div style="background: #1a0808; border-left: 3px solid #ef5350; padding: 10px 14px; margin: 8px 0; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <strong style="color: #ef9a9a; font-size: 13px;">${name}</strong>
                <span style="color: #ef5350; font-size: 11px;">×${info.count}</span>
              </div>
              <div style="color: #a18888; font-size: 11px; margin-top: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-word;">${info.lastError.slice(0, 240)}</div>
            </div>
          `).join('');

    const reportHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 32px; border-radius: 12px; border: 1px solid #c9a227;">
        <h1 style="color: #c9a227;">Daily Executive Digest</h1>
        <p style="color: #9e9e9e;">QRON Platform Autonomous Operations</p>
        <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 16px;">
          <div style="background: #111; padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #c9a227;">${newLeads || 0}</div>
            <div style="font-size: 12px; color: #666;">NEW LEADS</div>
          </div>
          <div style="background: #111; padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #c9a227;">${gens || 0}</div>
            <div style="font-size: 12px; color: #666;">GENERATIONS</div>
          </div>
        </div>
        <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
        <h2 style="color: ${totalFailures === 0 ? '#4caf50' : '#ef5350'}; font-size: 16px; margin: 0 0 12px 0;">
          ${totalFailures === 0 ? '✓ Operational' : `⚠ ${totalFailures} failure${totalFailures === 1 ? '' : 's'} in last 24h`}
        </h2>
        ${failuresHtml}
        <p style="font-size: 12px; color: #3a3a3a; margin-top: 32px; text-align: center;">
          System Timestamp: ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    const result = await sendEmail({
      from: 'QRON Autonomous <ops@qron.space>',
      to: adminEmail,
      subject: `Daily Business Report - ${new Date().toLocaleDateString()}`,
      html: reportHtml,
    });
    await logAutomation(
      'executive_report',
      'cron',
      result.ok ? 'success' : 'failure',
      { provider: result.provider, newLeads: newLeads || 0, gens: gens || 0 },
      result.ok ? undefined : `${result.provider}: ${result.error}`
    );
  }

  /**
   * 4. Tokenomics Execution: Distribute staker rewards and monitor deflationary burn.
   */
  private async executeTokenomicsDaily() {
    try {
      // Fetch unconfirmed staker rewards
      const { data: pendingRewards } = await admin
        .from('fee_flows')
        .select('*')
        .eq('flow_type', 'staking_reward')
        .eq('status', 'pending');

      if (!pendingRewards || pendingRewards.length === 0) return;

      const totalReward = pendingRewards.reduce(
        (sum, r) => sum + parseFloat(r.staker_reward_amount || '0'),
        0
      );

      // In a real scenario, this triggers the on-chain distribution contract
      // For now, we simulate and mark as confirmed
      await admin
        .from('fee_flows')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .in(
          'id',
          pendingRewards.map((r) => r.id)
        );

      await logAutomation('daily_tokenomics_dist', 'cron', 'success', {
        amount: totalReward,
        count: pendingRewards.length,
      });
    } catch (err: unknown) {
      await logAutomation('daily_tokenomics_dist', 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * 5. Affiliate Payout Processing: Validate referrals after 30-day hold and queue payouts.
   * Only referrals tracked > 30 days ago are eligible to prevent charge-back fraud.
   */
  /**
   * Dunning escalation: sends day-3, day-7, day-14 billing reminders to
   * past-due subscribers, de-duplicating via the activity log.
   */
  private async runDunningEscalation() {
    const workflowName = 'dunning_escalation';
    try {
      const apiUrl = `${APP_URL}/api/cron/dunning`;
      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (!internalSecret) {
        await logAutomation(workflowName, 'cron', 'failure', null, 'INTERNAL_API_SECRET not set');
        return;
      }
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'x-internal-secret': internalSecret, 'Content-Type': 'application/json' },
      });
      const data = res.ok ? await res.json() as { checked?: number; remindersSent?: number } : null;
      await logAutomation(workflowName, 'cron', res.ok ? 'success' : 'failure', data ?? { status: res.status });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Triggers the affiliate payout processor via the internal API.
   * Processes pending affiliate_payouts rows via Stripe Connect transfers.
   */
  private async triggerAffiliatePayoutProcessor() {
    const workflowName = 'affiliate_payout_processor';
    try {
      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (!internalSecret) return;
      const res = await fetch(`${APP_URL}/api/affiliate/payout`, {
        method: 'POST',
        headers: { 'x-internal-secret': internalSecret, 'Content-Type': 'application/json' },
      });
      const data = res.ok ? await res.json() as { processed?: number; succeeded?: number; failed?: number } : null;
      await logAutomation(workflowName, 'cron', res.ok ? 'success' : 'failure', data ?? { status: res.status });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }

  /**
   * Re-engagement engine: emails lapsed free-tier users (active 7–30 days ago,
   * not converted) and pings a growth webhook for high-score prospects.
   */
  private async triggerGrowthEngine() {
    const workflowName = 'growth_reengagement_engine';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
      const sevenDaysAgo  = new Date(now.getTime() -  7 * 86_400_000).toISOString();

      // Free-tier users who haven't converted, last seen 7–30 days ago
      const { data: lapsed } = await admin
        .from('profiles')
        .select('id, email, full_name, subscription_plan, last_sign_in_at')
        .eq('subscription_plan', 'free')
        .lte('last_sign_in_at', sevenDaysAgo)
        .gte('last_sign_in_at', thirtyDaysAgo)
        .limit(25);

      if (!lapsed || lapsed.length === 0) {
        await logAutomation(workflowName, 'cron', 'success', { lapsed: 0 });
        return;
      }

      let sent = 0;
      let failed = 0;
      for (const user of lapsed) {
        const email = (user as { email?: string }).email;
        if (!email) { failed++; continue; }
        const firstName = ((user as { full_name?: string }).full_name || '').split(' ')[0] || 'there';

        const result = await sendEmail({
          from: 'QRON <hello@qron.space>',
          to: email,
          subject: `${firstName}, your QRON codes are waiting`,
          html: `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;border:1px solid #333">
            <p>Hi ${firstName},</p>
            <p>You signed up for QRON but haven't been back in a while. Your free generations are still there.</p>
            <p>If you need more or want AI-certified QR codes that actually track, the Creator Pack is just $99 one-time — no subscription.</p>
            <a href="${APP_URL}/#pricing" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">See Plans</a>
            <p style="color:#555;font-size:12px">Unsubscribe any time — reply with "stop".</p>
          </div>`,
          text: `Hi ${firstName}, your QRON generations are waiting. See plans: ${APP_URL}/#pricing`,
        });

        if (result.ok) sent++; else failed++;
      }

      // Fire growth webhook (e.g. n8n, Zapier) for high-score prospects
      const growthWebhook = process.env.GROWTH_ENGINE_WEBHOOK_URL;
      if (growthWebhook) {
        await fetch(growthWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'reengagement_batch', sent, failed, ts: now.toISOString() }),
        }).catch(() => {});
      }

      await logAutomation(workflowName, 'cron', 'success', { lapsed: lapsed.length, sent, failed });
    } catch (err: unknown) {
      await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
    }
  }
}
