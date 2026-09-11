/**
 * GET /api/genetics/verify?farm=&cultivar=[&digest=]
 *
 * Makes the record fingerprint checkable by someone who does not trust us.
 *
 * The dossier page prints a digest, but a printed digest is an assertion. This
 * returns the exact canonical bytes it was computed from, so a licensee, a
 * buyer or an automated integration can rehash independently and compare
 * rather than take our word. Pass `digest` and it reports whether the supplied
 * value matches — useful for a contract or a due-diligence script pinning the
 * record it reviewed.
 *
 * Follows the claims contract the rest of the estate uses (see
 * src/app/api/dpp/verify): every response ships what the result proves and
 * what it does not, so a match cannot be over-read.
 */
import { NextRequest, NextResponse } from "next/server";
import { fingerprintCultivar } from "@/lib/fingerprint";
import { getCultivar, getDossier, toSlug } from "@/lib/genetics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const farm = (q.get("farm") || "").trim();
  const cultivar = (q.get("cultivar") || "").trim();
  const supplied = (q.get("digest") || "").trim();

  if (!farm || !cultivar) {
    return NextResponse.json(
      {
        ok: false,
        error: "farm and cultivar are required",
        usage:
          "/api/genetics/verify?farm=mendo-love-farms&cultivar=vt-26[&digest=sha256:...]",
      },
      { status: 400 }
    );
  }

  const dossier = getDossier(farm);
  if (!dossier) {
    return NextResponse.json(
      { ok: false, error: "unknown_farm", farm },
      { status: 404 }
    );
  }

  // Accept either the slug or the cultivar id as written on the certificates.
  const view =
    getCultivar(farm, cultivar) ?? getCultivar(farm, toSlug(cultivar));
  if (!view) {
    return NextResponse.json(
      {
        ok: false,
        error: "unknown_cultivar",
        farm,
        cultivar,
        known: dossier.cultivars.map(c => toSlug(c.id)),
      },
      { status: 404 }
    );
  }

  const fp = fingerprintCultivar(view, farm);

  // A supplied digest that does not match is a real answer, not an error: the
  // record changed, or the caller is holding a different one. Both are 200.
  const match =
    supplied === "" ? null : supplied.toLowerCase() === fp.digest.toLowerCase();

  return NextResponse.json(
    {
      ok: true,
      farm,
      cultivar: view.cultivar.id,
      digest: fp.digest,
      /** The exact bytes hashed. Rehash these yourself rather than trusting `digest`. */
      canonical: fp.canonical,
      algorithm:
        "sha256 over key-sorted canonical JSON (@authichain/verifier canonicalize)",
      covers: fp.covers,
      anchored: fp.anchored,
      ...(match === null ? {} : { supplied, match }),
      proves:
        match === false
          ? "Nothing about this record's validity. It establishes only that the digest you supplied is not the digest this record currently produces — because the record changed, or because you are holding a different one."
          : fp.proves,
      doesNotProve: fp.doesNotProve,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    }
  );
}
