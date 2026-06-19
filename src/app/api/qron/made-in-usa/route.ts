import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(_request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch all Made in USA products from missions table
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('type', 'made_in_usa_product')
      .order('createdAt', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // Transform database records to API format
    const products = (data || []).map((record: any) => {
      const metadata = (record.metadata || {}) as Record<string, any>;
      return {
        id: record.id,
        companyName: metadata.companyName || 'Unknown Manufacturer',
        productCategory: metadata.productCategory || 'General',
        productName: record.title || 'Unnamed Product',
        state: metadata.state || 'USA',
        verified: metadata.verified || false,
        scans: metadata.scans || 0,
        productsTracked: metadata.productsTracked || 0,
        qronCodeUrl: metadata.qronCodeUrl || '',
        certificationDate: metadata.certificationDate || new Date().toISOString(),
        tags: metadata.tags || [],
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
        products,
        count: products.length,
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return Response.json(
      { error: 'Failed to fetch products', details: String(error) },
      { status: 500 }
    );
  }
}
