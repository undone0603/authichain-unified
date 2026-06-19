import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch all compliance tracking records from missions table
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('type', 'compliance_record')
      .order('updatedAt', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // Transform database records to API format
    const records = (data || []).map((record: any) => {
      const metadata = (record.metadata || {}) as Record<string, any>;
      return {
        id: record.id,
        cultivatorName: metadata.businessName || 'Unknown',
        state: metadata.state || 'Unknown',
        licenseNumber: metadata.licenseNumber || 'N/A',
        licenseType: metadata.licenseType || 'cultivator' as 'cultivator' | 'processor' | 'retailer' | 'microbusiness',
        status: metadata.licenseStatus || 'active' as 'active' | 'pending' | 'suspended' | 'expired',
        metrcStatus: metadata.metrcStatus || 'not_connected' as 'connected' | 'syncing' | 'error' | 'not_connected',
        seedToSaleProgress: metadata.seedToSaleProgress || 0,
        complianceScore: metadata.complianceScore || 75,
        lastAudit: metadata.lastAudit || undefined,
        nextAuditDue: metadata.nextAuditDue || undefined,
        trackedProducts: metadata.trackedProducts || 0,
        seedLineages: metadata.seedLineages || 0,
        tags: metadata.tags || [],
        source: metadata.source || 'StrainChain',
        updatedAt: record.updatedAt,
      };
    });

    // Cache for 2 minutes
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120',
    };

    return Response.json(
      {
        records,
        count: records.length,
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to fetch compliance records:', error);
    return Response.json(
      { error: 'Failed to fetch compliance records', details: String(error) },
      { status: 500 }
    );
  }
}
