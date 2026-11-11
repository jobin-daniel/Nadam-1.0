'use client';

import React, { useState } from 'react';
import { Tag, DownloadCloud, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface FormatOptionsProps {
  bitrate: '128k' | '192k' | '256k' | '320k' | 'V0';
  onChangeBitrate: (val: '128k' | '192k' | '256k' | '320k' | 'V0') => void;
  title: string;
  artist: string;
  album: string;
  onChangeTitle: (val: string) => void;
  onChangeArtist: (val: string) => void;
  onChangeAlbum: (val: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
}

const BITRATES = [
  { value: '320k', label: '320 kbps', desc: 'Highest CBR quality' },
  { value: '256k', label: '256 kbps', desc: 'High fidelity' },
  { value: '192k', label: '192 kbps', desc: 'Balanced file size' },
  { value: '128k', label: '128 kbps', desc: 'Compact audio' },
  { value: 'V0', label: 'VBR V0', desc: 'Variable bit-rate (Transparent)' },
] as const;

export function FormatOptions({
  bitrate,
  onChangeBitrate,
  title,
  artist,
  album,
  onChangeTitle,
  onChangeArtist,
  onChangeAlbum,
  onSubmit,
  loading,
  disabled,
}: FormatOptionsProps) {
  const [showTags, setShowTags] = useState(false);

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-sm shadow-xl space-y-5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
          Select MP3 Audio Quality
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {BITRATES.map((b) => {
            const isSelected = bitrate === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => onChangeBitrate(b.value)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">{b.label}</span>
                  {b.value === '320k' && (
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      PRO
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{b.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ID3 Tags Toggle */}
      <div className="border-t border-slate-800/80 pt-4">
        <button
          type="button"
          onClick={() => setShowTags(!showTags)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">Customize ID3 Tags & Cover Art</span>
          </div>
          {showTags ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTags && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Track Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="Title"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Artist / Channel</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => onChangeArtist(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="Artist"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => onChangeAlbum(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="Album"
              />
            </div>
          </div>
        )}
      </div>

      {/* Start Download Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || disabled}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
        >
          <DownloadCloud className="w-5 h-5" />
          <span>Download Audio & Convert to MP3</span>
        </button>
      </div>
    </div>
  );
}
