import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  const faqs = [
    {
      id: 'faq_001',
      category: 'getting_started',
      question: 'How do I create my first QR code?',
      answer: 'Navigate to the Generate page, enter your URL or content, customize the style, and click Generate. Your QR code will be ready to download instantly.',
      helpful_votes: 312,
      views: 4821
    },
    {
      id: 'faq_002',
      category: 'analytics',
      question: 'How does scan tracking work?',
      answer: 'Every QR code generated on QRON includes automatic scan tracking. We record the timestamp, geographic location, device type, and referrer for each scan. Data is available in your dashboard in real-time.',
      helpful_votes: 198,
      views: 2943
    },
    {
      id: 'faq_003',
      category: 'billing',
      question: 'Can I change my plan at any time?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately, and you will be charged a prorated amount. Downgrades take effect at the start of the next billing cycle.',
      helpful_votes: 145,
      views: 2102
    },
    {
      id: 'faq_004',
      category: 'customization',
      question: 'Can I add my own logo to a QR code?',
      answer: 'Yes! QRON supports logo overlays on QR codes. Upload a PNG or SVG logo in the customization panel. We automatically apply error correction to ensure scannability with your logo embedded.',
      helpful_votes: 289,
      views: 5631
    },
    {
      id: 'faq_005',
      category: 'api',
      question: 'Where can I find my API key?',
      answer: 'Your API key is in Settings > API Keys. You can generate multiple keys, set permissions, and revoke them at any time. The API documentation is available at docs.qron.space.',
      helpful_votes: 176,
      views: 3218
    },
    {
      id: 'faq_006',
      category: 'getting_started',
      question: 'What file formats can I download my QR code in?',
      answer: 'QRON supports PNG (up to 4096px), SVG (vector, infinitely scalable), and PDF export. SVG is recommended for print materials. PNG is best for digital use.',
      helpful_votes: 203,
      views: 3890
    }
  ];

  const filtered = category ? faqs.filter(f => f.category === category) : faqs;
  const sorted = filtered.sort((a, b) => b.helpful_votes - a.helpful_votes);

  return NextResponse.json({
    success: true,
    faqs: sorted,
    total: sorted.length,
    categories: ['getting_started', 'analytics', 'billing', 'customization', 'api', 'integrations', 'security'],
    contact: {
      email: 'support@qron.space',
      docs: 'https://docs.qron.space',
      status: 'https://status.qron.space',
      response_time: 'Within 24 hours'
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, email, subject, message, category, priority = 'normal' } = body;

  if (!email || !subject || !message) {
    return NextResponse.json(
      { error: 'email, subject, and message are required' },
      { status: 400 }
    );
  }

  const ticket_id = 'TKT-' + Date.now();

  return NextResponse.json({
    success: true,
    ticket_id,
    status: 'open',
    priority,
    message: 'Support ticket created. We will respond within 24 hours.',
    estimated_response: priority === 'urgent' ? '2 hours' : priority === 'high' ? '8 hours' : '24 hours'
  }, { status: 201 });
}
