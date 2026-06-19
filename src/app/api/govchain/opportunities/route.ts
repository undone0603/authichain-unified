import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch all government opportunities from missions table
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('type', 'gov_opportunity')
      .order('createdAt', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // Transform database records to API format
    const opportunities = (data || []).map((record: any) => {
      const metadata = (record.metadata || {}) as Record<string, any>;
      return {
        id: record.id,
        title: record.title,
        agency: metadata.agency || 'Unknown Agency',
        level: metadata.level || 'federal' as 'federal' | 'state' | 'local',
        type: metadata.opportunityType || 'contract' as 'rfp' | 'grant' | 'contract' | 'loan' | 'initiative',
        fundingAmount: metadata.fundingAmount ? parseInt(metadata.fundingAmount) : undefined,
        deadline: metadata.deadline || undefined,
        description: record.description || '',
        tags: metadata.tags || [],
        status: metadata.status || record.status as 'active' | 'closing_soon' | 'closed' | 'published',
        samNoticeId: metadata.samNoticeId || undefined,
        cfda: metadata.cfda || undefined,
        source: metadata.source || 'SAM.gov',
        createdAt: record.createdAt,
      };
    });

    // Cache for 1 minute
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    };

    return Response.json(
      {
        opportunities,
        count: opportunities.length,
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
    return Response.json(
      { error: 'Failed to fetch opportunities', details: String(error) },
      { status: 500 }
    );
  }
}
