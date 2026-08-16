/**
 * Task runner tests — verifies routing, lifecycle marking, and error handling.
 * All agents and db lifecycle functions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MissionTask } from '../drizzle/schema';

// ─── Mock all agents ──────────────────────────────────────────────────────────

vi.mock('./agents/lead-finder.js',   () => ({ runLeadFinder:           vi.fn().mockResolvedValue(undefined) }));
vi.mock('./agents/outbound-email.js', () => ({ runOutboundEmail:        vi.fn().mockResolvedValue(undefined) }));
vi.mock('./agents/followup.js',      () => ({ runFollowupSequence:      vi.fn().mockResolvedValue(undefined) }));
vi.mock('./agents/pilot-packet.js',  () => ({
  runBuildPilotPacket:  vi.fn().mockResolvedValue(undefined),
  runDraftIntelDossier: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/crm-update.js',    () => ({ runCrmUpdate:             vi.fn().mockResolvedValue(undefined) }));
vi.mock('./agents/retail.js',        () => ({
  runFinalizeRetailSignage:  vi.fn().mockResolvedValue(undefined),
  runPackageSkuOnboarding:   vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/infra.js',         () => ({
  runCheckDnsConfig:    vi.fn().mockResolvedValue(undefined),
  runVerifySsl:         vi.fn().mockResolvedValue(undefined),
  runLighthouseAudit:   vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/content.js',       () => ({
  runGenerateLaunchChecklist: vi.fn().mockResolvedValue(undefined),
  runDraftLaunchEmail:        vi.fn().mockResolvedValue(undefined),
  runDraftPressRelease:       vi.fn().mockResolvedValue(undefined),
  runScheduleSocialPosts:     vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/browser.js',        () => ({
  runBrowseResearchLead:        vi.fn().mockResolvedValue(undefined),
  runBrowseCompetitorMonitor:   vi.fn().mockResolvedValue(undefined),
  runBrowseScrapeIndustryNews:  vi.fn().mockResolvedValue(undefined),
  runBrowseVerifyProductUrl:    vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/browser-vision.js', () => ({
  runVisionResearchLead: vi.fn().mockResolvedValue(undefined),
  runVisionFreeform:     vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock db lifecycle functions ──────────────────────────────────────────────

vi.mock('./db.js', () => ({
  markTaskRunning:  vi.fn().mockResolvedValue(true),
  markTaskDone:     vi.fn().mockResolvedValue(undefined),
  markTaskFailed:   vi.fn().mockResolvedValue(undefined),
  logActivity:      vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(kind: string): MissionTask {
  return {
    id: `task-${kind}`,
    missionId: 'mission-001',
    title: `task-${kind}`,
    description: `task-${kind} desc`,
    kind,
    payload: {},
    status: 'PENDING',
    error: null,
    result: null,
    priority: 0,
    scheduledAt: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runTask — routing', () => {
  beforeEach(() => vi.clearAllMocks());

  const routingCases: Array<{ kind: string; module: string; fn: string }> = [
    { kind: 'FIND_GOV_LEADS',           module: './agents/lead-finder.js',    fn: 'runLeadFinder'           },
    { kind: 'FIND_RETAIL_LEADS',         module: './agents/lead-finder.js',    fn: 'runLeadFinder'           },
    { kind: 'DRAFT_OUTBOUND_EMAIL',      module: './agents/outbound-email.js', fn: 'runOutboundEmail'        },
    { kind: 'FOLLOWUP_SEQUENCE',         module: './agents/followup.js',       fn: 'runFollowupSequence'     },
    { kind: 'BUILD_PILOT_PACKET',        module: './agents/pilot-packet.js',   fn: 'runBuildPilotPacket'     },
    { kind: 'DRAFT_INTEL_DOSSIER',       module: './agents/pilot-packet.js',   fn: 'runDraftIntelDossier'    },
    { kind: 'CRM_UPDATE',                module: './agents/crm-update.js',     fn: 'runCrmUpdate'            },
    { kind: 'FINALIZE_RETAIL_SIGNAGE',   module: './agents/retail.js',         fn: 'runFinalizeRetailSignage'},
    { kind: 'PACKAGE_SKU_ONBOARDING',    module: './agents/retail.js',         fn: 'runPackageSkuOnboarding' },
    { kind: 'CHECK_DNS_CONFIG',          module: './agents/infra.js',          fn: 'runCheckDnsConfig'       },
    { kind: 'VERIFY_SSL',                module: './agents/infra.js',          fn: 'runVerifySsl'            },
    { kind: 'RUN_LIGHTHOUSE_AUDIT',      module: './agents/infra.js',          fn: 'runLighthouseAudit'      },
    { kind: 'GENERATE_LAUNCH_CHECKLIST', module: './agents/content.js',        fn: 'runGenerateLaunchChecklist'},
    { kind: 'DRAFT_LAUNCH_EMAIL',        module: './agents/content.js',        fn: 'runDraftLaunchEmail'     },
    { kind: 'DRAFT_PRESS_RELEASE',       module: './agents/content.js',        fn: 'runDraftPressRelease'    },
    { kind: 'SCHEDULE_SOCIAL_POSTS',          module: './agents/content.js',         fn: 'runScheduleSocialPosts'       },
    { kind: 'BROWSE_RESEARCH_LEAD',           module: './agents/browser.js',         fn: 'runBrowseResearchLead'        },
    { kind: 'BROWSE_COMPETITOR_MONITOR',      module: './agents/browser.js',         fn: 'runBrowseCompetitorMonitor'   },
    { kind: 'BROWSE_SCRAPE_INDUSTRY_NEWS',    module: './agents/browser.js',         fn: 'runBrowseScrapeIndustryNews'  },
    { kind: 'BROWSE_VERIFY_PRODUCT_URL',      module: './agents/browser.js',         fn: 'runBrowseVerifyProductUrl'    },
    { kind: 'BROWSE_VISION_RESEARCH_LEAD',    module: './agents/browser-vision.js',  fn: 'runVisionResearchLead'        },
    { kind: 'BROWSE_VISION_FREEFORM',         module: './agents/browser-vision.js',  fn: 'runVisionFreeform'            },
  ];

  for (const { kind, module: mod, fn } of routingCases) {
    it(`routes ${kind} → ${fn}`, async () => {
      const { runTask }   = await import('./jobs/task-runner.js');
      const agentModule   = await import(mod as any);
      const agent         = vi.mocked((agentModule as any)[fn]);

      await runTask(makeTask(kind));

      expect(agent).toHaveBeenCalledOnce();
    });
  }
});

describe('runTask — lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls markTaskRunning before the agent', async () => {
    const callOrder: string[] = [];
    const { markTaskRunning } = await import('./db.js');
    const { runLeadFinder } = await import('./agents/lead-finder.js');
    vi.mocked(markTaskRunning).mockImplementation(async () => { callOrder.push('running'); return true; });
    vi.mocked(runLeadFinder).mockImplementation(async () => { callOrder.push('agent'); });

    const { runTask } = await import('./jobs/task-runner.js');
    await runTask(makeTask('FIND_GOV_LEADS'));

    expect(callOrder[0]).toBe('running');
    expect(callOrder[1]).toBe('agent');
  });

  it('calls markTaskDone after a successful agent run', async () => {
    const { markTaskDone } = await import('./db.js');
    const { runTask } = await import('./jobs/task-runner.js');
    await runTask(makeTask('FIND_GOV_LEADS'));
    expect(vi.mocked(markTaskDone)).toHaveBeenCalledWith('task-FIND_GOV_LEADS');
  });

  it('calls markTaskFailed when the agent throws', async () => {
    const { markTaskFailed, markTaskDone } = await import('./db.js');
    const { runLeadFinder } = await import('./agents/lead-finder.js');
    vi.mocked(runLeadFinder).mockRejectedValueOnce(new Error('LLM timeout'));

    const { runTask } = await import('./jobs/task-runner.js');
    await runTask(makeTask('FIND_GOV_LEADS'));

    expect(vi.mocked(markTaskFailed)).toHaveBeenCalledWith('task-FIND_GOV_LEADS', 'LLM timeout');
    expect(vi.mocked(markTaskDone)).not.toHaveBeenCalled();
  });

  it('logs task_failed activity when the agent throws', async () => {
    const { logActivity } = await import('./db.js');
    const { runLeadFinder } = await import('./agents/lead-finder.js');
    vi.mocked(runLeadFinder).mockRejectedValueOnce(new Error('timeout'));

    const { runTask } = await import('./jobs/task-runner.js');
    await runTask(makeTask('FIND_GOV_LEADS'));

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task_failed', details: expect.objectContaining({ error: 'timeout' }) }),
    );
  });

  it('does not propagate agent exceptions — resolves cleanly', async () => {
    const { runLeadFinder } = await import('./agents/lead-finder.js');
    vi.mocked(runLeadFinder).mockRejectedValueOnce(new Error('boom'));

    const { runTask } = await import('./jobs/task-runner.js');
    await expect(runTask(makeTask('FIND_GOV_LEADS'))).resolves.not.toThrow();
  });
});

describe('runTask — unknown kind', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the task as failed with "Unknown task kind" message', async () => {
    const { markTaskFailed } = await import('./db.js');
    const { runTask } = await import('./jobs/task-runner.js');

    await runTask(makeTask('NOT_A_REAL_TASK'));

    expect(vi.mocked(markTaskFailed)).toHaveBeenCalledWith(
      'task-NOT_A_REAL_TASK',
      expect.stringContaining('Unknown task kind'),
    );
  });
});
