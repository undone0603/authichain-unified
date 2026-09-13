import Link from "next/link";
import { notFound } from "next/navigation";

const pages: Record<string, { title: string; description: string }> = {
  "star-map-qr-code": { title: "Star Map QR Code", description: "Turn a real date and place into a beautiful, scannable star-map QR and a private Memory Portal." },
  "wedding-night-sky": { title: "Wedding Night Sky", description: "Preserve the sky above a wedding date and place as a scannable keepsake." },
  "anniversary-star-map": { title: "Anniversary Star Map", description: "Create a star map from the exact date and place that became part of your story." },
  "birth-night-sky": { title: "Birth Night Sky", description: "Make a lasting keepsake from the sky at a child's birth date and place." },
  "memorial-star-map": { title: "Memorial Star Map", description: "Create a quiet, permanent sky keepsake for a life remembered." },
  "custom-qr-star-map": { title: "Custom QR Star Map", description: "A deterministic star field surrounds a scan-safe QR that opens your Memory Portal." },
  "star-map-for-wedding-photographers": { title: "Star Maps for Wedding Photographers", description: "Offer couples a premium digital keepsake without adding another manual delivery workflow." },
};

export function generateStaticParams() {
  return Object.keys(pages).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  return page ? { title: `${page.title} | QRON Nightstamp`, description: page.description } : {};
}

export default async function QronSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] opacity-60">QRON Nightstamp</p>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">{page.title}</h1>
      <p className="mt-6 max-w-2xl text-xl leading-8 opacity-75">{page.description}</p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link className="rounded-full bg-black px-6 py-3 font-medium text-white" href="/starmap">Create your Nightstamp</Link>
        <Link className="rounded-full border px-6 py-3 font-medium" href="/order?preset=starmap">See Nightstamp options</Link>
      </div>
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <article><h2 className="font-semibold">Real sky</h2><p className="mt-2 opacity-70">Date, time, latitude, longitude, and timezone determine the star field.</p></article>
        <article><h2 className="font-semibold">Scan-safe</h2><p className="mt-2 opacity-70">The QR remains deterministic and is not altered by an AI image generator.</p></article>
        <article><h2 className="font-semibold">Memory Portal</h2><p className="mt-2 opacity-70">The scan opens a living page for photos, music, notes, and future memories.</p></article>
      </section>
    </main>
  );
}
