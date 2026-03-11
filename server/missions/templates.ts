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
};

export const taskTemplates: Record<MissionType, TaskTemplate[]> = {
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
    { kind: 'GENERATE_LAUNCH_CHECKLIST', payload: { scope: 'full_launch' } },
    { kind: 'DRAFT_LAUNCH_EMAIL',       payload: { audience: 'founders' } },
    { kind: 'DRAFT_PRESS_RELEASE',      payload: {} },
    { kind: 'SCHEDULE_SOCIAL_POSTS',    payload: { platforms: ['twitter', 'linkedin'] } },
  ],
};
