import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { temperature, humidity, metrcTag } = body;

    // CRA Compliance Thresholds for Demo
    const isBreach = temperature > 75 || humidity > 60;

    if (isBreach) {
      // Simulate an autonomous blockchain anchor for the breach
      return NextResponse.json({
        compliant: false,
        message: 'COMPLIANCE BREACH DETECTED',
        blockchainTx: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
        timestamp: new Date().toISOString(),
        details: {
          tag: metrcTag,
          breachType: temperature > 75 ? 'Temperature' : 'Humidity',
          value: temperature > 75 ? `${temperature}°F` : `${humidity}%`
        }
      });
    }

    return NextResponse.json({
      compliant: true,
      message: 'CRA COMPLIANT',
      timestamp: new Date().toISOString(),
      details: {
        tag: metrcTag
      }
    });
  } catch (error) {
    console.error('Telemetry API Error:', error);
    return NextResponse.json({ message: 'Error processing telemetry' }, { status: 500 });
  }
}
