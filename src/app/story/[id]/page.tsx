import { createClient } from "@/utils/supabase/server";
import { verifyAttestationJws } from "@authichain/verifier";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LaunchStoryMode({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("id,name,brand,description,serial_number,status,metadata")
    .eq("id", id)
    .single();

  if (error || !product) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h1 className="text-2xl font-black">StoryMode object not found</h1>
          <p className="mt-3 text-zinc-500">
            This StoryMode reference does not exist in the AuthiChain registry.
          </p>
        </div>
      </main>
    );
  }

  const metadata = (product.metadata ?? {}) as Record<string, any>;
  const proof = metadata.launchProof as Record<string, any> | undefined;
  const chapters = Array.isArray(metadata.storymode?.chapters)
    ? metadata.storymode.chapters
    : [];

  let cryptographicStatus = "not checked";
  let cryptographicError = "";

  if (proof?.jws && proof?.jwksUrl && proof?.kid) {
    try {
      const jwksResponse = await fetch(proof.jwksUrl, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!jwksResponse.ok) throw new Error(`JWKS HTTP ${jwksResponse.status}`);
      const liveJwks = await jwksResponse.json();
      const publicJwk = liveJwks.keys?.find((key: any) => key.kid === proof.kid);
      if (!publicJwk) throw new Error("proof kid is absent from live JWKS");
      await verifyAttestationJws(proof.jws, publicJwk, {
        expectedObjectId: proof.objectId,
      });
      cryptographicStatus = "verified";
    } catch (cause) {
      cryptographicStatus = "failed";
      cryptographicError =
        cause instanceof Error ? cause.message : String(cause);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[10px] font-black tracking-[0.35em] uppercase text-zinc-500">
            QRON · AuthiChain · StoryMode
          </p>
          <h1 className="text-4xl font-black mt-3">{product.name}</h1>
          <p className="text-zinc-400 mt-3 max-w-2xl">{product.description}</p>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-7 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-black">
                Cryptographic truth layer
              </p>
              <p className="font-mono text-sm mt-2 text-zinc-300">
                {proof?.objectId ?? "unbound"}
              </p>
            </div>
            <span className={`px-3 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
              cryptographicStatus === "verified"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}>
              {cryptographicStatus}
            </span>
          </div>
          {cryptographicError && (
            <p className="text-red-400 text-sm mt-4">{cryptographicError}</p>
          )}
          <div className="grid md:grid-cols-3 gap-4 mt-6 text-xs">
            <Proof label="kid" value={proof?.kid ?? "—"} />
            <Proof label="attestation" value={proof?.attestationId ?? "—"} />
            <Proof label="QRON" value={proof?.qronId ?? "—"} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-7 mb-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-black">
            Product identity
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-5">
            <Proof label="Brand" value={product.brand ?? "AuthiChain"} />
            <Proof label="Serial" value={product.serial_number ?? "—"} />
            <Proof label="Status" value={product.status ?? "—"} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-7">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-black">
            StoryMode provenance
          </p>
          <div className="space-y-6 mt-6">
            {chapters.length === 0 ? (
              <p className="text-zinc-500">No narrative chapters are bound to this object.</p>
            ) : (
              chapters.map((chapter: any, index: number) => (
                <article key={`${chapter.title ?? "chapter"}-${index}`} className="border-l-2 border-zinc-800 pl-5">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 font-black">
                    Chapter {index + 1}
                  </p>
                  <h2 className="text-lg font-black mt-1">{chapter.title}</h2>
                  <p className="text-zinc-400 text-sm leading-7 mt-2">{chapter.content}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="text-center mt-10 text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-300">AuthiChain</Link>
          <span className="mx-2">·</span>
          <a href={proof?.jwksUrl ?? "/.well-known/jwks.json"} className="hover:text-zinc-300">
            Public JWKS
          </a>
        </div>
      </div>
    </main>
  );
}

function Proof({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-black">{label}</p>
      <p className="font-mono text-[11px] text-zinc-300 break-all mt-1">{value}</p>
    </div>
  );
}
