// Notion client for AuthiChain Operations integration.
// Set NOTION_API_KEY (internal integration token) in env. Optional NOTION_DATABASE_ID for default DB.
import { Client } from '@notionhq/client';

const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || '';
let _client: Client | null = null;

export function getNotion(): Client {
  if (_client) return _client;
  if (!TOKEN) {
    throw new Error('[notion] Missing NOTION_API_KEY in environment');
  }
  _client = new Client({ auth: TOKEN });
  return _client;
}

export const NOTION_DEFAULT_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';
