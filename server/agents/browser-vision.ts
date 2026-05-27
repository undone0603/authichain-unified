/**
 * Vision-capable browser agent — Playwright + Gemini 2.5 Flash multimodal
 *
 * Implements the Z-kie/browser-native-chatbot-v3 pattern:
 *   screenshot → LLM vision → tool call (click/type/navigate/extract) → loop → done
 *
 * Requirements (server/AgentZ supervisor only — not Vercel serverless):
 *   - playwright-core installed (✓ in package.json)
 *   - Chromium binary: `npx playwright install chromium`
 *   - PLAYWRIGHT_EXECUTABLE_PATH env var, or Chromium found on PATH
 */

import { chromium, type Browser, type Page } from 'playwright-core';
import { invokeLLM, parseLLMContent, type Message, type Tool } from '../_core/llm.js';
import { logActivity, getDb, enqueueTask } from '../db.js';
import { leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

// ── Config ──────────────────────────────────────────────────────────────────
const VIEWPORT   = { width: 1280, height: 800 };
const MAX_STEPS  = 12;
const PAGE_WAIT  = 1_200;       // ms after navigation/click
const JPEG_Q     = 55;          // screenshot quality (tokens vs detail tradeoff)
const EXEC_PATH  = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

// ── Tool definitions (passed to Gemini via tool_use) ────────────────────────
const VISION_TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the browser to an absolute URL',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click at the given pixel coordinates on the current screenshot',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['x', 'y', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type',
      description: 'Type text, optionally focusing a CSS selector first',
      parameters: {
        type: 'object',
        properties: {
          text:     { type: 'string' },
          selector: { type: 'string', description: 'Optional CSS selector to focus first' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the page up or down',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['down', 'up'] },
          pixels:    { type: 'number', description: 'Default 600' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract',
      description: 'Extract findings from the current page and optionally mark the task done',
      parameters: {
        type: 'object',
        properties: {
          findings: { type: 'string', description: 'Extracted information relevant to the objective' },
          done:     { type: 'boolean', description: 'true = task is complete, stop the loop' },
        },
        required: ['findings', 'done'],
      },
    },
  },
];

// ── Browser lifecycle helpers ────────────────────────────────────────────────
async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function screenshot(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: 'jpeg', quality: JPEG_Q, fullPage: false });
  return buf.toString('base64');
}

// ── Core vision loop ─────────────────────────────────────────────────────────
async function visionLoop(page: Page, objective: string): Promise<string> {
  const findings: string[] = [];
  const history: Message[] = [
    {
      role: 'user',
      content: `You are a browser agent. Objective: "${objective}"\n\nUse the available tools to accomplish it. Navigate pages, click UI elements, fill forms, and extract information. Think step-by-step.`,
    },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const b64 = await screenshot(page);
    const url  = page.url();

    history.push({
      role: 'user',
      content: [
        { type: 'text', text: `Step ${step + 1}/${MAX_STEPS}. URL: ${url}\nWhat do you see? Call a tool.` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'auto' } },
      ],
    });

    const result = await invokeLLM({
      messages: history,
      tools: VISION_TOOLS,
      toolChoice: 'required',
    });

    const choice = result.choices[0];
    const assistantMsg: Message = {
      role: 'assistant',
      content: typeof choice.message.content === 'string' ? choice.message.content : '',
    };
    if (choice.message.tool_calls) {
      (assistantMsg as any).tool_calls = choice.message.tool_calls;
    }
    history.push(assistantMsg);

    if (!choice.message.tool_calls?.length) break;

    for (const call of choice.message.tool_calls) {
      const args = JSON.parse(call.function.arguments ?? '{}');
      let toolResult = 'ok';

      switch (call.function.name) {
        case 'navigate':
          await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
          await page.waitForTimeout(PAGE_WAIT);
          break;

        case 'click':
          await page.mouse.click(args.x, args.y);
          await page.waitForTimeout(PAGE_WAIT);
          break;

        case 'type':
          if (args.selector) {
            await page.focus(args.selector).catch(() => {});
          }
          await page.keyboard.type(args.text, { delay: 40 });
          break;

        case 'scroll': {
          const px = args.pixels ?? 600;
          await page.evaluate((y) => window.scrollBy(0, y), args.direction === 'down' ? px : -px);
          await page.waitForTimeout(400);
          break;
        }

        case 'extract':
          if (args.findings?.trim()) findings.push(args.findings.trim());
          toolResult = args.done ? 'DONE' : 'continued';
          break;
      }

      history.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: call.id,
        name: call.function.name,
      } as Message);

      if (toolResult === 'DONE') {
        return findings.join('\n\n') || 'Task completed — no findings extracted.';
      }
    }
  }

  return findings.join('\n\n') || 'Max steps reached — partial findings only.';
}

// ── Public task handlers ─────────────────────────────────────────────────────

export interface VisionResearchLeadPayload {
  leadEmail:  string;
  leadOrg:    string;
  leadName?:  string;
  leadTitle?: string;
  startUrl?:  string;
  segment?:   string;
}

/**
 * BROWSE_VISION_RESEARCH_LEAD
 * Full Playwright vision loop to research a prospect before outreach.
 * More thorough than the fetch-based BROWSE_RESEARCH_LEAD — handles SPAs,
 * JS-rendered pricing pages, and multi-step navigation.
 */
export async function runVisionResearchLead(task: Task): Promise<void> {
  const p = task.payload as VisionResearchLeadPayload;
  const startUrl = p.startUrl ?? `https://${p.leadOrg.toLowerCase().replace(/\s+/g, '')}.com`;

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  let research = '';
  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    research = await visionLoop(page, `
Research ${p.leadOrg} to personalise an AuthiChain cold sales email.
Find: what they sell, their supply chain or brand protection challenges,
any news about counterfeiting/fraud, key decision-makers, company size.
Focus on angles relevant to blockchain product authentication.
Extract a concise CRM note AND a one-sentence personalised email opener.`);
  } finally {
    await browser.close();
  }

  // Summarise into hook + notes
  const summaryResult = await invokeLLM({
    messages: [{
      role: 'user',
      content: `Research findings about ${p.leadOrg}:\n\n${research}\n\nReturn JSON: { "crmNote": "3-5 bullet CRM note", "hookSentence": "one personalised email opener sentence" }`,
    }],
    responseFormat: { type: 'json_object' },
  });

  const { crmNote, hookSentence } = parseLLMContent<{ crmNote: string; hookSentence: string }>(
    summaryResult.choices[0].message.content,
  );

  const db = await getDb();
  if (db) {
    await db.update(leads)
      .set({ notes: `[vision_research]\n${crmNote}`, updatedAt: new Date() })
      .where(eq(leads.email, p.leadEmail.toLowerCase()));
  }

  await enqueueTask(task.missionId, 'DRAFT_OUTBOUND_EMAIL', {
    segment:   p.segment ?? 'DEFAULT',
    sequence:  1,
    leadEmail: p.leadEmail,
    leadName:  p.leadName,
    leadOrg:   p.leadOrg,
    leadTitle: p.leadTitle,
    researchHook: hookSentence,
  });

  await logActivity({
    userId: null, action: 'browse_vision_research_lead_completed',
    entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail: p.leadEmail, leadOrg: p.leadOrg, hookSentence },
  });
}

export interface VisionFreeformPayload {
  startUrl:   string;
  objective:  string;
  missionId?: number;
}

/**
 * BROWSE_VISION_FREEFORM
 * Generic vision agent task — accepts any URL + objective string.
 * Used for ad-hoc automation: form fills, competitor research,
 * sign-up flows, data extraction from JS-heavy dashboards, etc.
 */
export async function runVisionFreeform(task: Task): Promise<void> {
  const p = task.payload as VisionFreeformPayload;

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  let findings = '';
  try {
    await page.goto(p.startUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    findings = await visionLoop(page, p.objective);
  } finally {
    await browser.close();
  }

  await logActivity({
    userId: null, action: 'browse_vision_freeform_completed',
    entityType: 'task', entityId: 0,
    details: { taskId: task.id, startUrl: p.startUrl, objective: p.objective, findings },
  });
}
