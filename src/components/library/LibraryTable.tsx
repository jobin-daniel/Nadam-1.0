'use client';

import React, { useState, useRef } from 'react';
import { LibraryItem } from '@/lib/types/library';
import {
  Play,
  Pause,
  Download,
  Sliders,
  Tag,
  Trash2,
  Music,
  Search,
  Clock,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { TagEditorModal } from './TagEditorModal';

interface LibraryTableProps {
  items: LibraryItem[];
  onOpenInEditor: (item: LibraryItem) => void;
  onRefresh: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function LibraryTable({ items, onOpenInEditor, onRefresh }: LibraryTableProps) {
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [tagModalItem, setTagModalItem] = useState<LibraryItem | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.artist && item.artist.toLowerCase().includes(q)) ||
      (item.album && item.album.toLowerCase().includes(q))
    );
  });

  const togglePlay = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/files/${id}/stream`);
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(id);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      await fetch(`/api/library/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch {}
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-6 backdrop-blur-sm shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Audio Archive</h2>
          <p className="text-xs text-slate-400">
            {items.length} files saved • Stream, edit ID3 tags, or load into DSP mastering suite
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audio tracks..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          {search ? 'No tracks matched your search query.' : 'No audio files in library yet. Download or upload media to populate.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2 w-10">Play</th>
                <th className="pb-3">Title & Artist</th>
                <th className="pb-3">Bitrate</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3">Size</th>
                <th className="pb-3">Added</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filtered.map((item) => {
                const isPlaying = playingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-950/40 transition group"
                  >
                    <td className="py-3 pl-2">
                      <button
                        onClick={() => togglePlay(item.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm ${
                          isPlaying
                            ? 'bg-emerald-500 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white'
                        }`}
                        title={isPlaying ? 'Pause' : 'Play audio'}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                    </td>

                    <td className="py-3 min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center text-emerald-400">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-white block truncate">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {item.artist || 'Unknown Artist'} {item.album ? `• ${item.album}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 text-emerald-400 font-bold">
                        {item.bitrate}
                      </span>
                    </td>

                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {formatDuration(item.duration)}
                    </td>

                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {formatSize(item.fileSize)}
                    </td>

                    <td className="py-3 text-slate-400 text-[11px]">
                      {formatDate(item.createdAt)}
                    </td>

                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Open in Editor */}
                        <button
                          onClick={() => onOpenInEditor(item)}
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                          title="Open in Audio DSP Editor"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>

                        {/* Download MP3 */}
                        <a
                          href={`/api/files/${item.id}/stream`}
                          download={`${item.title}.mp3`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Download MP3 file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        {/* Edit Tags */}
                        <button
                          onClick={() => setTagModalItem(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Edit ID3 tags"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(item.id, item.title)}
                          className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition"
                          title="Delete audio file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TagEditorModal
        item={tagModalItem}
        isOpen={Boolean(tagModalItem)}
        onClose={() => setTagModalItem(null)}
        onSaveSuccess={onRefresh}
      />
    </div>
  );
}
