export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { GilmoreArtRequest } from '@/lib/industrial/gilmore-pipeline';

// Heavy deps (gilmore pipeline, supabase server client) are imported lazily inside
// the handler so the Cloudflare Workers build can collect this route without
// evaluating the incompatible graph at build time.

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    await supabase.auth.getSession();

    // In a real scenario, we might want to restrict this to Theater 3/Enterprise users
    // For the demo, we'll allow authenticated users.

    const body: GilmoreArtRequest = await request.json();
    const { carModel, year, destinationUrl } = body;

    if (!carModel || !year || !destinationUrl) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const { generateGilmoreArt } = await import('@/lib/industrial/gilmore-pipeline');
    const result = await generateGilmoreArt(body);

    return NextResponse.json({
      success: true,
      qron: result
    });

  } catch (error: any) {
    console.error('Gilmore Pipeline Error:', error);
    return NextResponse.json({
      message: error.message || 'Error generating automotive art'
    }, { status: 500 });
  }
}
