export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  // Your server-side logic goes here
  return NextResponse.json({ status: 'ok', message: 'Server edge route active' });
}

export async function POST(_request: NextRequest) {
  // Your server-side logic goes here
  return NextResponse.json({ status: 'ok', message: 'Server edge route active' });
}
