'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { SetupAlert } from '@/components/layout/SetupAlert';
import { LegalNoticeModal } from '@/components/layout/LegalNoticeModal';
import { UrlInput } from '@/components/download/UrlInput';
import { FileUploadZone } from '@/components/download/FileUploadZone';
import { MetadataCard } from '@/components/download/MetadataCard';
import { FormatOptions } from '@/components/download/FormatOptions';
import { JobQueueList } from '@/components/download/JobQueueList';
import { LibraryTable } from '@/components/library/LibraryTable';
import { AudioEditor } from '@/components/editor/AudioEditor';
import { ExportModal } from '@/components/editor/ExportModal';
import { DEFAULT_AUDIO_SETTINGS, AudioEditSettings } from '@/lib/types/audio';
import { VideoMetadata, JobRecord } from '@/lib/types/job';
import { LibraryItem } from '@/lib/types/library';
import { SystemEnvironmentStatus } from '@/lib/security/binaries';
import { Sparkles, Sliders, AlertCircle, Link as LinkIcon, Upload } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'download' | 'editor' | 'library'>('download');
  const [downloadMode, setDownloadMode] = useState<'url' | 'upload'>('url');
  const [isDark, setIsDark] = useState(true);
  const [isLegalOpen, setIsLegalOpen] = useState(false);

  // System environment status
  const [envStatus, setEnvStatus] = useState<SystemEnvironmentStatus | null>(null);
  const [envLoading, setEnvLoading] = useState(false);

  // Download form state
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [bitrate, setBitrate] = useState<'128k' | '192k' | '256k' | '320k' | 'V0'>('320k');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [customAlbum, setCustomAlbum] = useState('Video2MP3 Archive');

  // Job Queue state
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Library state
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Active audio loaded into editor (for Phase 3 & 4)
  const [editorAudio, setEditorAudio] = useState<{ id: string; title: string; url: string } | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<AudioEditSettings | null>(null);

  const fetchEnv = useCallback(async () => {
    setEnvLoading(true);
    try {
      const res = await fetch('/api/env-check');
      const data = await res.json();
      setEnvStatus(data);
    } catch {
      // ignore
    } finally {
      setEnvLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch {}
  }, []);

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      if (data.items) {
        setLibraryItems(data.items);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchEnv();
    fetchJobs();
    fetchLibrary();
    const interval = setInterval(() => {
      fetchJobs();
      fetchLibrary();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchEnv, fetchJobs, fetchLibrary]);

  const handleFetchMetadata = async (url: string) => {
    setMetaLoading(true);
    setMetaError(null);
    setMetadata(null);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect media URL');
      }

      setMetadata(data);
      setCustomTitle(data.title || '');
      setCustomArtist(data.channel || '');

      if (data.isPlaylist && data.playlistItems) {
        setSelectedIndices(data.playlistItems.map((_: any, idx: number) => idx));
      } else {
        setSelectedIndices([]);
      }
    } catch (err: any) {
      setMetaError(err.message || 'Error inspecting media URL');
    } finally {
      setMetaLoading(false);
    }
  };

  const handleStartDownload = async () => {
    if (!metadata) return;

    try {
      setJobsLoading(true);

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: metadata.url,
          bitrate,
          title: customTitle || metadata.title,
          artist: customArtist || metadata.channel,
          album: customAlbum,
          selectedIndices: metadata.isPlaylist ? selectedIndices : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enqueue job');
      }

      fetchJobs();
      setMetadata(null);
    } catch (err: any) {
      alert(`Could not start download: ${err.message}`);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleOpenInEditor = (item: { id: string; title: string }) => {
    setEditorAudio({
      id: item.id,
      title: item.title,
      url: `/api/files/${item.id}/stream`,
    });
    setActiveTab('editor');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        envStatus={envStatus}
        onOpenLegal={() => setIsLegalOpen(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Startup Environment Alert if missing */}
        <SetupAlert envStatus={envStatus} loading={envLoading} onRefresh={fetchEnv} />

        {/* Tab 1: Download & Ingestion */}
        {activeTab === 'download' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                <span>Download & Ingest Audio</span>
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Extract audio from streaming platforms with yt-dlp or upload local video files for studio-grade MP3 encoding.
              </p>
            </div>

            {/* Ingestion Mode Toggle */}
            <div className="flex justify-center">
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDownloadMode('url')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                    downloadMode === 'url'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Online Media URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDownloadMode('upload')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                    downloadMode === 'upload'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Local File Upload</span>
                </button>
              </div>
            </div>

            {downloadMode === 'url' ? (
              <div className="space-y-5">
                <UrlInput
                  onFetchMetadata={handleFetchMetadata}
                  loading={metaLoading}
                  disabled={envStatus ? !envStatus.ready : false}
                />

                {metaError && (
                  <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    <span>{metaError}</span>
                  </div>
                )}

                {metadata && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <MetadataCard
                      metadata={metadata}
                      selectedIndices={selectedIndices}
                      onToggleIndex={(idx) =>
                        setSelectedIndices((prev) =>
                          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                        )
                      }
                      onSelectAll={() =>
                        setSelectedIndices(metadata.playlistItems?.map((_, idx) => idx) || [])
                      }
                      onDeselectAll={() => setSelectedIndices([])}
                    />

                    <FormatOptions
                      bitrate={bitrate}
                      onChangeBitrate={setBitrate}
                      title={customTitle}
                      artist={customArtist}
                      album={customAlbum}
                      onChangeTitle={setCustomTitle}
                      onChangeArtist={setCustomArtist}
                      onChangeAlbum={setCustomAlbum}
                      onSubmit={handleStartDownload}
                      loading={jobsLoading}
                    />
                  </div>
                )}
              </div>
            ) : (
              <FileUploadZone
                onUploadSuccess={() => {
                  fetchJobs();
                  fetchLibrary();
                }}
                disabled={envStatus ? !envStatus.ready : false}
              />
            )}

            {/* Active & Recent Job Queue */}
            <JobQueueList
              jobs={jobs}
              onOpenInEditor={(job) => handleOpenInEditor({ id: job.id, title: job.title })}
              onRefreshJobs={() => {
                fetchJobs();
                fetchLibrary();
              }}
            />
          </div>
        )}

        {/* Tab 2: Editor */}
        {activeTab === 'editor' && (
          <div>
            {editorAudio ? (
              <AudioEditor
                audioId={editorAudio.id}
                audioTitle={editorAudio.title}
                audioUrl={editorAudio.url}
                onOpenExport={(settings) => {
                  setExportSettings(settings);
                  setIsExportOpen(true);
                }}
              />
            ) : (
              <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Sliders className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white">Audio DSP Mastering Editor</h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Select a track from your library below to start editing with live waveform, 10-band EQ, voice enhance, and speed tools.
                  </p>
                </div>

                {libraryItems.length > 0 ? (
                  <div className="max-w-md mx-auto space-y-2 text-left pt-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Choose from Library:
                    </span>
                    <div className="divide-y divide-slate-800 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                      {libraryItems.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleOpenInEditor({ id: item.id, title: item.title })}
                          className="p-3 flex items-center justify-between hover:bg-slate-900 cursor-pointer transition"
                        >
                          <div className="min-w-0 pr-3">
                            <span className="text-xs font-semibold text-white block truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {item.artist || 'Local'} • {item.bitrate}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600 hover:text-white transition"
                          >
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('download')}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                  >
                    Go to Download / Ingest Media
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Library History */}
        {activeTab === 'library' && (
          <LibraryTable
            items={libraryItems}
            onOpenInEditor={(item) => handleOpenInEditor({ id: item.id, title: item.title })}
            onRefresh={fetchLibrary}
          />
        )}
      </main>

      <LegalNoticeModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />

      {editorAudio && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          audioId={editorAudio.id}
          settings={exportSettings || DEFAULT_AUDIO_SETTINGS}
          onExportSuccess={() => {
            fetchLibrary();
          }}
        />
      )}
    </div>
  );
}
