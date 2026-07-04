// Alias route: /api/lead-capture → shares the exact handler used by
// /api/leads/capture (Supabase insert + HubSpot/Make/email automation).
// Kept so landing-page capture widgets can POST to the canonical
// /api/lead-capture path without duplicating logic.
export { POST, dynamic } from '../leads/capture/route';
