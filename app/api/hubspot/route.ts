export const runtime = 'edge';

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

    // HubSpot CRM API - Create or Update Contact
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname,
          lastname,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to interact with HubSpot" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "HubSpot API route is active" });
}Edge API route active" });
}
