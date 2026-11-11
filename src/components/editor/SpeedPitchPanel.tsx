'use client';

import React from 'react';
import { FastForward, Gauge, Music } from 'lucide-react';
import { AudioEditSettings } from '@/lib/types/audio';

interface SpeedPitchPanelProps {
  settings: AudioEditSettings['speedPitch'];
  onChange: (updated: Partial<AudioEditSettings['speedPitch']>) => void;
}

const QUICK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

export function SpeedPitchPanel({ settings, onChange }: SpeedPitchPanelProps) {
  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl space-y-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
          <FastForward className="w-4 h-4 text-emerald-400" />
          <span>Playback Speed & Pitch Controls</span>
        </h3>

        {/* Preserve Pitch Toggle */}
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.preservePitch}
            onChange={(e) => onChange({ preservePitch: e.target.checked })}
            className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
          <span>Preserve Pitch (Time-Stretch)</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Speed Section */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              <span>Speed Factor</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {settings.speed.toFixed(2)}x
            </span>
          </div>

          <input
            type="range"
            min="0.25"
            max="4.0"
            step="0.05"
            value={settings.speed}
            onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
            className="w-full h-2 accent-emerald-500 cursor-pointer"
          />

          {/* Quick Buttons */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {QUICK_SPEEDS.map((s) => {
              const isSelected = settings.speed === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ speed: s })}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono font-medium transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Pitch Shift Section */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pitch Shift (Semitones)</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {settings.pitchSemitones > 0 ? `+${settings.pitchSemitones}` : settings.pitchSemitones} st
            </span>
          </div>

          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settings.pitchSemitones}
            onChange={(e) => onChange({ pitchSemitones: parseInt(e.target.value, 10) })}
            className="w-full h-2 accent-emerald-500 cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>-1 Octave (-12)</span>
            <button
              type="button"
              onClick={() => onChange({ pitchSemitones: 0 })}
              className="text-slate-400 hover:text-white transition"
            >
              Reset (0)
            </button>
            <span>+1 Octave (+12)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
