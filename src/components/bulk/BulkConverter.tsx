'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  FastForward,
  Play,
  Pause,
  Download,
  Sliders,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  X,
  Link as LinkIcon,
  Music,
  Sparkles,
  FolderArchive,
  Copy,
  Check,
  Clock,
  Volume2,
  SlidersHorizontal,
} from 'lucide-react';
import { JobRecord, SpeedSettings, AudioEnhancements } from '@/lib/types/job';
import { SystemEnvironmentStatus } from '@/lib/security/binaries';

interface BulkConverterProps {
  envStatus: SystemEnvironmentStatus | null;
  onOpenInEditor?: (item: { id: string; title: string }) => void;
  onRefreshLibrary?: () => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

const SAMPLE_URLS = [
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ', // Big Buck Bunny sample / test audio
  'https://www.youtube.com/watch?v=jNQXAC9IVRw', // Me at the zoo
];

export function BulkConverter({
  envStatus,
  onOpenInEditor,
  onRefreshLibrary,
}: BulkConverterProps) {
  // URL Input State
  const [urlInput, setUrlInput] = useState('');
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [copiedSample, setCopiedSample] = useState(false);

  // Speed & Audio Configuration
  const [speed, setSpeed] = useState<number>(1.25);
  const [preservePitch, setPreservePitch] = useState<boolean>(true);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [bitrate, setBitrate] = useState<'128k' | '192k' | '256k' | '320k' | 'V0'>('320k');
  const [appendSpeedTag, setAppendSpeedTag] = useState<boolean>(true);
  const [albumName, setAlbumName] = useState('Bulk Speed Converted');
  const [expandPlaylists, setExpandPlaylists] = useState(true);

  // Enhancements
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [voiceEnhance, setVoiceEnhance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Submission & Batch State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchJobs, setBatchJobs] = useState<JobRecord[]>([]);
  const [invalidUrls, setInvalidUrls] = useState<{ url: string; error: string }[]>([]);

  // Audio Playback State
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Parse URLs whenever urlInput changes
  useEffect(() => {
    const lines = urlInput
      .split(/[\n,\s]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));

    // Deduplicate
    const unique = Array.from(new Set(lines));
    setDetectedUrls(unique);
  }, [urlInput]);

  // Load existing batch jobs on mount or activeBatchId change
  useEffect(() => {
    if (!activeBatchId) return;

    let isMounted = true;

    const fetchBatch = async () => {
      try {
        const res = await fetch(`/api/jobs/bulk?batchId=${activeBatchId}`);
        const data = await res.json();
        if (isMounted && data.jobs) {
          setBatchJobs(data.jobs);
        }
      } catch {}
    };

    fetchBatch();
    const interval = setInterval(fetchBatch, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeBatchId]);

  // Subscribe to SSE for active jobs in the batch
  useEffect(() => {
    if (batchJobs.length === 0) return;

    const activeJobs = batchJobs.filter(
      (j) => j.status === 'queued' || j.status === 'downloading' || j.status === 'converting'
    );

    const eventSources: EventSource[] = [];

    for (const job of activeJobs) {
      const es = new EventSource(`/api/jobs/${job.id}/events`);
      es.onmessage = (event) => {
        try {
          const updated: JobRecord = JSON.parse(event.data);
          setBatchJobs((prev) =>
            prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j))
          );
          if (['completed', 'failed', 'canceled'].includes(updated.status)) {
            es.close();
            onRefreshLibrary?.();
          }
        } catch {}
      };
      es.onerror = () => es.close();
      eventSources.push(es);
    }

    return () => {
      for (const es of eventSources) {
        es.close();
      }
    };
  }, [batchJobs.map((j) => `${j.id}:${j.status}`).join(','), onRefreshLibrary]);

  const handleRemoveDetectedUrl = (index: number) => {
    const updated = detectedUrls.filter((_, i) => i !== index);
    setUrlInput(updated.join('\n'));
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()));
      }
    } catch {
      alert('Unable to access clipboard. Please paste manually.');
    }
  };

  const handleLoadSamples = () => {
    setUrlInput(SAMPLE_URLS.join('\n'));
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleSubmitBulk = async () => {
    if (detectedUrls.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setInvalidUrls([]);

    try {
      const payload = {
        urls: detectedUrls,
        speedSettings: {
          speed: Number(speed),
          preservePitch,
          pitchSemitones: Number(pitchSemitones),
        },
        audioEnhancements: {
          normalize: normalizeAudio,
          voiceEnhance,
        },
        bitrate,
        appendSpeedTag,
        album: albumName || 'Bulk Speed Converted',
        expandPlaylists,
      };

      const res = await fetch('/api/jobs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit bulk jobs');
      }

      setActiveBatchId(data.batchId);
      setBatchJobs(data.jobs || []);
      if (data.invalidUrls && data.invalidUrls.length > 0) {
        setInvalidUrls(data.invalidUrls);
      }

      // Clear input on successful enqueue
      setUrlInput('');
      onRefreshLibrary?.();
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting bulk conversion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBatch = async () => {
    if (!activeBatchId) return;
    if (!confirm('Cancel all pending jobs in this batch?')) return;

    try {
      await fetch('/api/jobs/bulk/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: activeBatchId }),
      });

      // Update local state
      setBatchJobs((prev) =>
        prev.map((j) => (j.status === 'queued' || j.status === 'downloading' ? { ...j, status: 'canceled' } : j))
      );
    } catch {}
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      setBatchJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'queued', error: undefined } : j))
      );
    } catch {}
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      setBatchJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'canceled' } : j))
      );
    } catch {}
  };

  const togglePlayAudio = (jobId: string) => {
    if (playingJobId === jobId) {
      audioRef.current?.pause();
      setPlayingJobId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/files/${jobId}/stream`);
      audio.onended = () => setPlayingJobId(null);
      audio.play().catch(() => setPlayingJobId(null));
      audioRef.current = audio;
      setPlayingJobId(jobId);
    }
  };

  // Calculations for Batch Progress
  const totalJobs = batchJobs.length;
  const completedJobs = batchJobs.filter((j) => j.status === 'completed');
  const failedJobs = batchJobs.filter((j) => j.status === 'failed');
  const activeProcessingJobs = batchJobs.filter((j) => j.status === 'downloading' || j.status === 'converting');
  const completedCount = completedJobs.length;
  const progressPercent = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  // Format Duration helper
  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Estimated Duration hint
  const calculateEstimatedDuration = (originalMins = 10) => {
    if (!speed || speed <= 0) return `${originalMins}:00`;
    const adjustedSec = (originalMins * 60) / speed;
    const m = Math.floor(adjustedSec / 60);
    const s = Math.floor(adjustedSec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="text-center space-y-2 py-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
          <Zap className="w-3.5 h-3.5" />
          <span>Single-Pass DSP Audio Pipeline</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          <span>Bulk Download & Speed Conversion</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          Add a list of media URLs from YouTube, SoundCloud, podcasts, or streaming platforms.
          Automatically extract audio, apply customized playback speed with pitch preservation, and export to studio-grade MP3.
        </p>
      </div>

      {/* Main Grid: Input & Speed Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: URL Input (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-400" />
                <span>Media URLs List</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
                  title="Paste from clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span>Paste</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition flex items-center gap-1.5 border border-emerald-500/20"
                >
                  {copiedSample ? <Check className="w-3 h-3 text-emerald-400" /> : <Sparkles className="w-3 h-3" />}
                  <span>Sample Links</span>
                </button>
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 transition"
                    title="Clear text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste media links (one per line or space-separated):&#10;https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/playlist?list=...&#10;https://soundcloud.com/...&#10;https://vimeo.com/..."
                rows={7}
                disabled={envStatus ? !envStatus.ready : false}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition"
              />
              <div className="absolute bottom-3 right-3">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    detectedUrls.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {detectedUrls.length} {detectedUrls.length === 1 ? 'link detected' : 'links detected'}
                </span>
              </div>
            </div>

            {/* Detected URLs Chip List */}
            {detectedUrls.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                  <span>Queued Links Preview:</span>
                  <span>{detectedUrls.length} items</span>
                </div>
                <div className="space-y-1">
                  {detectedUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300"
                    >
                      <span className="font-mono text-[10px] text-slate-500 w-5">#{idx + 1}</span>
                      <span className="truncate flex-1 font-mono text-[11px] text-slate-300">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDetectedUrl(idx)}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition"
                        title="Remove link"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Speed & Output Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <FastForward className="w-4 h-4 text-emerald-400" />
                  <span>Playback Speed</span>
                </label>
                <span className="text-base font-bold text-emerald-400 font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  {speed.toFixed(2)}x
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                10:00 audio becomes <span className="text-emerald-300 font-semibold">{calculateEstimatedDuration(10)}</span> at this speed
              </p>
            </div>

            {/* Quick Speed Preset Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {SPEED_PRESETS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSpeed(val)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                    Math.abs(speed - val) < 0.01
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {val}x
                </button>
              ))}
            </div>

            {/* Fine Speed Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.25x</span>
                <span>1.0x (Normal)</span>
                <span>2.0x</span>
                <span>4.0x</span>
              </div>
            </div>

            {/* Pitch Preservation Toggle */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-white block">Preserve Natural Pitch</span>
                  <span className="text-[11px] text-slate-400 block">
                    {preservePitch
                      ? 'Locked key (no chipmunk / deep voice effect)'
                      : 'Resample mode (tape/vinyl pitch alteration)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preservePitch}
                  onChange={(e) => setPreservePitch(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                />
              </label>

              {/* Advanced Pitch Shift if desired */}
              {showAdvanced && (
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Pitch Shift (Semitones):</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={pitchSemitones}
                    onChange={(e) => setPitchSemitones(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>-12</span>
                    <span>0 (Original)</span>
                    <span>+12</span>
                  </div>
                </div>
              )}
            </div>

            {/* MP3 Quality Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">MP3 Encoding Quality</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['320k', '256k', '192k', '128k', 'V0'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBitrate(b)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition ${
                      bitrate === b
                        ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {b === 'V0' ? 'VBR V0' : `${b.replace('k', '')} kbps`}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced & Audio Enhancements Toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                <span>{showAdvanced ? 'Hide Options' : 'More Options (Naming, Enhancements)'}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 animate-in fade-in duration-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={appendSpeedTag}
                      onChange={(e) => setAppendSpeedTag(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span>Append speed to title (e.g. [1.25x])</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={expandPlaylists}
                      onChange={(e) => setExpandPlaylists(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span>Auto-expand YouTube Playlists to all tracks</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={normalizeAudio}
                      onChange={(e) => setNormalizeAudio(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span>Loudness Normalization (-16 LUFS)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={voiceEnhance}
                      onChange={(e) => setVoiceEnhance(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span>Voice Enhance (Rumble filter & vocal presence)</span>
                  </label>

                  <div className="pt-1">
                    <label className="text-[11px] text-slate-400 block mb-1">ID3 Album Name</label>
                    <input
                      type="text"
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                      placeholder="Album name"
                      className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Invalid URLs warning */}
            {invalidUrls.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{invalidUrls.length} invalid URLs were skipped:</span>
                </div>
                <div className="max-h-20 overflow-y-auto font-mono text-[10px] space-y-0.5">
                  {invalidUrls.map((inv, idx) => (
                    <div key={idx} className="truncate">
                      {inv.url} ({inv.error})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="button"
              onClick={handleSubmitBulk}
              disabled={isSubmitting || detectedUrls.length === 0 || (envStatus ? !envStatus.ready : false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enqueuing Batch...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>
                    Start Bulk Download & Speed Conversion ({detectedUrls.length}{' '}
                    {detectedUrls.length === 1 ? 'Track' : 'Tracks'})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Processing Status & Live Queue */}
      {batchJobs.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          {/* Batch Status Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Batch Queue Status</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300">
                  {completedCount} / {totalJobs} Completed
                </span>
                {activeProcessingJobs.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Processing {activeProcessingJobs.length} active</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Processed in background with concurrent streaming worker queue
              </p>
            </div>

            {/* Batch Level Actions */}
            <div className="flex items-center gap-2">
              {completedCount > 0 && activeBatchId && (
                <a
                  href={`/api/bulk/zip?batchId=${activeBatchId}`}
                  download={`bulk_audio_${activeBatchId}.zip`}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-2 shadow-sm"
                  title="Download all completed MP3 tracks as a ZIP archive"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Download All as ZIP ({completedCount})</span>
                </a>
              )}

              {activeProcessingJobs.length > 0 && (
                <button
                  type="button"
                  onClick={handleCancelBatch}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 text-xs font-medium transition"
                >
                  Cancel Remaining
                </button>
              )}
            </div>
          </div>

          {/* Overall Batch Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Overall Batch Completion</span>
              <span className="text-emerald-400 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Individual Job Cards */}
          <div className="space-y-2">
            {batchJobs.map((job) => {
              const isPlaying = playingJobId === job.id;
              const hasSpeed = job.speedSettings && job.speedSettings.speed !== 1.0;

              return (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700/80 transition"
                >
                  {/* Left: Thumbnail & Title Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {job.thumbnail ? (
                      <img
                        src={job.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <Music className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs truncate block">
                          {job.title}
                        </span>
                        {hasSpeed && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                            ⚡ {job.speedSettings!.speed}x
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                        <span>{job.channel || 'Media'}</span>
                        {job.duration ? (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {formatDuration(job.duration)}
                            </span>
                          </>
                        ) : null}
                        <span>•</span>
                        <span className="font-mono text-emerald-400 font-semibold">{job.bitrate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress / Status */}
                  <div className="w-full sm:w-48 flex-shrink-0 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="capitalize text-slate-300 font-medium flex items-center gap-1">
                        {job.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {job.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                        {(job.status === 'downloading' || job.status === 'converting') && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        )}
                        {job.status === 'queued' && <Clock className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{job.status}</span>
                      </span>
                      <span className="font-mono text-slate-400">{job.progress.percent}%</span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          job.status === 'completed'
                            ? 'bg-emerald-500'
                            : job.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${job.progress.percent}%` }}
                      />
                    </div>
                    {job.progress.message && (
                      <p className="text-[10px] text-slate-500 truncate">{job.progress.message}</p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                    {/* Inline Play / Pause for Completed Tracks */}
                    {job.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(job.id)}
                        className={`p-2 rounded-lg transition ${
                          isPlaying
                            ? 'bg-emerald-500 text-white animate-pulse'
                            : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white'
                        }`}
                        title={isPlaying ? 'Pause' : 'Play converted audio'}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>
                    )}

                    {/* Direct Download MP3 */}
                    {job.status === 'completed' && (
                      <a
                        href={`/api/files/${job.id}/stream`}
                        download={`${job.title}.mp3`}
                        className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition"
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Open in Audio Editor */}
                    {job.status === 'completed' && onOpenInEditor && (
                      <button
                        type="button"
                        onClick={() => onOpenInEditor({ id: job.id, title: job.title })}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Open in Audio DSP Editor"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Retry on Failure */}
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryJob(job.id)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition"
                        title="Retry job"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Cancel Running / Queued */}
                    {(job.status === 'queued' || job.status === 'downloading' || job.status === 'converting') && (
                      <button
                        type="button"
                        onClick={() => handleCancelJob(job.id)}
                        className="p-2 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition"
                        title="Cancel job"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
