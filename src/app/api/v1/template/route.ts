import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/template - List QR code design templates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const category = searchParams.get('category');
  const is_public = searchParams.get('is_public');

  const templates = [
    {
      id: 'tpl_001',
      user_id: null,
      name: 'Classic Dark',
      description: 'Clean black QR code on white background',
      category: 'basic',
      is_public: true,
      is_premium: false,
      preview_url: 'https://assets.qron.space/templates/classic-dark.png',
      config: {
        foreground_color: '#000000',
        background_color: '#ffffff',
        error_correction: 'M',
        size: 300,
        margin: 4,
        style: 'square',
        logo_enabled: false
      },
      tags: ['minimal', 'classic', 'business'],
      usage_count: 18420
    },
    {
      id: 'tpl_002',
      user_id: null,
      name: 'Brand Blue',
      description: 'Modern blue gradient QR code with rounded corners',
      category: 'branded',
      is_public: true,
      is_premium: false,
      preview_url: 'https://assets.qron.space/templates/brand-blue.png',
      config: {
        foreground_color: '#1a56db',
        background_color: '#ffffff',
        error_correction: 'H',
        size: 400,
        margin: 4,
        style: 'rounded',
        logo_enabled: true,
        logo_size: 80
      },
      tags: ['branded', 'modern', 'blue'],
      usage_count: 9230
    },
    {
      id: 'tpl_003',
      user_id: null,
      name: 'AI Art: Neon Cyber',
      description: 'AI-generated cyberpunk neon aesthetic QR code',
      category: 'ai-art',
      is_public: true,
      is_premium: true,
      preview_url: 'https://assets.qron.space/templates/neon-cyber.png',
      config: {
        foreground_color: '#00ff88',
        background_color: '#0a0a2e',
        error_correction: 'H',
        size: 500,
        margin: 2,
        style: 'dots',
        ai_style: 'cyberpunk',
        ai_prompt: 'neon cyberpunk city grid aesthetic',
        logo_enabled: false
      },
      tags: ['ai-art', 'cyberpunk', 'neon', 'premium'],
      usage_count: 4120
    },
    {
      id: 'tpl_004',
      user_id: 'usr_001',
      name: 'My Brand Template',
      description: 'Custom branded template with company colors',
      category: 'custom',
      is_public: false,
      is_premium: false,
      preview_url: 'https://assets.qron.space/templates/usr001-brand.png',
      config: {
        foreground_color: '#ff6b35',
        background_color: '#ffffff',
        error_correction: 'H',
        size: 400,
        margin: 4,
        style: 'rounded',
        logo_enabled: true,
        logo_url: 'https://cdn.example.com/logo.png',
        logo_size: 60
      },
      tags: ['custom', 'branded'],
      usage_count: 250
    }
  ];

  let filtered = templates;
  if (user_id) filtered = filtered.filter(t => t.user_id === user_id || t.is_public);
  if (category) filtered = filtered.filter(t => t.category === category);
  if (is_public !== null && is_public !== undefined) {
    filtered = filtered.filter(t => t.is_public === (is_public === 'true'));
  }

  return NextResponse.json({
    success: true,
    templates: filtered,
    total: filtered.length,
    categories: ['basic', 'branded', 'ai-art', 'custom', 'seasonal', 'industry'],
    generated_at: new Date().toISOString()
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
