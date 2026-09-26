import { NextResponse } from 'next/server';

/**
 * Closed. The previous handler returned fixture webhooks (example.com URLs,
 * invented success counts, and a generated secret) and accepted an
 * unauthenticated POST. It was not a registry.
 */
function closed() {
  return NextResponse.json(
    {
      error:
        'Closed. This route served fixture data and is not a webhook registry.',
    },
    { status: 410 },
  );
}

export function GET() {
  return closed();
}

export function POST() {
  return closed();
}
