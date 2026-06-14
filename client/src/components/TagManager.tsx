import { useCallback, useEffect, useState } from 'react';
import { Plus, Tag as TagIcon, Trash2, Edit, Loader2 } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagManagerProps {
  userId: string;
  onTagSelected?: (tagId: string | null) => void;
}

export function TagManager({ userId, onTagSelected }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tags?userId=${userId}`);
      const data = await res.json();
      setTags(data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name: newTagName.trim() }),
    });
    setNewTagName('');
    fetchTags();
  };

  const handleUpdateTag = async (tagId: string) => {
    if (!editingTagName.trim()) return;
    await fetch(`/api/tags/${tagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingTagName.trim() }),
    });
    setEditingTagId(null);
    setEditingTagName('');
    fetchTags();
  };

  const handleDeleteTag = async (tagId: string) => {
    await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    onTagSelected?.(null);
    fetchTags();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tags</h3>

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-grow text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
          placeholder="New tag..."
        />
        <button onClick={handleAddTag} className="p-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 transition-colors shrink-0">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
        {tags.length === 0 ? (
          <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest text-center w-full py-2">No Tags</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md group hover:border-yellow-500/30 transition-all">
              {editingTagId === tag.id ? (
                <input
                  type="text"
                  className="bg-transparent border-none outline-none text-xs font-bold text-white w-20"
                  value={editingTagName}
                  onChange={(e) => setEditingTagName(e.target.value)}
                  autoFocus
                  onBlur={() => handleUpdateTag(tag.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateTag(tag.id)}
                />
              ) : (
                <button
                  onClick={() => onTagSelected?.(tag.id)}
                  className="flex items-center gap-1.5 text-zinc-400 group-hover:text-white transition-colors"
                >
                  <TagIcon className="w-3 h-3 text-yellow-500/60" />
                  <span className="text-xs font-bold uppercase tracking-tight">{tag.name}</span>
                </button>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }} className="text-zinc-600 hover:text-yellow-500">
                  <Edit className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => handleDeleteTag(tag.id)} className="text-zinc-600 hover:text-red-500">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
