import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity } from '../db.js';
export async function runFinalizeRetailSignage(task) {
    const payload = task.payload;
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
    const signage = parseLLMContent(result.choices[0].message.content);
    await logActivity({ userId: null, action: 'retail_signage_finalized', entityType: 'task', entityId: 0, details: { taskId: task.id,
            vertical,
            missionId: task.missionId,
        } });
}
export async function runPackageSkuOnboarding(task) {
    const payload = task.payload;
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
    const onboarding = parseLLMContent(result.choices[0].message.content);
    await logActivity({ userId: null, action: 'sku_onboarding_packaged', entityType: 'task', entityId: 0, details: { taskId: task.id,
            vertical,
            skuCount,
            missionId: task.missionId,
        } });
}
