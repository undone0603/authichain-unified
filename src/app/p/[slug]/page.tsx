import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSeoPageBySlug, listSeoSlugs } from '@/lib/seo-pages';

// Statically generate every committed SEO page; unknown slugs 404.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return listSeoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return {};
  const canonical = typeof page.jsonLd.url === 'string' ? page.jsonLd.url : undefined;
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: canonical ? { canonical } : undefined,
    openGraph: { title: page.title, description: page.metaDescription, type: 'website' },
  };
}

export default async function SeoLandingPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert">
      {/* JSON-LD structured data — the signal AI search engines cite. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(page.jsonLd) }}
      />
      <h1>{page.h1}</h1>
      {/* bodyHtml is sanitized at generation time (script tags stripped). */}
      <div dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
    </main>
  );
}
