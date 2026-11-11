'use client';

import React, { useEffect, useState } from 'react';
import { JobRecord } from '@/lib/types/job';
import {
  Loader2,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Music,
  Download,
  Sliders,
  AlertTriangle,
  X,
} from 'lucide-react';

interface JobQueueListProps {
  jobs: JobRecord[];
  onOpenInEditor?: (job: JobRecord) => void;
  onRefreshJobs: () => void;
}

export function JobQueueList({ jobs, onOpenInEditor, onRefreshJobs }: JobQueueListProps) {
  const [liveJobs, setLiveJobs] = useState<Record<string, JobRecord>>({});
  const [jobToRemove, setJobToRemove] = useState<JobRecord | null>(null);
  const [keepDownloads, setKeepDownloads] = useState(false);
  const [keepRenders, setKeepRenders] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Sync initial jobs
    const map: Record<string, JobRecord> = {};
    for (const j of jobs) {
      map[j.id] = j;
    }
    setLiveJobs(map);

    // Subscribe to SSE for non-terminal jobs
    const activeOnes = jobs.filter(
      (j) => j.status === 'queued' || j.status === 'downloading' || j.status === 'converting'
    );

    const eventSources: EventSource[] = [];

    for (const j of activeOnes) {
      const es = new EventSource(`/api/jobs/${j.id}/events`);
      es.onmessage = (event) => {
        try {
          const updated: JobRecord = JSON.parse(event.data);
          setLiveJobs((prev) => ({ ...prev, [updated.id]: updated }));
          if (['completed', 'failed', 'canceled'].includes(updated.status)) {
            es.close();
            onRefreshJobs();
          }
        } catch {}
      };
      es.onerror = () => {
        es.close();
      };
      eventSources.push(es);
    }

    return () => {
      for (const es of eventSources) {
        es.close();
      }
    };
  }, [jobs, onRefreshJobs]);

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      onRefreshJobs();
    } catch {}
  };

  const handleRetry = async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
      onRefreshJobs();
    } catch {}
  };

  const handleConfirmRemove = async () => {
    if (!jobToRemove) return;

    setIsDeleting(true);
    try {
      const query = new URLSearchParams({
        keepDownloads: String(keepDownloads),
        keepRenders: String(keepRenders),
      });

      await fetch(`/api/jobs/${jobToRemove.id}?${query.toString()}`, {
        method: 'DELETE',
      });

      // Remove immediately from local state
      setLiveJobs((prev) => {
        const next = { ...prev };
        delete next[jobToRemove.id];
        return next;
      });

      setJobToRemove(null);
      setKeepDownloads(false);
      setKeepRenders(false);
      onRefreshJobs();
    } catch (e) {
      console.error('Failed to remove job:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const jobList = Object.values(liveJobs).sort((a, b) => b.createdAt - a.createdAt);

  if (jobList.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Processing Queue</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
              {jobList.length} items
            </span>
          </h3>
        </div>

        <div className="space-y-3">
          {jobList.map((job) => {
            const isProcessing = ['queued', 'downloading', 'converting'].includes(job.status);
            const isDone = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const isCanceled = job.status === 'canceled';

            return (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 flex items-center justify-center border border-slate-800">
                      {job.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={job.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate max-w-md">
                        {job.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {job.channel || 'Video2MP3'} • {job.bitrate}
                      </p>
                    </div>
                  </div>

                  {/* Status Badges & Controls */}
                  <div className="flex items-center gap-2">
                    {isProcessing && (
                      <button
                        type="button"
                        onClick={() => handleCancel(job.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 text-xs font-medium border border-red-900/30 transition"
                      >
                        Cancel
                      </button>
                    )}

                    {isDone && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-400 text-xs font-semibold border border-emerald-800/40">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready</span>
                      </span>
                    )}

                    {(isFailed || isCanceled) && (
                      <button
                        type="button"
                        onClick={() => handleRetry(job.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}

                    {/* Remove from Queue Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setJobToRemove(job);
                        setKeepDownloads(false);
                        setKeepRenders(false);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
                      title="Remove from queue..."
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Completed Audio Preview Player */}
                {isDone && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <audio
                        controls
                        src={`/api/files/${job.id}/stream`}
                        className="w-full h-8 accent-emerald-500 rounded-lg"
                        preload="metadata"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`/api/files/${job.id}/stream`}
                        download={`${job.title}.mp3`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                      {onOpenInEditor && (
                        <button
                          type="button"
                          onClick={() => onOpenInEditor(job)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Master in Editor</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {isProcessing && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{job.progress.message || job.status}</span>
                      </span>
                      <span className="font-mono text-slate-400">
                        {job.progress.percent}%
                        {job.progress.speed ? ` • ${job.progress.speed}` : ''}
                        {job.progress.eta ? ` • ETA ${job.progress.eta}` : ''}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${Math.max(4, job.progress.percent)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error readout */}
                {isFailed && (
                  <div className="p-2 rounded-lg bg-red-950/30 border border-red-900/40 text-[11px] text-red-400">
                    {job.error || 'Download or conversion failed.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Remove from Queue Confirmation Modal */}
      {jobToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200 space-y-4">
            <button
              onClick={() => setJobToRemove(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-950/50 text-red-400 border border-red-800/40">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remove from Queue</h3>
                <p className="text-xs text-slate-400">Manage queue item and on-disk files</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
              <span className="font-semibold text-white block truncate mb-1">
                {jobToRemove.title}
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                By default, this will remove the job from your queue and delete its generated files from disk.
              </p>
            </div>

            {/* Checkboxes to avoid file deletion */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={keepDownloads}
                  onChange={(e) => setKeepDownloads(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-medium text-slate-200 block">
                    Keep files in download folder
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Avoid deleting downloaded MP3 audio from storage/downloads
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={keepRenders}
                  onChange={(e) => setKeepRenders(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-medium text-slate-200 block">
                    Keep files in render folder
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Avoid deleting mastered MP3 exports from storage/renders
                  </span>
                </div>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setJobToRemove(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isDeleting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition shadow-lg ${
                  keepDownloads && keepRenders
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {keepDownloads && keepRenders
                        ? 'Remove from Queue'
                        : 'Remove & Delete Files'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
