import { NextResponse } from 'next/server';
import { db } from '@/db';
import { telemetryEvents } from '@/db/schema';
import crypto from 'crypto';
import { anchorToPolygon } from '@/actions/anchor';

// Michigan CRA Transport Compliance Bounds (Adjustable for Enterprise)
const MAX_TEMP_F = 75;
const MAX_HUMIDITY = 60;

type GpsLocation = {
  latitude: number;
  longitude: number;
  accuracyM?: number;
};

type TelemetryInput = {
  metrcTag: string;
  temperatureF: number;
  humidityPct: number;
  gpsLocation?: GpsLocation;
  recordedAt?: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateGpsLocation(value: unknown): GpsLocation | null {
  if (!value || typeof value !== 'object') return null;

  const { latitude, longitude, accuracyM } = value as Record<string, unknown>;

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) return null;
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) return null;
  if (accuracyM !== undefined && (!isFiniteNumber(accuracyM) || accuracyM < 0)) return null;

  return {
    latitude,
    longitude,
    ...(accuracyM !== undefined ? { accuracyM } : {}),
  };
}

function parseTelemetryInput(data: unknown): TelemetryInput {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid payload: expected JSON object');
  }

  const body = data as Record<string, unknown>;
  const metrcTag = body.metrcTag;
  const temperatureF = body.temperatureF;
  const humidityPct = body.humidityPct;
  const gpsLocation = validateGpsLocation(body.gpsLocation);
  const recordedAt = body.recordedAt;

  if (typeof metrcTag !== 'string' || metrcTag.trim().length < 3 || metrcTag.trim().length > 128) {
    throw new Error('Invalid metrcTag');
  }

  if (!isFiniteNumber(temperatureF) || temperatureF < -40 || temperatureF > 200) {
    throw new Error('Invalid temperatureF');
  }

  if (!isFiniteNumber(humidityPct) || humidityPct < 0 || humidityPct > 100) {
    throw new Error('Invalid humidityPct');
  }

  if (recordedAt !== undefined) {
    if (typeof recordedAt !== 'string' || Number.isNaN(Date.parse(recordedAt))) {
      throw new Error('Invalid recordedAt');
    }
  }

  return {
    metrcTag: metrcTag.trim(),
    temperatureF,
    humidityPct,
    ...(gpsLocation ? { gpsLocation } : {}),
    ...(recordedAt ? { recordedAt } : {}),
  };
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const data = parseTelemetryInput(raw);

    const isCompliant =
      data.temperatureF <= MAX_TEMP_F && data.humidityPct <= MAX_HUMIDITY;

    const payloadString = JSON.stringify(data);
    const eventHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    const [insertedEvent] = await db
      .insert(telemetryEvents)
      .values({
        source: 'strainchain-iot',
        metrcTag: data.metrcTag,
        payload: {
          metrcTag: data.metrcTag,
          temperatureF: data.temperatureF,
          humidityPct: data.humidityPct,
          gpsLocation: data.gpsLocation ?? null,
          recordedAt: data.recordedAt ?? new Date().toISOString(),
        },
        gpsLocation: data.gpsLocation ?? null,
        ledgerHash: `0x${eventHash}`,
        isCompliant,
      })
      .returning();

    let txHash: string | null = null;

    if (!isCompliant) {
      console.log(
        `🚨 COMPLIANCE BREACH DETECTED: ${data.metrcTag}. Initiating Web3 Anchor...`
      );

      const anchorResult = await anchorToPolygon(
        data.metrcTag,
        `0x${eventHash}`,
        insertedEvent.id
      );

      if (anchorResult.success) {
        txHash = anchorResult.txHash;
      }
    }

    return NextResponse.json(
      {
        status: 'TELEMETRY_LOGGED',
        compliant: isCompliant,
        hash: eventHash,
        blockchainTx: txHash || 'Not Anchored (Compliant)',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Telemetry ingest failed:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process physical data.',
      },
      { status: 400 }
    );
  }
}
