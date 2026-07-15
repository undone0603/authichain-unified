import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    endpoint: '/api/templates',
    templates: [
      { id: 'tpl_001', name: 'Classic Square', style: 'classic', colors: ['#000000', '#FFFFFF'], preview_url: 'https://qron.space/templates/classic' },
      { id: 'tpl_002', name: 'Rounded Modern', style: 'rounded', colors: ['#1a1a2e', '#e94560'], preview_url: 'https://qron.space/templates/rounded' },
      { id: 'tpl_003', name: 'AI Art Style', style: 'ai_art', colors: ['#6c63ff', '#3f3d56'], preview_url: 'https://qron.space/templates/ai_art' },
      { id: 'tpl_004', name: 'Corporate Blue', style: 'corporate', colors: ['#003087', '#FFFFFF'], preview_url: 'https://qron.space/templates/corporate' },
      { id: 'tpl_005', name: 'Gradient Neon', style: 'gradient', colors: ['#ff006e', '#8338ec', '#3a86ff'], preview_url: 'https://qron.space/templates/gradient' },
    ],
    total: 5,
    categories: ['classic', 'modern', 'ai_art', 'corporate', 'gradient'],
    protocol: 'QRON',
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    success: true,
    endpoint: '/api/templates',
    template: {
      id: `tpl_${Date.now()}`,
      name: body.name || 'Custom Template',
      style: body.style || 'custom',
      colors: body.colors || ['#000000', '#FFFFFF'],
      created_at: new Date().toISOString(),
    },
    message: 'Template created successfully',
    protocol: 'QRON',
  });
}
