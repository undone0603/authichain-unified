import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity } from '../db.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface RetailPayload {
  vertical?: string;
  skuCount?: number;
}

export async function runFinalizeRetailSignage(task: Task): Promise<void> {
  const payload = task.payload as RetailPayload;
  const vertical = payload.vertical ?? 'dispensary';

  const prompt = `You are helping a ${vertical} retail partner finalize in-store signage for AuthiChain product authentication.

Create signage copy and placement guide for:
1. Point-of-sale QR scan prompt (10 words max, consumer-facing)
2. Shelf talker text (25 words max)
3. Counter card headline + 2-line body
4. Staff talking points (3 bullet points for training)

Return JSON: { "posScan": "...", "shelfTalker": "...", "counterCard": { "headline": "...", "body": "..." }, "staffPoints": ["..."] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const signage = parseLLMContent<unknown>(result.choices[0].message.content);

  await logActivity({ userId: null, action: 'retail_signage_finalized', entityType: 'task', entityId: 0, details: { taskId: task.id,
    vertical,
    missionId: task.missionId,
  }});
}

export async function runPackageSkuOnboarding(task: Task): Promise<void> {
  const payload = task.payload as RetailPayload;
  const skuCount = payload.skuCount ?? 10;
  const vertical = payload.vertical ?? 'dispensary';

  const prompt = `Create an SKU onboarding checklist for a ${vertical} integrating AuthiChain authentication for ${skuCount} products.

Include:
1. Pre-onboarding requirements (data fields needed per SKU)
2. QR code generation steps
3. Batch upload format (CSV headers)
4. Testing protocol (scan verification steps)
5. Go-live checklist

Return JSON: { "sections": [{ "heading": "...", "steps": ["..."] }] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const onboarding = parseLLMContent<unknown>(result.choices[0].message.content);

  await logActivity({ userId: null, action: 'sku_onboarding_packaged', entityType: 'task', entityId: 0, details: { taskId: task.id,
    vertical,
    skuCount,
    missionId: task.missionId,
  }});
}
