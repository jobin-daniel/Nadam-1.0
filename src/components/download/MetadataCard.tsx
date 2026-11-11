'use client';

import React from 'react';
import { Clock, User, ListMusic, CheckSquare, Square, Music } from 'lucide-react';
import { VideoMetadata, PlaylistItem } from '@/lib/types/job';

interface MetadataCardProps {
  metadata: VideoMetadata;
  selectedIndices: number[];
  onToggleIndex: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Live / Unknown';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MetadataCard({
  metadata,
  selectedIndices,
  onToggleIndex,
  onSelectAll,
  onDeselectAll,
}: MetadataCardProps) {
  const isPlaylist = metadata.isPlaylist && metadata.playlistItems && metadata.playlistItems.length > 0;

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Thumbnail */}
        <div className="relative w-full sm:w-56 h-36 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
          {metadata.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={metadata.thumbnail}
              alt={metadata.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Music className="w-12 h-12" />
            </div>
          )}

          {metadata.duration > 0 && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{formatDuration(metadata.duration)}</span>
            </div>
          )}

          {isPlaylist && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-[10px] font-bold uppercase text-white flex items-center gap-1">
              <ListMusic className="w-3 h-3" />
              <span>Playlist ({metadata.playlistItems?.length})</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white line-clamp-2 leading-snug">
              {metadata.title}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              {metadata.channel && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{metadata.channel}</span>
                </div>
              )}
              {metadata.duration > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatDuration(metadata.duration)}</span>
                </div>
              )}
            </div>
          </div>

          {isPlaylist && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Selected <strong>{selectedIndices.length}</strong> of{' '}
                {metadata.playlistItems?.length} items
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="text-slate-400 hover:text-white"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Playlist Item Selector */}
      {isPlaylist && metadata.playlistItems && (
        <div className="mt-4 max-h-56 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800/80 divide-y divide-slate-800/50">
          {metadata.playlistItems.map((item) => {
            const isSelected = selectedIndices.includes(item.index);
            return (
              <div
                key={item.index}
                onClick={() => onToggleIndex(item.index)}
                className={`p-2.5 flex items-center gap-3 cursor-pointer transition ${
                  isSelected ? 'bg-emerald-950/20' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="text-emerald-400">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <span className="text-xs font-mono text-slate-500 w-6">
                  {(item.index + 1).toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-slate-200 flex-1 truncate">{item.title}</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {formatDuration(item.duration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
