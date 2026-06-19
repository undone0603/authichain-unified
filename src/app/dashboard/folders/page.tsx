'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FolderManager } from '@/components/FolderManager';
import { Folder } from 'lucide-react';

export default function FoldersPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setLoading(false);
    };
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Please sign in to manage folders</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Folder className="w-8 h-8 text-gold" />
          <h1 className="text-3xl font-bold text-white">Folder Manager</h1>
        </div>
        <p className="text-gray-400">Organize your QRONs and assets into folders for easier management</p>
      </div>

      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-8">
        <FolderManager userId={userId} />
      </div>
    </div>
  );
}
