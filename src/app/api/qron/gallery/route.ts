import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type GalleryStyle = 'abstract' | 'geometric' | 'organic' | 'retro' | 'neon' | 'minimalist';
type GalleryCategory = 'marketing' | 'product' | 'brand' | 'social' | 'custom';

interface MissionRecord {
  id: string;
  title?: string | null;
  createdAt: string;
  metadata?: GalleryMetadata | null;
}

interface GalleryMetadata {
  title?: string;
  artist?: string;
  style?: GalleryStyle;
  category?: GalleryCategory;
  imageUrl?: string;
  scans?: number;
  shares?: number;
  views?: number;
  avgEngagementTime?: number;
  scanLocations?: string[];
  featured?: boolean;
  creator?: string;
  tags?: string[];
}

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
    const artworks = ((data || []) as MissionRecord[]).map((record) => {
      const metadata = record.metadata || {};
      return {
        id: record.id,
        title: metadata.title || record.title || 'Untitled',
        artist: metadata.artist || 'Anonymous',
        style: metadata.style || 'abstract' as GalleryStyle,
        category: metadata.category || 'custom' as GalleryCategory,
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
