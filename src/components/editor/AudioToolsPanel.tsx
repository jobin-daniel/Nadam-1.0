'use client';

import React from 'react';
import { Volume2, Sliders, Scissors, ArrowDownUp, Disc3 } from 'lucide-react';
import { AudioEditSettings } from '@/lib/types/audio';

interface AudioToolsPanelProps {
  settings: AudioEditSettings;
  onChangeFades: (updated: Partial<AudioEditSettings['fades']>) => void;
  onChangeVolume: (updated: Partial<AudioEditSettings['volume']>) => void;
  onChangeTone: (updated: Partial<AudioEditSettings['tone']>) => void;
  onChangeSilence: (updated: Partial<AudioEditSettings['silenceRemoval']>) => void;
  onChangeChannels: (channels: AudioEditSettings['channels']) => void;
}

export function AudioToolsPanel({
  settings,
  onChangeFades,
  onChangeVolume,
  onChangeTone,
  onChangeSilence,
  onChangeChannels,
}: AudioToolsPanelProps) {
  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl space-y-6 backdrop-blur-md">
      <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
        <Sliders className="w-4 h-4 text-emerald-400" />
        <span>Audio Production & Mastering Tools</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Volume & Peak Normalize */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Volume Gain</span>
            <span className="font-mono text-xs text-emerald-400 font-bold">
              {settings.volume.gainDb > 0 ? `+${settings.volume.gainDb}` : settings.volume.gainDb} dB
            </span>
          </div>

          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={settings.volume.gainDb}
            onChange={(e) => onChangeVolume({ gainDb: parseFloat(e.target.value) })}
            className="w-full h-1.5 accent-emerald-500"
          />

          <label className="flex items-center gap-2 text-[11px] text-slate-300 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.volume.peakNormalize}
              onChange={(e) => onChangeVolume({ peakNormalize: e.target.checked })}
              className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Peak Normalize (0 dBFS)</span>
          </label>
        </div>

        {/* 2. Quick Tone (Bass & Treble Shelves) */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-300 block">Quick Tone Shelves</span>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Bass Shelf</span>
              <span className="font-mono text-emerald-400">
                {settings.tone.bassBoostDb > 0 ? `+${settings.tone.bassBoostDb}` : settings.tone.bassBoostDb} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={settings.tone.bassBoostDb}
              onChange={(e) => onChangeTone({ bassBoostDb: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Treble Shelf</span>
              <span className="font-mono text-emerald-400">
                {settings.tone.trebleBoostDb > 0 ? `+${settings.tone.trebleBoostDb}` : settings.tone.trebleBoostDb} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={settings.tone.trebleBoostDb}
              onChange={(e) => onChangeTone({ trebleBoostDb: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-emerald-500"
            />
          </div>
        </div>

        {/* 3. Fades (Fade In & Fade Out) */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-300 block">Fades (Seconds)</span>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Fade In</span>
              <span className="font-mono text-emerald-400">{settings.fades.fadeInSeconds}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={settings.fades.fadeInSeconds}
              onChange={(e) => onChangeFades({ fadeInSeconds: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Fade Out</span>
              <span className="font-mono text-emerald-400">{settings.fades.fadeOutSeconds}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={settings.fades.fadeOutSeconds}
              onChange={(e) => onChangeFades({ fadeOutSeconds: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-emerald-500"
            />
          </div>
        </div>

        {/* 4. Silence Removal & Channels */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Silence Removal</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.silenceRemoval.enabled}
                onChange={(e) => onChangeSilence({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Threshold:</span>
            <select
              value={settings.silenceRemoval.thresholdDb}
              disabled={!settings.silenceRemoval.enabled}
              onChange={(e) => onChangeSilence({ thresholdDb: parseFloat(e.target.value) })}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
            >
              <option value="-40">-40 dB</option>
              <option value="-50">-50 dB (Standard)</option>
              <option value="-60">-60 dB</option>
            </select>
          </div>

          {/* Channel layout */}
          <div className="pt-1 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1 font-medium">Channel Mode</span>
            <div className="grid grid-cols-3 gap-1">
              {(['original', 'stereo', 'mono'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onChangeChannels(ch)}
                  className={`py-1 rounded text-[11px] capitalize font-medium transition ${
                    settings.channels === ch
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
