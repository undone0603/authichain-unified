'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import {
  Plus,
  Tag as TagIcon,
  Trash2,
  Edit,
  Loader2,
} from 'lucide-react';

interface Tag {
  id: string;
  user_id: string;
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
  const supabase = createClient();

  const fetchTags = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch tags: ' + error.message);
      console.error('Error fetching tags:', error);
    } else {
      setTags((data || []) as Tag[]);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    startTransition(() => {
      fetchTags(false);
    });
  }, [fetchTags]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('tags')
      .insert({ user_id: userId, name: newTagName.trim() });
    if (error) {
      toast.error('Failed to add tag: ' + error.message);
      console.error('Error adding tag:', error);
    } else {
      toast.success('Tag added successfully!');
      setNewTagName('');
      fetchTags();
    }
    setLoading(false);
  };

  const handleUpdateTag = async (tagId: string) => {
    if (!editingTagName.trim()) {
      toast.error('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('tags')
      .update({ name: editingTagName.trim() })
      .eq('id', tagId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update tag: ' + error.message);
      console.error('Error updating tag:', error);
    } else {
      toast.success('Tag updated successfully!');
      setEditingTagId(null);
      setEditingTagName('');
      fetchTags();
    }
    setLoading(false);
  };

  const handleDeleteTag = async (tagId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to delete tag: ' + error.message);
      console.error('Error deleting tag:', error);
    } else {
      toast.success('Tag deleted successfully!');
      if (onTagSelected) onTagSelected(null);
      fetchTags();
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="protocol-card space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Tags
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          className="protocol-input flex-grow text-xs px-3 py-2"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag..."
        />
        <button
          onClick={handleAddTag}
          className="btn-gold p-2 rounded-lg shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
        {tags.length === 0 ? (
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center w-full py-2">
            No Tags
          </p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md group hover:border-gold/30 transition-all"
            >
              {editingTagId === tag.id ? (
                <input
                  type="text"
                  className="bg-transparent border-none outline-none text-[10px] font-bold text-white w-20"
                  value={editingTagName}
                  onChange={(e) => setEditingTagName(e.target.value)}
                  autoFocus
                  onBlur={() => handleUpdateTag(tag.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateTag(tag.id)}
                />
              ) : (
                <button
                  onClick={() => onTagSelected && onTagSelected(tag.id)}
                  className="flex items-center gap-1.5 text-zinc-400 group-hover:text-white transition-colors"
                >
                  <TagIcon className="w-3 h-3 text-gold/60" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {tag.name}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingTagId(tag.id);
                    setEditingTagName(tag.name);
                  }}
                  className="text-zinc-600 hover:text-gold"
                >
                  <Edit className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-zinc-600 hover:text-red-500"
                >
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
