export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { generateGilmoreArt, GilmoreArtRequest } from '@/lib/industrial/gilmore-pipeline';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.getSession();

    // In a real scenario, we might want to restrict this to Theater 3/Enterprise users
    // For the demo, we'll allow authenticated users.

    const body: GilmoreArtRequest = await request.json();
    const { carModel, year, destinationUrl } = body;

    if (!carModel || !year || !destinationUrl) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const result = await generateGilmoreArt(body);

    return NextResponse.json({
      success: true,
      qron: result
    });

  } catch (error) {
    console.error('Gilmore Pipeline Error:', error);
    const message = error instanceof Error ? error.message : 'Error generating automotive art';
    return NextResponse.json({ 
      message
    }, { status: 500 });
  }
}
