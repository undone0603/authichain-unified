import { redirect } from "next/navigation";
import { resolverBase } from "@/lib/passport";

export const dynamic = "force-dynamic";

/** Same-origin GS1 path: authichain.com/01/{gtin}/21/{serial} */
export default async function Gs1CatchAll({
  params,
  searchParams,
}: {
  params: Promise<{ gs1: string[] }> | { gs1: string[] };
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const p = "then" in params ? await params : params;
  const q = "then" in searchParams ? await searchParams : searchParams;
  const path = `/01/${p.gs1.map(encodeURIComponent).join("/")}`;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(q || {})) {
    if (typeof v === "string") query.set(k, v);
  }
  const qs = query.toString();
  redirect(`${resolverBase()}${path}${qs ? `?${qs}` : ""}`);
}
