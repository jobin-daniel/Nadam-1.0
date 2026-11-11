'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Check, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadZoneProps {
  onUploadSuccess: () => void;
  disabled?: boolean;
}

export function FileUploadZone({ onUploadSuccess, disabled }: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bitrate, setBitrate] = useState<'128k' | '192k' | '256k' | '320k' | 'V0'>('320k');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const selectFile = (file: File) => {
    setError(null);
    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
    setArtist('Local File');
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('bitrate', bitrate);
      formData.append('title', title);
      formData.append('artist', artist);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-5 backdrop-blur-sm shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>Upload Local Video or Audio</span>
        </h3>
        <span className="text-[11px] text-slate-400">
          Supports MP4, MKV, WebM, MOV, WAV, M4A, FLAC, MP3 (Up to 500MB)
        </span>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
          dragActive
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,.mkv,.webm,.flac,.wav,.m4a,.mp3,.mp4,.mov"
          onChange={handleChange}
          disabled={disabled || uploading}
          className="hidden"
        />

        <div className="p-3 rounded-full bg-slate-900 text-emerald-400 border border-slate-800 mb-2">
          <FileAudio className="w-6 h-6" />
        </div>

        {selectedFile ? (
          <div className="text-center">
            <span className="text-xs font-semibold text-emerald-400 block truncate max-w-sm">
              {selectedFile.name}
            </span>
            <span className="text-[11px] text-slate-500">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-xs font-medium text-slate-300 block">
              Click to select or drag and drop media file
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Audio will be automatically extracted and converted to MP3
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {selectedFile && (
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Track Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Bitrate</label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value as any)}
                className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <option value="320k">320 kbps (CBR High)</option>
                <option value="256k">256 kbps (CBR)</option>
                <option value="192k">192 kbps (CBR)</option>
                <option value="128k">128 kbps (CBR)</option>
                <option value="V0">VBR V0 (Variable)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading & Processing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload & Extract MP3</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
