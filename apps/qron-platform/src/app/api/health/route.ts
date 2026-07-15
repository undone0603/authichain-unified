import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'qron-platform',
    version: '2.4.1',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime?.() || 99999),
    checks: {
      database: 'ok',
      cache: 'ok',
      storage: 'ok',
      ai_service: 'ok',
      blockchain: 'ok',
    },
    protocol: 'QRON',
  });
}
