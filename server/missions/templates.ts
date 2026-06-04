import type { MissionType, TaskKind } from './types.js';

interface MissionTemplate {
  type: MissionType;
  title: string;
  priority: number;
}

interface TaskTemplate {
  kind: TaskKind;
  payload: Record<string, unknown>;
}

export const missionTemplates: Record<MissionType, MissionTemplate> = {
  TECH_SPRINT: {
    type: 'TECH_SPRINT',
    title: 'Tech Sprint – Feature Development',
    priority: 8,
  },
  GOV_PILOT: {
    type: 'GOV_PILOT',
    title: 'Government Pilot – Initial Agency',
    priority: 10,
  },
  RETAIL_PILOT: {
    type: 'RETAIL_PILOT',
    title: 'Retail Pilot – Dispensary / Retail Partner',
    priority: 9,
  },
  PRESS_LAUNCH: {
    type: 'PRESS_LAUNCH',
    title: 'Press Launch – Media & PR Outreach',
    priority: 8,
  },
  PARTNER_ONBOARDING: {
    type: 'PARTNER_ONBOARDING',
    title: 'Partner Onboarding',
    priority: 7,
  },
  TECH_OS_LOCK: {
    type: 'TECH_OS_LOCK',
    title: 'Tech OS Lock – Platform Defensibility',
    priority: 6,
  },
  LAUNCH_AUTHICHAIN: {
    type: 'LAUNCH_AUTHICHAIN',
    title: 'AuthiChain.com – Full Launch Orchestration',
    priority: 10,
  },
  LUXURY_OUTREACH: {
    type: 'LUXURY_OUTREACH',
    title: 'Luxury Outreach – High-End Brands',
    priority: 9,
  },
  PHARMA_OUTREACH: {
    type: 'PHARMA_OUTREACH',
    title: 'Pharma Outreach – Generic Drug Mfrs',
    priority: 9,
  },
  MEDTECH_OUTREACH: {
    type: 'MEDTECH_OUTREACH',
    title: 'MedTech Outreach – Device Manufacturers',
    priority: 9,
  },
  TIMEPIECE_OUTREACH: {
    type: 'TIMEPIECE_OUTREACH',
    title: 'Timepiece Outreach – Independent Brands',
    priority: 8,
  },
  NEWSJACKING_LAUNCH: {
    type: 'NEWSJACKING_LAUNCH',
    title: 'Newsjacking Launch – Viral PR Response',
    priority: 7,
  },
  MEDTECH_VIDEO_BRIEFING: {
    type: 'MEDTECH_VIDEO_BRIEFING',
    title: 'MedTech Video Briefing – ISO 13485 Audit Automation',
    priority: 8,
  },
  MI_CRA_PARTNERSHIP: {
    type: 'MI_CRA_PARTNERSHIP',
    title: 'Michigan CRA Partnership – Audit Integrity Shield',
    priority: 9,
  },
};

export const taskTemplates: Record<MissionType, TaskTemplate[]> = {
  TECH_SPRINT: [
    {
      kind: 'PLAN_SPRINT',
      payload: {
        feature: 'Feature to be specified at mission creation',
        context: 'authichain-unified full-stack TypeScript Cloudflare Worker',
      },
    },
    // PLAN_SPRINT dynamically enqueues: WRITE_CODE → OPEN_PR → RUN_TESTS → CODE_REVIEW → MERGE_PR → MONITOR_DEPLOY
  ],
  GOV_PILOT: [
    { kind: 'BUILD_PILOT_PACKET',      payload: { segment: 'GOV' } },
    { kind: 'DRAFT_INTEL_DOSSIER',     payload: { segment: 'GOV' } },
    { kind: 'FIND_GOV_LEADS',          payload: { count: 10, icp: 'government agency supply chain / procurement' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL',    payload: { segment: 'GOV', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE',       payload: { segment: 'GOV', maxFollowups: 3 } },
    { kind: 'CRM_UPDATE',              payload: { segment: 'GOV', dealStage: 'pilot_proposed' } },
  ],
  RETAIL_PILOT: [
    { kind: 'FINALIZE_RETAIL_SIGNAGE',  payload: {} },
    { kind: 'PACKAGE_SKU_ONBOARDING',   payload: {} },
    { kind: 'FIND_RETAIL_LEADS',        payload: { count: 15, vertical: 'dispensary', icp: 'retail cannabis dispensary owner' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL',     payload: { segment: 'RETAIL', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE',        payload: { segment: 'RETAIL', maxFollowups: 3 } },
    { kind: 'CRM_UPDATE',               payload: { segment: 'RETAIL', dealStage: 'pilot_proposed' } },
  ],
  PRESS_LAUNCH: [
    { kind: 'FIND_RETAIL_LEADS',        payload: { count: 20, vertical: 'press', icp: 'tech journalist / crypto reporter' } },
    { kind: 'DRAFT_PRESS_RELEASE',      payload: {} },
    { kind: 'DRAFT_OUTBOUND_EMAIL',     payload: { segment: 'PRESS', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE',        payload: { segment: 'PRESS', maxFollowups: 2 } },
    { kind: 'SCHEDULE_SOCIAL_POSTS',    payload: { platforms: ['twitter', 'linkedin'] } },
  ],
  PARTNER_ONBOARDING: [
    { kind: 'BUILD_PILOT_PACKET',       payload: { segment: 'PARTNER' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL',     payload: { segment: 'PARTNER', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE',        payload: { segment: 'PARTNER', maxFollowups: 2 } },
    { kind: 'CRM_UPDATE',               payload: { dealStage: 'partner_onboarding' } },
  ],
  TECH_OS_LOCK: [
    { kind: 'BUILD_PILOT_PACKET',       payload: { segment: 'TECH', focus: 'platform_defensibility' } },
    { kind: 'DRAFT_INTEL_DOSSIER',      payload: { segment: 'TECH', focus: 'competitive_moat' } },
    { kind: 'GENERATE_LAUNCH_CHECKLIST', payload: { scope: 'tech_os' } },
  ],
  LAUNCH_AUTHICHAIN: [
    { kind: 'CHECK_DNS_CONFIG',          payload: { domain: 'authichain.com' } },
    { kind: 'VERIFY_SSL',               payload: { domain: 'authichain.com' } },
    { kind: 'RUN_LIGHTHOUSE_AUDIT',     payload: { url: 'https://authichain.com' } },
    { kind: 'SECURITY_AUDIT',           payload: { scope: 'full_platform', compliance: ['EU_DPP', 'FIPS_140_2'] } },
    { kind: 'GENERATE_LAUNCH_CHECKLIST', payload: { scope: 'full_launch' } },
    { kind: 'DRAFT_LAUNCH_EMAIL',       payload: { audience: 'founders' } },
    { kind: 'DRAFT_PRESS_RELEASE',      payload: {} },
    { kind: 'SCHEDULE_SOCIAL_POSTS',    payload: { platforms: ['twitter', 'linkedin'] } },
  ],
  LUXURY_OUTREACH: [
    { kind: 'FIND_LUXURY_LEADS', payload: { count: 20, icp: 'Head of Brand Protection at luxury fashion houses' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL', payload: { segment: 'LUXURY', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE', payload: { segment: 'LUXURY', maxFollowups: 3 } },
    { kind: 'CRM_UPDATE', payload: { segment: 'LUXURY', dealStage: 'contacted' } },
  ],
  PHARMA_OUTREACH: [
    { kind: 'FIND_PHARMA_LEADS', payload: { count: 15, icp: 'Chief Compliance Officer at generic pharmaceutical manufacturers' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL', payload: { segment: 'PHARMA', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE', payload: { segment: 'PHARMA', maxFollowups: 4 } },
    { kind: 'CRM_UPDATE', payload: { segment: 'PHARMA', dealStage: 'contacted' } },
  ],
  MEDTECH_OUTREACH: [
    { kind: 'FIND_MEDTECH_LEADS', payload: { count: 10, icp: 'Compliance Director at medical device manufacturer' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL', payload: { segment: 'MEDTECH', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE', payload: { segment: 'MEDTECH', maxFollowups: 3 } },
    { kind: 'CRM_UPDATE', payload: { segment: 'MEDTECH', dealStage: 'contacted' } },
  ],
  TIMEPIECE_OUTREACH: [
    { kind: 'FIND_TIMEPIECE_LEADS', payload: { count: 15, icp: 'CEO or Founder of independent luxury watch brand' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL', payload: { segment: 'TIMEPIECE', sequence: 1 } },
    { kind: 'FOLLOWUP_SEQUENCE', payload: { segment: 'TIMEPIECE', maxFollowups: 2 } },
    { kind: 'CRM_UPDATE', payload: { segment: 'TIMEPIECE', dealStage: 'contacted' } },
  ],
  MEDTECH_VIDEO_BRIEFING: [
    { kind: 'GENERATE_OUTREACH_VIDEO', payload: { segment: 'MEDTECH', useCase: 'ISO 13485 audit automation and recall risk mitigation' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL',    payload: { segment: 'MEDTECH', sequence: 2, includeVideo: true } },
  ],
  MI_CRA_PARTNERSHIP: [
    { kind: 'DRAFT_LAUNCH_EMAIL',       payload: { audience: 'GOV', topic: 'Michigan CRA Audit Integrity Shield Proposal' } },
    { kind: 'DRAFT_OUTBOUND_EMAIL',     payload: { segment: 'GOV', sequence: 1, recipient: 'directors@cra.michigan.gov' } },
  ],
  NEWSJACKING_LAUNCH: [
    { kind: 'MONITOR_NEWS_FOR_PR', payload: { topics: ['medical device recall', 'counterfeit pharma', 'luxury forgery'] } },
    { kind: 'DRAFT_PRESS_RELEASE', payload: { newsjacking: true } },
    { kind: 'DRAFT_OUTBOUND_EMAIL', payload: { segment: 'PRESS', sequence: 1 } },
    { kind: 'SCHEDULE_SOCIAL_POSTS', payload: { platforms: ['twitter', 'linkedin'] } },
  ],
};
