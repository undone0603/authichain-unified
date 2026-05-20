import { invokeLLM } from '../_core/llm.js';
import { logActivity } from '../db.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface PilotPacketPayload {
  segment?: string;
  focus?: string;
}

const segmentContext: Record<string, string> = {
  GOV: 'government agencies focused on supply chain integrity, border control, and anti-counterfeiting compliance',
  RETAIL: 'retail businesses (dispensaries, specialty retail) focused on product authenticity and brand protection',
  TECH: 'technology partners and enterprise integrators evaluating authentication API capabilities',
  PARTNER: 'strategic partners interested in co-selling or embedding AuthiChain in their platform',
};

export async function runBuildPilotPacket(task: Task): Promise<void> {
  const payload = task.payload as PilotPacketPayload;
  const segment = payload.segment ?? 'GOV';
  const focus = payload.focus ?? segmentContext[segment] ?? 'enterprise customers';

  const prompt = `You are preparing a pilot program proposal document for AuthiChain (authichain.com).

Target audience: ${focus}

Create a comprehensive pilot packet outline including:
1. Executive Summary (2-3 sentences)
2. Problem Statement (specific to this segment)
3. AuthiChain Solution Overview (key features relevant to segment)
4. Pilot Scope (what will be tested, success metrics, timeline: 30-60 days)
5. Implementation Requirements (technical and operational)
6. Pricing & ROI Estimate (placeholder figures)
7. Next Steps & Call to Action

Return JSON: { "title": "...", "sections": [{ "heading": "...", "content": "..." }] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let packet: { title: string; sections: { heading: string; content: string }[] };
  try {
    packet = JSON.parse(result.choices[0].message.content as string ?? '{}');
  } catch {
    throw new Error('Pilot packet LLM returned unparseable JSON');
  }

  await logActivity({ userId: null, action: 'pilot_packet_built', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment,
    title: packet.title,
    sectionCount: packet.sections?.length ?? 0,
    missionId: task.missionId,
  }});
}

export async function runDraftIntelDossier(task: Task): Promise<void> {
  const payload = task.payload as PilotPacketPayload;
  const segment = payload.segment ?? 'GOV';
  const focus = payload.focus ?? segmentContext[segment] ?? 'market landscape';

  const prompt = `You are an intelligence analyst preparing a competitive and market dossier for AuthiChain's ${segment} sales team.

Focus: ${focus}

Include:
1. Market Size & Opportunity (TAM/SAM for this segment)
2. Key Buyer Personas (3-5 decision-maker profiles)
3. Competitive Landscape (2-3 alternatives, AuthiChain differentiators)
4. Objection Handling Guide (top 3 objections + responses)
5. Talking Points (5 bullet points tailored to this audience)
6. Recommended Outreach Channels

Return JSON: { "title": "...", "sections": [{ "heading": "...", "content": "..." }] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let dossier: unknown;
  try {
    dossier = JSON.parse(result.choices[0].message.content as string ?? '{}');
  } catch {
    throw new Error('Intel dossier LLM returned unparseable JSON');
  }

  await logActivity({ userId: null, action: 'intel_dossier_drafted', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment,
    focus,
    missionId: task.missionId,
  }});
}
