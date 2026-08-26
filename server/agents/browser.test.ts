import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted controls: what the network returns and what the LLM says about it.
const { net, llm } = vi.hoisted(() => ({
  net: { html: null as string | null },
  llm: { content: '' as string },
}));

vi.mock('../_core/llm.js', () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: llm.content } }] })),
  parseLLMContent: (raw: string) => JSON.parse(raw),
}));

const logActivity = vi.fn(async (..._args: unknown[]) => {});
const enqueueTask = vi.fn(async (..._args: unknown[]) => {});
const leadUpdate = vi.fn();

vi.mock('../db.js', () => ({
  logActivity: (...a: unknown[]) => logActivity(...a),
  enqueueTask: (...a: unknown[]) => enqueueTask(...a),
  // A db whose update() chain records the call and resolves.
  getDb: async () => ({
    update: () => ({ set: () => ({ where: async (...a: unknown[]) => leadUpdate(...a) }) }),
  }),
}));

import { runBrowseResearchLead, isEmptyExtraction, NO_FINDINGS } from './browser';

const task = {
  id: 'task-1',
  missionId: 'mission-1',
  payload: {
    leadEmail: 'buyer@example.com',
    leadName: 'Buyer',
    leadOrg: 'Example Corp',
    leadTitle: 'Head of Brand Protection',
    segment: 'LUXURY',
  },
} as never;

beforeEach(() => {
  logActivity.mockClear();
  enqueueTask.mockClear();
  leadUpdate.mockClear();
  net.html = '<html><body>We make luxury handbags and fight counterfeits.</body></html>';

  vi.stubGlobal('fetch', vi.fn(async () => {
    if (net.html === null) return { ok: false, status: 403, url: 'https://examplecorp.com', text: async () => '' };
    return { ok: true, status: 200, url: 'https://examplecorp.com', text: async () => net.html! };
  }));
});

describe('isEmptyExtraction', () => {
  it('recognises the sentinel, blanks, and whitespace', () => {
    expect(isEmptyExtraction(NO_FINDINGS)).toBe(true);
    expect(isEmptyExtraction('')).toBe(true);
    expect(isEmptyExtraction('   \n ')).toBe(true);
    expect(isEmptyExtraction(undefined as unknown as string)).toBe(true);
  });

  it('does not treat real findings as empty', () => {
    expect(isEmptyExtraction('They sell handbags.')).toBe(false);
    // Near-misses must not escalate: only the exact sentinel counts.
    expect(isEmptyExtraction('No findings extracted. Their pricing page 404s.')).toBe(false);
  });
});

describe('runBrowseResearchLead', () => {
  it('escalates to the vision agent when extraction is empty, and sends no email', async () => {
    // The scraper reaches the page but the model extracts nothing from it —
    // the JS-rendered/SPA case the vision agent exists for.
    llm.content = JSON.stringify({ action: 'done', reason: 'nothing here', findings: '' });

    await runBrowseResearchLead(task);

    const kinds = enqueueTask.mock.calls.map(c => c[1]);
    expect(kinds).toEqual(['BROWSE_VISION_RESEARCH_LEAD']);

    // Crucially NOT also DRAFT_OUTBOUND_EMAIL: runVisionResearchLead enqueues
    // that itself, so doing it here too would put two emails before one lead.
    expect(kinds).not.toContain('DRAFT_OUTBOUND_EMAIL');

    const payload = enqueueTask.mock.calls[0][2] as Record<string, unknown>;
    expect(payload).toMatchObject({
      segment: 'LUXURY',
      leadEmail: 'buyer@example.com',
      leadOrg: 'Example Corp',
      leadTitle: 'Head of Brand Protection',
    });
    // The resolved URL is handed over so vision does not re-derive the domain.
    expect(payload.startUrl).toBe('https://examplecorp.com');

    // No CRM note written from an empty scrape.
    expect(leadUpdate).not.toHaveBeenCalled();

    const actions = logActivity.mock.calls.map(c => (c[0] as { action: string }).action);
    expect(actions).toContain('browse_research_lead_escalated_to_vision');
  });

  it('escalates when the site cannot be fetched at all', async () => {
    // A 403 to the bot UA is the other way a real prospect site yields nothing.
    net.html = null;

    await runBrowseResearchLead(task);

    expect(enqueueTask.mock.calls.map(c => c[1])).toEqual(['BROWSE_VISION_RESEARCH_LEAD']);
  });

  it('does not escalate when the scrape produced findings', async () => {
    // Two LLM calls in sequence: the nav step, then the CRM summary.
    const replies = [
      JSON.stringify({ action: 'done', reason: 'got it', findings: 'They sell handbags.' }),
      JSON.stringify({ summary: 'Sells handbags.', hookSentence: 'Saw your counterfeit problem.' }),
    ];
    const { invokeLLM } = await import('../_core/llm.js');
    (invokeLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ choices: [{ message: { content: replies.shift() ?? replies[0] } }] }),
    );

    await runBrowseResearchLead(task);

    const kinds = enqueueTask.mock.calls.map(c => c[1]);
    expect(kinds).toContain('DRAFT_OUTBOUND_EMAIL');
    expect(kinds).not.toContain('BROWSE_VISION_RESEARCH_LEAD');
  });
});
