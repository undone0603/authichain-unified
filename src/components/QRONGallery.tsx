'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { QRONEntry } from '@/lib/types';
import {
  Loader2,
  QrCode,
  Shield,
  TrendingUp,
  Settings,
  ChevronRight,
} from 'lucide-react';

interface QRONGalleryProps {
  currentUserId?: string;
  selectedFolderId?: string | null;
  selectedTagId?: string | null;
}

export function QRONGallery({
  currentUserId,
  selectedFolderId,
  selectedTagId,
}: QRONGalleryProps) {
  const [qrons, setQrons] = useState<QRONEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(() => {
    if (currentUserId) return { id: currentUserId } as User;
    return null;
  });

  useEffect(() => {
    if (!currentUserId) {
      const fetchUser = async () => {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setUser(authUser);
      };
      fetchUser();
    }
  }, [supabase, currentUserId]);

  const fetchQRONs = useCallback(async () => {
    if (!user && !currentUserId) return;
    setLoading(true);
    try {
      let query = supabase.from('qrons').select('*, qron_tags(tag_id)');

      if (currentUserId) {
        query = query.eq('user_id', currentUserId).eq('is_demo', false);
      } else if (user) {
        query = query.or(`user_id.eq.${user.id},is_demo.eq.true`);
      } else {
        query = query.eq('is_demo', true);
      }

      if (selectedFolderId) {
        query = query.eq('folder_id', selectedFolderId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching QRONs:', error);
      } else {
        let filteredQrons = (data || []) as (QRONEntry & { qron_tags: { tag_id: string }[] })[];
        if (selectedTagId) {
          filteredQrons = filteredQrons.filter(
            (q) =>
              q.qron_tags && q.qron_tags.some((qt) => qt.tag_id === selectedTagId)
          );
        }
        setQrons(filteredQrons as QRONEntry[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching QRONs:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user, currentUserId, selectedFolderId, selectedTagId]);

  useEffect(() => {
    startTransition(() => {
      fetchQRONs();
    });
  }, [fetchQRONs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-gold mb-4" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600">
          Syncing Library
        </p>
      </div>
    );
  }

  if (qrons.length === 0) {
    return (
      <div className="protocol-card p-20 text-center border-dashed border-zinc-800">
        <div className="p-6 rounded-full bg-zinc-900/50 inline-block mb-6 border border-zinc-800">
          <QrCode className="w-12 h-12 text-zinc-700" />
        </div>
        <h3 className="text-xl font-bold text-zinc-300 mb-2 uppercase tracking-tight">
          Library is Empty
        </h3>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">
          You haven&apos;t generated any QRONs in this selection yet.
        </p>
        <Link href="/" className="btn-gold px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">
          Create Masterpiece
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {qrons.map((qron) => (
        <div
          key={qron.id}
          className="protocol-card group overflow-hidden border-zinc-900 hover:border-gold/30 transition-all duration-500"
        >
          <div className="relative aspect-square overflow-hidden bg-zinc-950">
            <Image
              src={qron.image_url}
              alt={qron.prompt || 'QRON Artwork'}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex gap-2 mb-4">
                <Link
                  href={`/dashboard/qron/${qron.id}`}
                  className="p-3 rounded-full bg-gold text-black hover:scale-110 transition-transform shadow-gold"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <Link
                    href={`/p/${qron.id}`}
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/20"
                >
                    <Shield className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                {qron.prompt}
              </p>
            </div>
          </div>
          <div className="p-4 bg-zinc-900/20 border-t border-zinc-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-gold font-black px-2 py-0.5 rounded bg-gold/10 border border-gold/10">
                {qron.mode}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                <TrendingUp className="w-3 h-3" />
                {qron.scan_count || 0} Scans
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                {new Date(qron.created_at).toLocaleDateString()}
              </p>
              <ChevronRight className="w-3 h-3 text-zinc-800 group-hover:text-gold transition-colors" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
