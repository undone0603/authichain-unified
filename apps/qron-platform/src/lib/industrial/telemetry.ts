import { createHash } from 'crypto';

/**
 * THEATER 1: Metrc (StrainChain)
 * specialized for Cannabis supply chain telemetry.
 */
export interface MetrcPayload {
  rfid_tag: string;
  batch_id: string;
  strain_name: string;
  environmental_data: {
    temp_c: number;
    humidity_pct: number;
    uv_index: number;
  };
  event_type: 'harvest' | 'transfer' | 'testing_passed' | 'quarantine';
}

/**
 * THEATER 3: BMW (AuthiChain)
 * specialized for Automotive Battery provenance.
 */
export interface BMWBatteryPayload {
  battery_id: string;
  vehicle_vin?: string;
  capacity_ah: number;
  cycle_count: number;
  health_pct: number;
  quarantine_status: boolean;
  edge_signature: string; // Ed25519 signature from the factory edge node
}

export type IndustrialTheater = 'theater_1' | 'theater_3';

/**
 * Parses raw Metrc payload into a structured state.
 */
export function parseMetrcTelemetry(raw: Partial<MetrcPayload>): Record<string, unknown> {
  // Extract core fields, providing defaults for robustness
  return {
    theater: 'theater_1',
    identity: raw.rfid_tag || 'unknown_rfid',
    batch: raw.batch_id || 'unknown_batch',
    metadata: {
      strain: raw.strain_name,
      metrics: raw.environmental_data,
      event: raw.event_type
    },
    is_safe: raw.event_type !== 'quarantine'
  };
}

/**
 * Parses raw BMW Battery payload into a structured state.
 */
export function parseBMWTelemetry(raw: Partial<BMWBatteryPayload>): Record<string, unknown> {
  return {
    theater: 'theater_3',
    identity: raw.battery_id || 'unknown_battery',
    vin: raw.vehicle_vin,
    metrics: {
      health: raw.health_pct,
      cycles: raw.cycle_count,
      capacity: raw.capacity_ah
    },
    is_safe: !raw.quarantine_status,
    edge_verified: !!raw.edge_signature
  };
}

/**
 * Generates a deterministic State Hash for industrial anchoring.
 * Used for Phase 2: Blockchain Transition.
 */
export function generateStateHash(state: Record<string, unknown>): string {
  // Sort keys to ensure deterministic hashing
  const sortedState = Object.keys(state)
    .sort()
    .reduce((acc: Record<string, unknown>, key) => {
      acc[key] = state[key];
      return acc;
    }, {});

  const data = JSON.stringify(sortedState);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Unified Ingestor for Industrial Telemetry.
 */
export async function processIndustrialEvent(theater: IndustrialTheater, payload: MetrcPayload | BMWBatteryPayload) {
  let parsedState: Record<string, unknown>;

  if (theater === 'theater_1') {
    parsedState = parseMetrcTelemetry(payload as MetrcPayload);
  } else if (theater === 'theater_3') {
    parsedState = parseBMWTelemetry(payload as BMWBatteryPayload);
  } else {
    throw new Error(`Unsupported theater: ${theater}`);
  }

  const stateHash = generateStateHash(parsedState);

  return {
    parsedState,
    stateHash,
    timestamp: new Date().toISOString()
  };
}
