/**
 * API routes for inbound replies dashboard
 * GET: fetch paginated replies with filters
 * PATCH: update reply sentiment/status (sales team only)
 */

import { db } from '@/db';
import { inboundReplies, leads } from '@/db/schema';
// `limit`/`offset` are query-builder methods (used as `.limit()`/`.offset()`
// below), not standalone drizzle-orm exports — don't import them as symbols.
import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/dashboard/replies
 * Fetch paginated inbound replies with optional filters
 * Query params: sentiment, status, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sentiment = searchParams.get('sentiment');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageLimit = Math.min(100, parseInt(searchParams.get('limit') || '20'));

    // Build where clause
    const conditions = [];

    if (sentiment && sentiment !== 'all') {
      conditions.push(eq(inboundReplies.sentiment, sentiment));
    }

    if (status && status !== 'all') {
      conditions.push(eq(inboundReplies.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch paginated results
    const replies = await db
      .select({
        id: inboundReplies.id,
        leadEmail: inboundReplies.leadEmail,
        senderName: inboundReplies.senderName,
        subject: inboundReplies.subject,
        sentiment: inboundReplies.sentiment,
        objectionType: inboundReplies.objectionType,
        matchConfidence: inboundReplies.matchConfidence,
        status: inboundReplies.status,
        createdAt: inboundReplies.createdAt,
        metadata: inboundReplies.metadata,
      })
      .from(inboundReplies)
      .where(whereClause)
      .orderBy(desc(inboundReplies.createdAt))
      .limit(pageLimit)
      .offset((page - 1) * pageLimit);

    return NextResponse.json(
      {
        success: true,
        replies,
        page,
        limit: pageLimit,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching replies:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch replies',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/dashboard/replies
 * Update a reply's status or sentiment (manual override)
 * Body: { id, status?, manualSentiment? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, manualSentiment } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing reply ID' }, { status: 400 });
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    if (manualSentiment) {
      updateData.manualSentiment = manualSentiment;
      updateData.manualOverride = true;
      // Get current user ID (would come from session in real implementation)
      // updateData.overriddenBy = userId;
      updateData.overriddenAt = new Date();
    }

    const result = await db
      .update(inboundReplies)
      .set(updateData)
      .where(eq(inboundReplies.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    // If status changed to "contacted" or sentiment overridden, also update leads table
    if (status === 'contacted' || manualSentiment) {
      const reply = result[0];
      if (reply.leadId) {
        await db
          .update(leads)
          .set({
            sentiment: manualSentiment || reply.sentiment,
            lastContactedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(leads.id, reply.leadId));
      }
    }

    return NextResponse.json(
      {
        success: true,
        reply: result[0],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error updating reply:', error);
    return NextResponse.json(
      {
        error: 'Failed to update reply',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
