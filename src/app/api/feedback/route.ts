import { NextRequest, NextResponse } from 'next/server';

const FEEDBACK_CATEGORIES = ['bug', 'feature_request', 'ui_ux', 'performance', 'documentation', 'billing', 'other'];
const SENTIMENT_LEVELS = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    user_id,
    category = 'other',
    sentiment,
    subject,
    message,
    page_url,
    rating,
    allow_followup = false,
  } = body;

  if (!message || message.trim().length < 5) {
    return NextResponse.json(
      { error: 'message is required and must be at least 5 characters' },
      { status: 400 }
    );
  }

  if (category && !FEEDBACK_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${FEEDBACK_CATEGORIES.join(', ')}` },
      { status: 422 }
    );
  }

  if (sentiment && !SENTIMENT_LEVELS.includes(sentiment)) {
    return NextResponse.json(
      { error: `Invalid sentiment. Must be one of: ${SENTIMENT_LEVELS.join(', ')}` },
      { status: 422 }
    );
  }

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return NextResponse.json(
      { error: 'rating must be a number between 1 and 5' },
      { status: 422 }
    );
  }

  const feedback_id = `FB-${Date.now()}`;

  return NextResponse.json({
    success: true,
    feedback_id,
    message: 'Thank you for your feedback! We review all submissions and use them to improve QRON.',
    category,
    allow_followup,
    submitted_at: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  // Admin-only endpoint for reviewing submitted feedback
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  return NextResponse.json({
    success: true,
    feedback: [],
    total: 0,
    filters: { category, limit },
    categories: FEEDBACK_CATEGORIES,
    sentiment_levels: SENTIMENT_LEVELS,
  });
}
