import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const is_default = searchParams.get('is_default');

  const styles = [
    {
      id: 'style_classic',
      name: 'Classic',
      category: 'minimal',
      description: 'Traditional black and white QR code with standard square modules.',
      is_default: true,
      is_premium: false,
      preview_url: '/styles/previews/classic.png',
      config: {
        dot_style: 'square',
        corner_square_style: 'square',
        corner_dot_style: 'square',
        foreground_color: '#000000',
        background_color: '#FFFFFF',
        logo: null,
        error_correction: 'M'
      }
    },
    {
      id: 'style_rounded',
      name: 'Rounded',
      category: 'modern',
      description: 'Sleek QR code with rounded dots and smooth corners.',
      is_default: false,
      is_premium: false,
      preview_url: '/styles/previews/rounded.png',
      config: {
        dot_style: 'rounded',
        corner_square_style: 'extra-rounded',
        corner_dot_style: 'dot',
        foreground_color: '#000000',
        background_color: '#FFFFFF',
        logo: null,
        error_correction: 'M'
      }
    },
    {
      id: 'style_dots',
      name: 'Dots',
      category: 'modern',
      description: 'Circular dot pattern for a contemporary look.',
      is_default: false,
      is_premium: false,
      preview_url: '/styles/previews/dots.png',
      config: {
        dot_style: 'dots',
        corner_square_style: 'dot',
        corner_dot_style: 'dot',
        foreground_color: '#000000',
        background_color: '#FFFFFF',
        logo: null,
        error_correction: 'M'
      }
    },
    {
      id: 'style_gradient_blue',
      name: 'Ocean Gradient',
      category: 'gradient',
      description: 'Stunning blue gradient QR code ideal for tech brands.',
      is_default: false,
      is_premium: true,
      preview_url: '/styles/previews/gradient-blue.png',
      config: {
        dot_style: 'rounded',
        corner_square_style: 'extra-rounded',
        corner_dot_style: 'dot',
        gradient: { type: 'linear', rotation: 45, colorStops: [{ offset: 0, color: '#0052D4' }, { offset: 1, color: '#4364F7' }] },
        background_color: '#FFFFFF',
        logo: null,
        error_correction: 'H'
      }
    },
    {
      id: 'style_logo_center',
      name: 'Logo Center',
      category: 'branded',
      description: 'QR code with centered logo placement for brand recognition.',
      is_default: false,
      is_premium: true,
      preview_url: '/styles/previews/logo-center.png',
      config: {
        dot_style: 'rounded',
        corner_square_style: 'square',
        corner_dot_style: 'square',
        foreground_color: '#000000',
        background_color: '#FFFFFF',
        logo: { url: null, size: 0.3, hideBackgroundDots: true, imageSize: 0.4, margin: 0 },
        error_correction: 'H'
      }
    },
    {
      id: 'style_ai_art',
      name: 'AI Artistic',
      category: 'ai_generated',
      description: 'AI-generated artistic QR code with unique visual style. Requires QRON Pro.',
      is_default: false,
      is_premium: true,
      preview_url: '/styles/previews/ai-art.png',
      config: {
        ai_style: true,
        ai_prompt: null,
        error_correction: 'H',
        base_style: 'dots'
      }
    }
  ];

  let filtered = styles;
  if (category) filtered = filtered.filter(s => s.category === category);
  if (is_default !== null && is_default !== undefined) filtered = filtered.filter(s => s.is_default === (is_default === 'true'));

  const categories = [...new Set(styles.map(s => s.category))];

  return NextResponse.json({
    success: true,
    styles: filtered,
    total: filtered.length,
    categories,
    dot_styles: ['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'],
    corner_styles: ['square', 'dot', 'extra-rounded'],
    generated_at: new Date().toISOString()
  });
}
