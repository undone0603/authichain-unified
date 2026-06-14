export type AppRole = "admin" | "user";

/** Returns "admin" if email is in the comma-separated owner allowlist (case-insensitive), else "user". */
export function resolveRole(email: string, ownerEmailsCsv: string): AppRole {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return "user";
  const owners = (ownerEmailsCsv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(normalized) ? "admin" : "user";
}
