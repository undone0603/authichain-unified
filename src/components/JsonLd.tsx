import type { JsonLd as JsonLdData } from '@/lib/structured-data';

/**
 * Renders one or more schema.org objects as a <script type="application/ld+json">
 * tag. Server-safe (no client hooks) so it can be dropped into any Server
 * Component. Accepts a single object or an array (rendered as separate scripts).
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
