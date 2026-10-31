/** HubSpot returns 409 when that email is already a contact. No second write. */
export function existingHubSpotContactId(message: string): string | null {
  if (!/409|already exists|CONFLICT/i.test(message)) return null;
  const match = message.match(/Existing ID:\s*(\d+)/);
  return match?.[1] ?? null;
}
