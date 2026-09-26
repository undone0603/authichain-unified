// Airtable client for AuthiChain Operations base.
// Defaults target the Operations base / Startup Ops Checklist table.
// @ts-ignore - package installed separately
import Airtable from "airtable";

const API_KEY = process.env.AIRTABLE_API_KEY || "";
export const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "app4lw5wNMNmzTNMn";
export const AIRTABLE_TABLE_ID =
  process.env.AIRTABLE_TABLE_ID || "tblJKef2D5SpIgEpT";
/** Operations Accounts — not a send list. */
export const AIRTABLE_ACCOUNTS_TABLE_ID =
  process.env.AIRTABLE_ACCOUNTS_TABLE_ID || "tbldnt00sBS19wxni";
/** Operations Contacts — named humans only. */
export const AIRTABLE_CONTACTS_TABLE_ID =
  process.env.AIRTABLE_CONTACTS_TABLE_ID || "tblzqajBTmfn2iHv9";

let _base: ReturnType<Airtable["base"]> | null = null;

export function getAirtableBase() {
  if (_base) return _base;
  if (!API_KEY) {
    throw new Error("[airtable] Missing AIRTABLE_API_KEY in environment");
  }
  const at = new Airtable({ apiKey: API_KEY });
  _base = at.base(AIRTABLE_BASE_ID);
  return _base;
}

export function getOpsChecklistTable() {
  return getAirtableBase()(AIRTABLE_TABLE_ID);
}
