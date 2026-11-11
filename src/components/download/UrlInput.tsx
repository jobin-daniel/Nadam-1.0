'use client';

import React, { useState } from 'react';
import { Search, Clipboard, Loader2, X, Link as LinkIcon } from 'lucide-react';

interface UrlInputProps {
  onFetchMetadata: (url: string) => Promise<void>;
  loading: boolean;
  disabled?: boolean;
}

export function UrlInput({ onFetchMetadata, loading, disabled }: UrlInputProps) {
  const [url, setUrl] = useState('');

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch {
      // clipboard access not permitted
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading) {
      onFetchMetadata(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-500 pointer-events-none">
          <LinkIcon className="w-5 h-5" />
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube, Vimeo, Soundcloud, or any media URL..."
          disabled={disabled || loading}
          className="w-full h-14 pl-12 pr-32 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-inner"
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="p-2 text-slate-400 hover:text-white rounded-lg transition"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {!url && (
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!url.trim() || loading || disabled}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Fetch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
