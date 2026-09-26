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

import type { Browser, Page } from 'playwright-core';
import { invokeLLM, parseLLMContent, type Message, type Tool } from '../_core/llm.js';
import { logActivity, getDb, enqueueTask } from '../db.js';
import type { VerificationSource } from '../outreach/send-guard.js';
import { leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

// ── Config ──────────────────────────────────────────────────
const VIEWPORT   = { width: 1280, height: 800 };
const MAX_STEPS  = 12;
const PAGE_WAIT  = 1_200;       // ms after navigation/click
const JPEG_Q     = 55;          // screenshot quality (tokens vs detail tradeoff)
const EXEC_PATH  = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

// ── Tool definitions (passed to Gemini via tool_use) ────────────────
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

// ── Browser lifecycle helpers ────────────────────────────────
async function launchBrowser(): Promise<Browser> {
  // Computed specifier so OpenNext/esbuild cannot trace playwright-core into
  // the Workers bundle. Chromium only runs on the Node supervisor.
  const specifier = 'playwright-core';
  const { chromium } = (await import(/* webpackIgnore: true */ specifier)) as {
    chromium: { launch: (opts: Record<string, unknown>) => Promise<Browser> };
  };
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
