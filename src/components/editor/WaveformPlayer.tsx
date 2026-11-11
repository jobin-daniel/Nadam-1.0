'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ZoomIn,
  Volume2,
  VolumeX,
  Sliders,
  Scissors,
  Check,
} from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string;
  audioElementRef: React.RefObject<HTMLAudioElement | null>;
  onReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStart?: () => void;
  isBypassed: boolean;
  onToggleBypass: () => void;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  trimEnabled: boolean;
  onToggleTrim: () => void;
  playbackRate: number;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
}

export function WaveformPlayer({
  audioUrl,
  audioElementRef,
  onReady,
  onTimeUpdate,
  onPlayStart,
  isBypassed,
  onToggleBypass,
  trimStart,
  trimEnd,
  onTrimChange,
  trimEnabled,
  onToggleTrim,
  playbackRate,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(20);

  const [isWsReady, setIsWsReady] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioElementRef.current) return;
    setIsWsReady(false);

    const audioEl = audioElementRef.current;
    audioEl.src = audioUrl;
    audioEl.playbackRate = playbackRate;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: audioEl,
      waveColor: '#475569',
      progressColor: '#10b981',
      cursorColor: '#34d399',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 96,
      normalize: true,
      minPxPerSec: zoomLevel,
    });

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      setIsWsReady(true);
      if (onReady) onReady(dur);
      if (trimEnd === 0 && dur > 0) {
        onTrimChange(0, dur);
      }
    });

    ws.on('timeupdate', (time) => {
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);

      // Loop or stop if trim region enabled and reached end
      if (trimEnabled && trimEnd > 0 && time >= trimEnd) {
        audioEl.currentTime = trimStart;
      }
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wsRef.current = ws;

    return () => {
      try {
        ws.destroy();
      } catch {}
    };
  }, [audioUrl]);

  // Sync zoom
  useEffect(() => {
    if (wsRef.current && isWsReady) {
      try {
        wsRef.current.zoom(zoomLevel);
      } catch {}
    }
  }, [zoomLevel, isWsReady]);

  // Sync playback rate
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioElementRef]);

  const handleTogglePlay = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
    } else {
      if (onPlayStart) {
        onPlayStart();
      }
      if (trimEnabled && (currentTime < trimStart || currentTime >= trimEnd)) {
        audioElementRef.current.currentTime = trimStart;
      }
      audioElementRef.current.play().catch(console.error);
    }
  };

  const handleSeek = (delta: number) => {
    if (!audioElementRef.current) return;
    const target = Math.max(0, Math.min(duration, audioElementRef.current.currentTime + delta));
    audioElementRef.current.currentTime = target;
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl space-y-4 backdrop-blur-md">
      {/* Top Bar: Timers, A/B Toggle, and Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-lg font-bold text-emerald-400">
            {formatTime(currentTime)}
          </div>
          <span className="text-slate-600 font-mono text-sm">/</span>
          <div className="font-mono text-sm text-slate-400">
            {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Trim Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTrim}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              trimEnabled
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Trim Region {trimEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* A/B Compare Toggle */}
          <button
            type="button"
            onClick={onToggleBypass}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition shadow-sm ${
              isBypassed
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 ring-1 ring-amber-500/30'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/30'
            }`}
            title="Toggle Original vs Processed Audio (Keyboard: B)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isBypassed ? 'Original (Dry)' : 'Processed (DSP)'}</span>
            <kbd className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-400 font-mono border border-slate-800">
              B
            </kbd>
          </button>

          {/* Zoom Slider */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="range"
              min="0"
              max="100"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-16 h-1 accent-emerald-500"
              title="Waveform zoom level"
            />
          </div>
        </div>
      </div>

      {/* Waveform Canvas Container */}
      <div className="relative rounded-xl bg-slate-950/80 border border-slate-800/80 p-2 overflow-hidden shadow-inner">
        {/* Visual Trim Region Overlay if enabled */}
        {trimEnabled && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/15 border-x-2 border-emerald-400 pointer-events-none z-10"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${Math.max(0, ((trimEnd - trimStart) / duration) * 100)}%`,
            }}
          />
        )}
        <div ref={containerRef} className="cursor-pointer" />
      </div>

      {/* Playback Controls & Seek */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* -5s Seek */}
          <button
            type="button"
            onClick={() => handleSeek(-5)}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Rewind 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 ml-0.5" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* +5s Seek */}
          <button
            type="button"
            onClick={() => handleSeek(5)}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Forward 5 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Trim boundary controls */}
        {trimEnabled && (
          <div className="flex items-center gap-3 text-xs bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-medium">Trim Start:</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max={trimEnd}
              value={trimStart}
              onChange={(e) => onTrimChange(parseFloat(e.target.value) || 0, trimEnd)}
              className="w-16 h-6 px-1.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-mono text-xs"
            />
            <span className="text-slate-400 font-medium ml-2">End:</span>
            <input
              type="number"
              step="0.1"
              min={trimStart}
              max={duration}
              value={trimEnd}
              onChange={(e) => onTrimChange(trimStart, parseFloat(e.target.value) || duration)}
              className="w-16 h-6 px-1.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-mono text-xs"
            />
            <span className="text-slate-500 font-mono text-[11px]">sec</span>
          </div>
        )}
      </div>
    </div>
  );
}
