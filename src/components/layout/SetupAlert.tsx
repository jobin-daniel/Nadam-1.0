'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Terminal } from 'lucide-react';
import { SystemEnvironmentStatus } from '@/lib/security/binaries';

interface SetupAlertProps {
  envStatus: SystemEnvironmentStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

export function SetupAlert({ envStatus, loading, onRefresh }: SetupAlertProps) {
  if (!envStatus) return null;
  if (envStatus.ready) return null;

  const missing: string[] = [];
  if (!envStatus.binaries.ytdlp.installed) missing.push('yt-dlp');
  if (!envStatus.binaries.ffmpeg.installed) missing.push('ffmpeg');
  if (!envStatus.binaries.ffprobe.installed) missing.push('ffprobe');

  return (
    <div className="mx-auto max-w-5xl mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 text-amber-200">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white flex items-center gap-2">
            Required Processing Engines Missing
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal">
              Action Required
            </span>
          </h4>
          <p className="text-xs text-amber-300/90 mt-1">
            Video2MP3 needs <strong>{missing.join(', ')}</strong> installed to download and encode media.
          </p>

          <div className="mt-3 p-3 rounded-xl bg-black/50 border border-amber-500/20 font-mono text-xs text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span>
                {missing.includes('yt-dlp') && missing.includes('ffmpeg')
                  ? 'brew install ffmpeg yt-dlp'
                  : missing.includes('yt-dlp')
                  ? 'pip install yt-dlp  # or brew install yt-dlp'
                  : 'brew install ffmpeg'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recheck
        </button>
      </div>
    </div>
  );
}
