'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { QRONMode } from '@/lib/types';

type DemoQRON = {
  id: string;
  user_id: string;
  mode: QRONMode;
  qr_content: string;
  prompt: string;
  image_url: string;
  is_demo: boolean;
  scan_count: number;
  created_at: string;
};

export function FeaturedQRONs() {
  const [demoQrons, setDemoQrons] = useState<DemoQRON[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchDemoQrons = async () => {
      try {
        const { data, error } = await supabase
          .from('qrons')
          .select('*')
          .eq('is_demo', true)
          .limit(8);

        if (!error && data) {
          setDemoQrons(data as DemoQRON[]);
        }
      } catch (err) {
        console.error('Unexpected error fetching demo QRONs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDemoQrons();
  }, [supabase]);

  if (loading) {
    return (
      <section className="text-center py-16">
        <h2 className="text-3xl font-bold mb-6 gold-text">Featured Artworks</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
        </div>
      </section>
    );
  }

  if (demoQrons.length === 0) return null;

  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-extrabold mb-4 gold-text">
          Iconic QRON Gallery
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Experience the limitless creativity of AI-fused QR art. Each piece is a
          fully scannable, cryptographically signed masterpiece.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {demoQrons.map((qron) => (
          <div key={qron.id} className="protocol-card group overflow-hidden">
            <div className="relative aspect-square bg-zinc-900 rounded-lg overflow-hidden">
              <Image
                src={qron.image_url}
                alt={qron.prompt || 'QRON Artwork'}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-white text-xs font-medium line-clamp-2 mb-2">
                  {qron.prompt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-gold font-bold">
                    {qron.mode}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {qron.scan_count} scans
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <a href="/gallery" className="btn-outline-gold px-10 py-3 rounded-xl">
          Browse Full Collection &rarr;
        </a>
      </div>
    </section>
  );
}
