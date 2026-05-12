import { NextResponse } from 'next/server';
import { generateGilmoreArt, GilmoreArtRequest } from '@/lib/industrial/gilmore-pipeline';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

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

  } catch (error: any) {
    console.error('Gilmore Pipeline Error:', error);
    return NextResponse.json({ 
      message: error.message || 'Error generating automotive art' 
    }, { status: 500 });
  }
}
