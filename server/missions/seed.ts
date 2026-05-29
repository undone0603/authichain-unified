/**
 * Seed: Mission Orchestration Test Data
 *
 * Inserts one mission of each type plus representative leads.
 * Idempotent: skips mission types that already have a PLANNED mission.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx server/missions/seed.ts
 *   pnpm tsx server/missions/seed.ts        (env loaded from .env automatically by tsx)
 */

import { createMission, getMissions, getDb } from '../db';
import { leads, missionTasks } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import type { MissionType } from './types';

const ALL_TYPES: MissionType[] = [
  'GOV_PILOT',
  'RETAIL_PILOT',
  'PRESS_LAUNCH',
  'PARTNER_ONBOARDING',
  'TECH_OS_LOCK',
  'LAUNCH_AUTHICHAIN',
];

const TEST_LEADS = [
  {
    email: 'procurement@gsa.test.gov',
    name: 'Jordan Mitchell',
    company: 'U.S. General Services Administration',
    title: 'Procurement Officer',
    source: 'seed',
    status: 'new',
    segment: 'GOV',
    notes: 'Manages supply-chain contracts for 40+ agencies.',
  },
  {
    email: 'compliance@cbp.test.gov',
    name: 'Alex Rivera',
    company: 'U.S. Customs & Border Protection',
    title: 'Trade Compliance Director',
    source: 'seed',
    status: 'CONTACTED',
    segment: 'GOV',
    notes: 'Anti-counterfeiting mandate from DHS.',
    nextActionAt: new Date(Date.now() - 86400_000), // overdue — will be picked up by followup agent
  },
  {
    email: 'owner@greenpeak.test',
    name: 'Taylor Green',
    company: 'Green Peak Dispensaries',
    title: 'Owner',
    source: 'seed',
    status: 'new',
    segment: 'RETAIL',
    notes: 'Chain of 12 dispensaries, interested in track-and-trace.',
  },
  {
    email: 'ops@purityleaf.test',
    name: 'Morgan Lee',
    company: 'Purity Leaf Co.',
    title: 'Operations Manager',
    source: 'seed',
    status: 'CONTACTED',
    segment: 'RETAIL',
    notes: 'Evaluating authentication vendors for Q3 rollout.',
    nextActionAt: new Date(Date.now() - 2 * 86400_000),
  },
  {
    email: 'reporter@techblockchain.test',
    name: 'Sam Park',
    company: 'TechBlockchain Weekly',
    title: 'Senior Reporter',
    source: 'seed',
    status: 'new',
    segment: 'PRESS' as any,
    notes: 'Covers blockchain product launches.',
  },
];

async function seedLeads(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  let inserted = 0;
  for (const lead of TEST_LEADS) {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.email, lead.email))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(leads).values({
        ...lead,
        nextActionAt: (lead as any).nextActionAt ?? null,
      });
      inserted++;
    }
  }
  return inserted;
}

async function seedMissions(): Promise<Map<MissionType, string>> {
  const existing = await getMissions();
  const existingTypes = new Set(existing.map(m => m.type as MissionType));

  const created = new Map<MissionType, string>();
  for (const type of ALL_TYPES) {
    if (existingTypes.has(type)) {
      const m = existing.find(m => m.type === type)!;
      console.log(`  skip ${type} — already exists (${m.id})`);
      created.set(type, m.id);
    } else {
      const id = await createMission(type);
      console.log(`  created ${type} → ${id}`);
      created.set(type, id);
    }
  }
  return created;
}

async function seedFailedTask(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  missionId: string,
) {
  // Mark the last task of the mission as FAILED for retry testing
  const tasks = await db
    .select()
    .from(missionTasks)
    .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, 'PENDING')))
    .limit(1);

  if (tasks[0]) {
    await db
      .update(missionTasks)
      .set({ status: 'FAILED', error: 'seeded failure for test', updatedAt: new Date() })
      .where(eq(missionTasks.id, tasks[0].id));
    return tasks[0].id;
  }
  return null;
}

async function main() {
  console.log('🌱 Seeding mission orchestration test data…\n');

  const db = await getDb();
  if (!db) {
    console.error('No DATABASE_URL — cannot seed. Set DATABASE_URL env var.');
    process.exit(1);
  }

  console.log('Leads:');
  const leadsInserted = await seedLeads(db);
  console.log(`  inserted ${leadsInserted}/${TEST_LEADS.length} (rest already existed)\n`);

  console.log('Missions:');
  const missions = await seedMissions();

  // Add a FAILED task in GOV_PILOT mission for retry tests
  const govId = missions.get('GOV_PILOT')!;
  const failedTaskId = await seedFailedTask(db, govId);
  if (failedTaskId) {
    console.log(`\nFailed task for retry test: ${failedTaskId} (mission: ${govId})`);
  }

  console.log('\n✅ Seed complete.');
  console.log('\nSummary:');
  for (const [type, id] of missions) {
    console.log(`  ${type.padEnd(22)} ${id}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
