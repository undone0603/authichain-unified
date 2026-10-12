import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { partnerSignups } from '@/lib/db/schema';
import { crypto } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { partnerName, contactEmail } = body;

    if (!partnerName || !contactEmail) {
      return NextResponse.json({ error: 'Partner name and contact email are required' }, { status: 400 });
    }

    const signupId = crypto.randomUUID();
    await db.insert(partnerSignups).values({
      id: signupId,
      partnerName,
      contactEmail,
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Signup received.', id: signupId }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'An application with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to process partner signup' }, { status: 500 });
  }
}
