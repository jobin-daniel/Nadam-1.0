'use client';

import React, { useState } from 'react';
import { DownloadCloud, X, CheckCircle2, AlertCircle, Loader2, Music, Download } from 'lucide-react';
import { AudioEditSettings } from '@/lib/types/audio';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioId: string;
  settings: AudioEditSettings;
  onExportSuccess?: () => void;
}

export function ExportModal({
  isOpen,
  onClose,
  audioId,
  settings: initialSettings,
  onExportSuccess,
}: ExportModalProps) {
  const [settings, setSettings] = useState<AudioEditSettings>(initialSettings);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<{
    id: string;
    title: string;
    fileSize: number;
    duration: number;
    downloadUrl: string;
  } | null>(null);

  React.useEffect(() => {
    setSettings(initialSettings);
    setRenderResult(null);
    setRenderError(null);
  }, [initialSettings, isOpen]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderError(null);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId,
          settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server-side audio export failed');
      }

      setRenderResult(data.render);
      if (onExportSuccess) onExportSuccess();
    } catch (err: any) {
      setRenderError(err.message || 'Render failed');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          aria-label="Close export dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
            <DownloadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export Mastered MP3</h3>
            <p className="text-xs text-slate-400">
              Renders final audio through server-side FFmpeg filter graph
            </p>
          </div>
        </div>

        {renderError && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{renderError}</span>
          </div>
        )}

        {renderResult ? (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Mastering Complete!</h4>
              <p className="text-xs text-slate-400">
                {renderResult.title} • {(renderResult.fileSize / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <a
                href={renderResult.downloadUrl}
                download
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30"
              >
                <Download className="w-4 h-4" />
                <span>Download Mastered MP3</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Output filename */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Export Filename</label>
              <input
                type="text"
                value={settings.exportFormat.filename}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    exportFormat: { ...prev.exportFormat, filename: e.target.value },
                  }))
                }
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quality & Sample Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Audio Bitrate</label>
                <select
                  value={settings.exportFormat.bitrate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      exportFormat: {
                        ...prev.exportFormat,
                        bitrate: e.target.value as any,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value="320k">320 kbps CBR (Extreme Quality)</option>
                  <option value="256k">256 kbps CBR (High Quality)</option>
                  <option value="192k">192 kbps CBR (Standard)</option>
                  <option value="128k">128 kbps CBR (Compact)</option>
                  <option value="V0">VBR V0 (Variable Transparent)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Sample Rate</label>
                <select
                  value={settings.exportFormat.sampleRate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      exportFormat: {
                        ...prev.exportFormat,
                        sampleRate: parseInt(e.target.value, 10) as any,
                      },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value="44100">44.1 kHz (CD / Web Standard)</option>
                  <option value="48000">48.0 kHz (Video / Broadcast)</option>
                </select>
              </div>
            </div>

            {/* ID3 Tags Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Embedded ID3 Metadata Tags
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Track Title</label>
                  <input
                    type="text"
                    value={settings.exportFormat.tags.title || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        exportFormat: {
                          ...prev.exportFormat,
                          tags: { ...prev.exportFormat.tags, title: e.target.value },
                        },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Artist</label>
                  <input
                    type="text"
                    value={settings.exportFormat.tags.artist || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        exportFormat: {
                          ...prev.exportFormat,
                          tags: { ...prev.exportFormat.tags, artist: e.target.value },
                        },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Album</label>
                  <input
                    type="text"
                    value={settings.exportFormat.tags.album || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        exportFormat: {
                          ...prev.exportFormat,
                          tags: { ...prev.exportFormat.tags, album: e.target.value },
                        },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Year / Date</label>
                  <input
                    type="text"
                    value={settings.exportFormat.tags.year || new Date().getFullYear().toString()}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        exportFormat: {
                          ...prev.exportFormat,
                          tags: { ...prev.exportFormat.tags, year: e.target.value },
                        },
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isRendering}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartRender}
                disabled={isRendering}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering with FFmpeg...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" />
                    <span>Render & Export MP3</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
