import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { FoundersCommand } from "./command-center";

export const dynamic = "force-dynamic";

export default async function FoundersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/founders");
  return <FoundersCommand />;
}
