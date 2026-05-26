export const runtime = 'edge';

import { NextResponse } from "next/server";
import { Client } from "@hubspot/api-client";

export async function GET() {
  const token = process.env.HUBSPOT_SERVICE_KEY;
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_SERVICE_KEY missing" },
      { status: 500 }
    );
  }

  const client = new Client({ accessToken: token });

  try {
    return NextResponse.json({ message: "HubSpot API route active" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initialize HubSpot client" },
      { status: 500 }
    );
  }
}
