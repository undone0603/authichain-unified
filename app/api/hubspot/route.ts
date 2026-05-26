import { NextResponse } from "next/server"
import { Client } from "@hubspot/api-client"

export async function GET() {
  const token = process.env.HUBSPOT_SERVICE_KEY
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_SERVICE_KEY missing" },
      { status: 500 }
    )
  }

  const client = new Client({ accessToken: token })

  try {export const runtime = 'edge';
export const runtime = 'edge';

import { NextResponse } from "next/server"
import { Client } from "@hubspot/api-client"

export async function GET() {
  const token = process.env.HUBSPOT_SERVICE_KEY
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_SERVICE_KEY missing" },
      { status: 500 }
    )
  }

  const client = new Client({ accessToken: token })

  try {
    const result = await client.crm.contacts.basicApi.getPage()
    return NextResponse.json({ contacts: result.results })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "HubSpot API error" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { Client } from "@hubspot/api-client"

export async function GET() {
  const token = process.env.HUBSPOT_SERVICE_KEY
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_SERVICE_KEY missing" },
      { status: 500 }
    )
  }

  const client = new Client({ accessToken: token })

  try {
    const result = await client.crm.contacts.basicApi.getPage()
    return NextResponse.json({ contacts: result.results })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "HubSpot API error" },
      { status: 500 }
    )
  }
}

    const result = await client.crm.contacts.basicApi.getPage()
    return NextResponse.json({ contacts: result.results })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "HubSpot API error" },
      { status: 500 }
    )
  }
}
