export const runtime = 'nodejs';

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const token = process.env.HUBSPOT_SERVICE_KEY;
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_SERVICE_KEY missing" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, firstname, lastname } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        properties: { email, firstname, lastname }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 409) {
        return NextResponse.json({ message: "Contact already exists", data });
      }
      return NextResponse.json({ error: data.message || "HubSpot API error" }, { status: response.status });
    }

    return NextResponse.json({ message: "Contact created successfully", data });
  } catch (error) {
    console.error('HubSpot Route Error:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
