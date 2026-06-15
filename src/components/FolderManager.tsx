'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import {
  Plus,
  Folder as FolderIcon,
  Trash2,
  Edit,
  Save,
  X,
  Loader2,
} from 'lucide-react';

interface Folder {
  id: string;
  user_id: string;
  name: string;
}

interface FolderManagerProps {
  userId: string;
  onFolderSelected?: (folderId: string | null) => void;
}

export function FolderManager({
  userId,
  onFolderSelected,
}: FolderManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const supabase = createClient();

  const fetchFolders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch folders: ' + error.message);
      console.error('Error fetching folders:', error);
    } else {
      setFolders((data || []) as Folder[]);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    startTransition(() => {
      fetchFolders(false);
    });
  }, [fetchFolders]);

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name cannot be empty.');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name: newFolderName.trim() });
    if (error) {
      toast.error('Failed to add folder: ' + error.message);
      console.error('Error adding folder:', error);
    } else {
      toast.success('Folder added successfully!');
      setNewFolderName('');
      fetchFolders();
    }
    setLoading(false);
  };

  const handleUpdateFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      toast.error('Folder name cannot be empty.');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('folders')
      .update({ name: editingFolderName.trim() })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update folder: ' + error.message);
      console.error('Error updating folder:', error);
    } else {
      toast.success('Folder updated successfully!');
      setEditingFolderId(null);
      setEditingFolderName('');
      fetchFolders();
    }
    setLoading(false);
  };

  const handleDeleteFolder = async (folderId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to delete folder: ' + error.message);
      console.error('Error deleting folder:', error);
    } else {
      toast.success('Folder deleted successfully!');
      if (onFolderSelected) {
        onFolderSelected(null);
      }
      fetchFolders();
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
        <span className="ml-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
          Loading Library
        </span>
      </div>
    );
  }

  return (
    <div className="protocol-card space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Folders
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          className="protocol-input flex-grow text-xs px-3 py-2"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New folder name"
        />
        <button
          onClick={handleAddFolder}
          className="btn-gold p-2 rounded-lg shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {folders.length === 0 ? (
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center py-4">
            No Folders
          </p>
        ) : (
          folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 group hover:border-gold/30 transition-all"
            >
              {editingFolderId === folder.id ? (
                <input
                  type="text"
                  className="protocol-input flex-grow text-xs px-2 py-1"
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                />
              ) : (
                <button
                  onClick={() =>
                    onFolderSelected && onFolderSelected(folder.id)
                  }
                  className="flex items-center gap-2 flex-grow text-left text-zinc-400 group-hover:text-white transition-colors"
                >
                  <FolderIcon className="w-4 h-4" />
                  <span className="text-xs font-bold truncate">
                    {folder.name}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {editingFolderId === folder.id ? (
                  <>
                    <button
                      onClick={() => handleUpdateFolder(folder.id)}
                      className="text-green-500 hover:text-green-400"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFolderId(null);
                        setEditingFolderName('');
                      }}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingFolderId(folder.id);
                      setEditingFolderName(folder.name);
                    }}
                    className="text-zinc-500 hover:text-gold"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-zinc-500 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
