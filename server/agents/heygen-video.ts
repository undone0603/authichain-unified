/**
 * Agent: GENERATE_OUTREACH_VIDEO
 *
 * payload: {
 *   leadId: number;
 *   firstName: string;
 *   company: string;
 *   segment: string;      // 'GOV' | 'RETAIL' | 'PRESS'
 *   useCase?: string;
 *   avatarId?: string;    // override default avatar
 *   voiceId?: string;     // override default voice
 * }
 *
 * On completion stores video_url on the lead record via activity log
 * and enqueues DRAFT_OUTBOUND_EMAIL with video_url in payload.
 */

import type { MissionTask as Task } from '../../drizzle/schema.js';
import { logActivity } from '../db.js';
import {
  listAvatars,
  listVoices,
  generateVideo,
  draftOutreachScript,
  getVideoStatus,
} from '../heygen-service.js';

const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 30; // 4 minutes max wait

export async function runGenerateOutreachVideo(task: Task): Promise<void> {
  const p = task.payload as {
    leadId: number;
    firstName: string;
    company: string;
    segment: string;
    useCase?: string;
    avatarId?: string;
    voiceId?: string;
  };

  // Pick avatar: use provided id or first available
  let avatarId = p.avatarId;
  if (!avatarId) {
    const avatars = await listAvatars();
    if (!avatars.length) throw new Error("No HeyGen avatars available");
    avatarId = avatars[0].avatar_id;
  }

  // Pick voice: use provided or first English voice
  let voiceId = p.voiceId;
  if (!voiceId) {
    const voices = await listVoices();
    const enVoice = voices.find(v => v.language?.startsWith("en")) ?? voices[0];
    if (!enVoice) throw new Error("No HeyGen voices available");
    voiceId = enVoice.voice_id;
  }

  // Draft script via LLM
  const script = await draftOutreachScript({
    firstName: p.firstName,
    company: p.company,
    segment: p.segment,
    useCase: p.useCase ?? `anti-counterfeiting for ${p.segment.toLowerCase()} sector`,
  });

  // Kick off generation
  const videoId = await generateVideo({
    avatarId,
    voiceId,
    script,
    title: `Outreach — ${p.firstName} @ ${p.company}`,
  });

  // Poll for completion
  let videoUrl: string | undefined;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getVideoStatus(videoId);
    if (status.status === "completed") {
      videoUrl = status.video_url;
      break;
    }
    if (status.status === "failed") {
      throw new Error(`HeyGen video failed: ${status.error ?? "unknown"}`);
    }
  }

  if (!videoUrl) throw new Error("HeyGen video timed out");

  // Log as activity (stores video_url for lead enrichment)
  await logActivity({
    userId: 0,
    action: "heygen_video_generated",
    entityType: "lead",
    entityId: p.leadId,
    details: { videoId, videoUrl, script, avatarId, voiceId },
  });
}
