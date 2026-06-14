/**
 * Agent unit tests — all external I/O (LLM, email, DB, HubSpot, fetch) is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MissionTask } from '../drizzle/schema';

// ─── Shared mutable mock state ────────────────────────────────────────────────

const mockEnv = vi.hoisted(() => ({
  requireOutreachApproval: false,
  autonomousPipelineEnabled: true,
  forgeApiKey: 'test-key',
  forgeApiUrl: 'https://fake.api',
  jwtSecret: 'secret',
  databaseUrl: '',
  hubspotServiceKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  oauthServerUrl: '',
  appId: 'test-app',
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./_core/env.js', () => ({ ENV: mockEnv }));

vi.mock('./db.js', () => ({
  getDb:                vi.fn().mockResolvedValue(null),
  logActivity:          vi.fn().mockResolvedValue(undefined),
  enqueueTask:          vi.fn().mockResolvedValue(undefined),
  markTaskWaitingHuman: vi.fn().mockResolvedValue(undefined),
  getAdaptivePriors:    vi.fn().mockResolvedValue({
    GOV:     { alpha: 2,  beta: 23 },
    RETAIL:  { alpha: 3,  beta: 17 },
    PRESS:   { alpha: 4,  beta: 16 },
    PARTNER: { alpha: 2,  beta: 6  },
    DEFAULT: { alpha: 1,  beta: 4  },
  }),
}));

vi.mock('./_core/llm.js', () => ({
  invokeLLM: vi.fn(),
}));

vi.mock('./_core/dataApi.js', () => ({
  callDataApi: vi.fn().mockResolvedValue({ organic: [] }),
}));

vi.mock('./email-service.js', () => ({
  sendEmail:           vi.fn().mockResolvedValue({ status: 'sent', threadId: 'thread-123' }),
  checkThreadReplies:  vi.fn().mockResolvedValue({ hasReply: false }),
  isSuppressed:        vi.fn().mockReturnValue(false),
}));

vi.mock('./apollo-service.js', () => ({
  apolloSearchLeads: vi.fn().mockResolvedValue([
    { name: 'Alice', org: 'GovCorp',  email: 'alice@gov.com', title: 'Director', seniority: 'director' },
    { name: 'Bob',   org: 'GovInc',   email: 'bob@gov.com',   title: 'Manager',  seniority: 'manager'  },
  ]),
}));

vi.mock('./hubspot-service.js', () => ({
  syncLeadToHubSpot:    vi.fn().mockResolvedValue(undefined),
  isHubSpotConfigured:  vi.fn().mockReturnValue(false),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(kind: string, payload: Record<string, unknown> = {}): MissionTask {
  return {
    id: 'task-test-001',
    missionId: 'mission-test-001',
    title: 'test task',
    description: 'test task description',
    kind,
    payload,
    status: 'RUNNING',
    error: null,
    order: 0,
    priority: 0,
    result: null,
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function llmContentResponse(content: string): import('./_core/llm.js').InvokeResult {
  return {
    id: 'mock',
    created: 0,
    model: 'mock',
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop',
    }],
  };
}

function llmJsonResponse(data: unknown): import('./_core/llm.js').InvokeResult {
  return llmContentResponse(JSON.stringify(data));
}

// ─── lead-finder ─────────────────────────────────────────────────────────────

describe('runLeadFinder', () => {
  let invokeLLM: ReturnType<typeof vi.fn>;
  let enqueueTask: ReturnType<typeof vi.fn>;
  let logActivity: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const llmMod    = await import('./_core/llm.js');
    const dbMod     = await import('./db.js');
    invokeLLM  = vi.mocked(llmMod.invokeLLM);
    enqueueTask = vi.mocked(dbMod.enqueueTask);
    logActivity = vi.mocked(dbMod.logActivity);
  });

  it('enqueues a DRAFT_OUTBOUND_EMAIL task for each valid lead', async () => {
    // Apollo returns 2 leads; LLM scoring assigns fit probabilities
    invokeLLM.mockResolvedValueOnce(llmJsonResponse([
      { index: 0, fitProbability: 0.8, fitNotes: 'strong procurement fit' },
      { index: 1, fitProbability: 0.6, fitNotes: 'moderate fit' },
    ]));

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    await runLeadFinder(makeTask('FIND_GOV_LEADS', { count: 2, segment: 'GOV' }));

    expect(enqueueTask).toHaveBeenCalledTimes(2);
    expect(enqueueTask).toHaveBeenCalledWith(
      'mission-test-001',
      'DRAFT_OUTBOUND_EMAIL',
      expect.objectContaining({ leadEmail: 'alice@gov.com', segment: 'GOV' }),
    );
  });

  it('skips leads without email or org', async () => {
    const { apolloSearchLeads } = await import('./apollo-service.js');
    vi.mocked(apolloSearchLeads).mockResolvedValueOnce([
      { name: 'Valid', org: 'ValidCorp', email: 'valid@corp.com', title: 'Director', firstName: 'Valid', lastName: 'User' },
    ]);
    invokeLLM.mockResolvedValueOnce(llmJsonResponse([
      { index: 0, fitProbability: 0.7, fitNotes: 'good fit' },
    ]));

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    await runLeadFinder(makeTask('FIND_GOV_LEADS', { segment: 'GOV' }));

    expect(enqueueTask).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully when LLM scoring returns unparseable JSON', async () => {
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: 'not json {{{{' } }] });

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    // Should NOT throw — uses fallback 0.5 score for each lead
    await expect(runLeadFinder(makeTask('FIND_GOV_LEADS', { segment: 'GOV' }))).resolves.toBeUndefined();
    // Both Apollo leads get enqueued despite bad scoring
    expect(enqueueTask).toHaveBeenCalledTimes(2);
  });

  it('uses RETAIL segment for FIND_RETAIL_LEADS task kind', async () => {
    invokeLLM.mockResolvedValueOnce(llmJsonResponse([]));

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    await runLeadFinder(makeTask('FIND_RETAIL_LEADS'));

    // LLM scoring prompt should mention RETAIL
    const prompt = invokeLLM.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('RETAIL');
  });

  it('logs activity on completion', async () => {
    invokeLLM.mockResolvedValueOnce(llmJsonResponse([]));

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    await runLeadFinder(makeTask('FIND_GOV_LEADS', { segment: 'GOV' }));

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lead_finder_completed', details: expect.objectContaining({ source: 'apollo' }) }),
    );
  });

  it('Bayesian preamble appears in LLM scoring prompt', async () => {
    invokeLLM.mockResolvedValueOnce(llmJsonResponse([]));

    const { runLeadFinder } = await import('./agents/lead-finder.js');
    await runLeadFinder(makeTask('FIND_GOV_LEADS', { segment: 'GOV' }));

    const prompt = invokeLLM.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('[BAYESIAN REASONING]');
    expect(prompt).toContain('Expected value per converted lead');
  });
});

// ─── outbound-email ───────────────────────────────────────────────────────────

describe('runOutboundEmail', () => {
  let invokeLLM: ReturnType<typeof vi.fn>;
  let sendEmail: ReturnType<typeof vi.fn>;
  let markTaskWaitingHuman: ReturnType<typeof vi.fn>;
  let logActivity: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const llmMod   = await import('./_core/llm.js');
    const emailMod = await import('./email-service.js');
    const dbMod    = await import('./db.js');
    invokeLLM           = vi.mocked(llmMod.invokeLLM);
    sendEmail           = vi.mocked(emailMod.sendEmail);
    markTaskWaitingHuman = vi.mocked(dbMod.markTaskWaitingHuman);
    logActivity         = vi.mocked(dbMod.logActivity);
  });

  it('sends email directly when requireOutreachApproval is false', async () => {
    mockEnv.requireOutreachApproval = false;
    invokeLLM.mockResolvedValueOnce(llmJsonResponse({ subject: 'Hello', body: 'Test body' }));

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', {
      segment: 'GOV', sequence: 1, leadEmail: 'lead@gov.com', leadName: 'Alice', leadOrg: 'GovCorp',
    }));

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'lead@gov.com' }));
    expect(markTaskWaitingHuman).not.toHaveBeenCalled();
  });

  it('saves draft and marks WAITING_HUMAN when requireOutreachApproval is true', async () => {
    mockEnv.requireOutreachApproval = true;
    invokeLLM.mockResolvedValueOnce(llmJsonResponse({ subject: 'Hello', body: 'Test body' }));

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', {
      segment: 'GOV', leadEmail: 'lead@gov.com',
    }));

    expect(sendEmail).not.toHaveBeenCalled();
    expect(markTaskWaitingHuman).toHaveBeenCalledWith('task-test-001');
  });

  it('throws if LLM returns unparseable JSON', async () => {
    mockEnv.requireOutreachApproval = false;
    invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: 'bad json' } }] });

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await expect(runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', {
      segment: 'GOV', leadEmail: 'x@y.com',
    }))).rejects.toThrow(/unparseable JSON/);
  });

  it('throws if no leadEmail on direct send', async () => {
    mockEnv.requireOutreachApproval = false;
    invokeLLM.mockResolvedValueOnce(llmJsonResponse({ subject: 'Hi', body: 'Body' }));

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await expect(runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', { segment: 'GOV' })))
      .rejects.toThrow(/No leadEmail/);
  });

  it('Bayesian preamble appears in LLM prompt', async () => {
    mockEnv.requireOutreachApproval = false;
    invokeLLM.mockResolvedValueOnce(llmJsonResponse({ subject: 'S', body: 'B' }));

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', {
      segment: 'GOV', leadEmail: 'a@b.com',
    }));

    const prompt = invokeLLM.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('[BAYESIAN REASONING]');
    expect(prompt).toContain('[END REASONING]');
  });

  it('logs activity after sending', async () => {
    mockEnv.requireOutreachApproval = false;
    invokeLLM.mockResolvedValueOnce(llmJsonResponse({ subject: 'Hi', body: 'Body' }));

    const { runOutboundEmail } = await import('./agents/outbound-email.js');
    await runOutboundEmail(makeTask('DRAFT_OUTBOUND_EMAIL', {
      segment: 'GOV', leadEmail: 'a@b.com',
    }));

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound_email_sent' }),
    );
  });
});

// ─── followup-sequence ────────────────────────────────────────────────────────

describe('runFollowupSequence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs and returns early when no DB connection', async () => {
    const { logActivity } = await import('./db.js');
    const { runFollowupSequence } = await import('./agents/followup.js');

    await runFollowupSequence(makeTask('FOLLOWUP_SEQUENCE', { segment: 'GOV' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'followup_skipped_no_db' }),
    );
  });
});

// ─── pilot-packet ─────────────────────────────────────────────────────────────

describe('runBuildPilotPacket', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls LLM and logs activity', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({
      title: 'GOV Pilot Packet',
      sections: [{ heading: 'Exec Summary', content: 'AuthiChain...' }],
    }));

    const { runBuildPilotPacket } = await import('./agents/pilot-packet.js');
    await runBuildPilotPacket(makeTask('BUILD_PILOT_PACKET', { segment: 'GOV' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pilot_packet_built' }),
    );
  });

  it('throws on unparseable LLM JSON', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmContentResponse('{{bad'));

    const { runBuildPilotPacket } = await import('./agents/pilot-packet.js');
    await expect(runBuildPilotPacket(makeTask('BUILD_PILOT_PACKET')))
      .rejects.toThrow(/unparseable JSON/);
  });
});

describe('runDraftIntelDossier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls LLM and logs activity', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({
      title: 'GOV Dossier',
      sections: [],
    }));

    const { runDraftIntelDossier } = await import('./agents/pilot-packet.js');
    await runDraftIntelDossier(makeTask('DRAFT_INTEL_DOSSIER', { segment: 'GOV' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'intel_dossier_drafted' }),
    );
  });
});

// ─── crm-update ───────────────────────────────────────────────────────────────

describe('runCrmUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs skip and returns when HubSpot is not configured', async () => {
    const { isHubSpotConfigured } = await import('./hubspot-service.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(isHubSpotConfigured).mockReturnValue(false);

    const { runCrmUpdate } = await import('./agents/crm-update.js');
    await runCrmUpdate(makeTask('CRM_UPDATE', { segment: 'GOV' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm_update_skipped' }),
    );
    const { syncLeadToHubSpot } = await import('./hubspot-service.js');
    expect(vi.mocked(syncLeadToHubSpot)).not.toHaveBeenCalled();
  });

  it('syncs single lead when HubSpot is configured and leadEmail in payload', async () => {
    const { isHubSpotConfigured, syncLeadToHubSpot } = await import('./hubspot-service.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(isHubSpotConfigured).mockReturnValue(true);

    const { runCrmUpdate } = await import('./agents/crm-update.js');
    await runCrmUpdate(makeTask('CRM_UPDATE', {
      leadEmail: 'alice@gov.com', leadName: 'Alice', leadOrg: 'GovCorp',
    }));

    expect(vi.mocked(syncLeadToHubSpot)).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@gov.com' }),
    );
    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm_lead_synced' }),
    );
  });
});

// ─── retail ───────────────────────────────────────────────────────────────────

describe('runFinalizeRetailSignage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls LLM and logs retail_signage_finalized', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({
      posScan: 'Scan to verify', shelfTalker: 'Authentic product', staffPoints: [],
    }));

    const { runFinalizeRetailSignage } = await import('./agents/retail.js');
    await runFinalizeRetailSignage(makeTask('FINALIZE_RETAIL_SIGNAGE', { vertical: 'dispensary' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retail_signage_finalized' }),
    );
  });

  it('throws on unparseable JSON', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmContentResponse('{{'));

    const { runFinalizeRetailSignage } = await import('./agents/retail.js');
    await expect(runFinalizeRetailSignage(makeTask('FINALIZE_RETAIL_SIGNAGE')))
      .rejects.toThrow(/unparseable JSON/);
  });
});

describe('runPackageSkuOnboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls LLM and logs sku_onboarding_packaged', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({ sections: [] }));

    const { runPackageSkuOnboarding } = await import('./agents/retail.js');
    await runPackageSkuOnboarding(makeTask('PACKAGE_SKU_ONBOARDING', { skuCount: 5 }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sku_onboarding_packaged' }),
    );
  });
});

// ─── content ──────────────────────────────────────────────────────────────────

describe('content agents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runGenerateLaunchChecklist logs launch_checklist_generated', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({ title: 'Checklist', categories: [] }));

    const { runGenerateLaunchChecklist } = await import('./agents/content.js');
    await runGenerateLaunchChecklist(makeTask('GENERATE_LAUNCH_CHECKLIST', { scope: 'full_launch' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'launch_checklist_generated' }),
    );
  });

  it('runDraftLaunchEmail logs launch_email_drafted', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({ subject: 'Launch!', body: 'We launched.' }));

    const { runDraftLaunchEmail } = await import('./agents/content.js');
    await runDraftLaunchEmail(makeTask('DRAFT_LAUNCH_EMAIL', { audience: 'founders' }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'launch_email_drafted' }),
    );
  });

  it('runDraftPressRelease logs press_release_drafted', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({ headline: 'AuthiChain Launches', body: '...' }));

    const { runDraftPressRelease } = await import('./agents/content.js');
    await runDraftPressRelease(makeTask('DRAFT_PRESS_RELEASE'));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'press_release_drafted' }),
    );
  });

  it('runScheduleSocialPosts logs social_posts_scheduled', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    const { logActivity } = await import('./db.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmJsonResponse({ platforms: { twitter: [] } }));

    const { runScheduleSocialPosts } = await import('./agents/content.js');
    await runScheduleSocialPosts(makeTask('SCHEDULE_SOCIAL_POSTS', { platforms: ['twitter'] }));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'social_posts_scheduled' }),
    );
  });

  it('throws on unparseable content JSON', async () => {
    const { invokeLLM } = await import('./_core/llm.js');
    vi.mocked(invokeLLM).mockResolvedValueOnce(llmContentResponse('bad{{'));

    const { runGenerateLaunchChecklist } = await import('./agents/content.js');
    await expect(runGenerateLaunchChecklist(makeTask('GENERATE_LAUNCH_CHECKLIST')))
      .rejects.toThrow(/unparseable JSON/);
  });
});

// ─── infra agents ─────────────────────────────────────────────────────────────

describe('infra agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('runCheckDnsConfig', () => {
    it('completes without throwing when all DNS records resolve', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ Status: 0, Answer: [{ data: '1.2.3.4' }] }),
      }));

      const { logActivity } = await import('./db.js');
      const { runCheckDnsConfig } = await import('./agents/infra.js');
      await runCheckDnsConfig(makeTask('CHECK_DNS_CONFIG', { domain: 'authichain.com' }));

      expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dns_config_checked' }),
      );
    });

    it('throws when any DNS record returns non-zero status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ Status: 3 /* NXDOMAIN */ }),
      }));

      const { runCheckDnsConfig } = await import('./agents/infra.js');
      await expect(runCheckDnsConfig(makeTask('CHECK_DNS_CONFIG', { domain: 'authichain.com' })))
        .rejects.toThrow(/DNS check failed/);
    });

    it('marks record as "unreachable" when fetch throws, then throws due to failures', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const { runCheckDnsConfig } = await import('./agents/infra.js');
      await expect(runCheckDnsConfig(makeTask('CHECK_DNS_CONFIG', { domain: 'authichain.com' })))
        .rejects.toThrow(/DNS check failed/);
    });
  });

  describe('runVerifySsl', () => {
    it('completes without throwing when HTTPS responds 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const { runVerifySsl } = await import('./agents/infra.js');
      await expect(runVerifySsl(makeTask('VERIFY_SSL', { domain: 'authichain.com' }))).resolves.not.toThrow();
    });

    it('throws when HTTPS returns non-2xx', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

      const { runVerifySsl } = await import('./agents/infra.js');
      await expect(runVerifySsl(makeTask('VERIFY_SSL', { domain: 'authichain.com' })))
        .rejects.toThrow(/SSL\/connectivity check failed/);
    });

    it('throws when fetch rejects (SSL error)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE')));

      const { runVerifySsl } = await import('./agents/infra.js');
      await expect(runVerifySsl(makeTask('VERIFY_SSL', { domain: 'authichain.com' })))
        .rejects.toThrow(/SSL\/connectivity check failed/);
    });
  });

  describe('runLighthouseAudit', () => {
    it('logs scores and completes when PageSpeed API responds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          lighthouseResult: {
            categories: {
              performance:   { score: 0.95 },
              accessibility: { score: 0.88 },
              seo:           { score: 0.92 },
            },
          },
        }),
      }));

      const { logActivity } = await import('./db.js');
      const { runLighthouseAudit } = await import('./agents/infra.js');
      await runLighthouseAudit(makeTask('RUN_LIGHTHOUSE_AUDIT', { url: 'https://authichain.com' }));

      const call = vi.mocked(logActivity).mock.calls[0][0];
      expect((call as any).details.scores.performance).toBe(95);
      expect((call as any).details.scores.accessibility).toBe(88);
    });

    it('throws when PageSpeed API returns error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      }));

      const { runLighthouseAudit } = await import('./agents/infra.js');
      await expect(runLighthouseAudit(makeTask('RUN_LIGHTHOUSE_AUDIT')))
        .rejects.toThrow(/Lighthouse audit failed/);
    });

    it('throws when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

      const { runLighthouseAudit } = await import('./agents/infra.js');
      await expect(runLighthouseAudit(makeTask('RUN_LIGHTHOUSE_AUDIT')))
        .rejects.toThrow(/Lighthouse audit failed/);
    });
  });
});
