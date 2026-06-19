import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch all QRON artwork records from missions table
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('type', 'qron_artwork')
      .order('createdAt', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // Transform database records to API format
    const artworks = (data || []).map((record: any) => {
      const metadata = (record.metadata || {}) as Record<string, any>;
      return {
        id: record.id,
        title: metadata.title || record.title || 'Untitled',
        artist: metadata.artist || 'Anonymous',
        style: metadata.style || 'abstract' as 'abstract' | 'geometric' | 'organic' | 'retro' | 'neon' | 'minimalist',
        category: metadata.category || 'custom' as 'marketing' | 'product' | 'brand' | 'social' | 'custom',
        imageUrl: metadata.imageUrl || undefined,
        scans: metadata.scans || 0,
        shares: metadata.shares || 0,
        views: metadata.views || 0,
        avgEngagementTime: metadata.avgEngagementTime || 0,
        scanLocations: metadata.scanLocations || [],
        createdAt: record.createdAt,
        featured: metadata.featured || false,
        creator: metadata.creator || 'QRON Studio',
        tags: metadata.tags || [],
      };
    });

    // Cache for 30 seconds (artwork is dynamic with scan counts)
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    };

    return Response.json(
      {
        artworks,
        count: artworks.length,
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to fetch artworks:', error);
    return Response.json(
      { error: 'Failed to fetch artworks', details: String(error) },
      { status: 500 }
    );
  }
}
