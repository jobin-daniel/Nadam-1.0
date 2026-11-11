'use client';

import React, { useState } from 'react';
import { AudioEditSettings, VoicePreset } from '@/lib/types/audio';
import { VOICE_PRESETS } from '@/lib/audio/presets';
import { Sparkles, SlidersHorizontal, ChevronDown, ChevronUp, Mic } from 'lucide-react';

interface VoiceEnhancePanelProps {
  settings: AudioEditSettings['voiceEnhance'];
  onChange: (updated: Partial<AudioEditSettings['voiceEnhance']>) => void;
}

export function VoiceEnhancePanel({ settings, onChange }: VoiceEnhancePanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleApplyPreset = (preset: VoicePreset) => {
    const p = VOICE_PRESETS[preset];
    onChange({
      preset,
      highpassFreq: p.highpassFreq,
      noiseReductionStrength: p.noiseReductionStrength,
      presenceBoostDb: p.presenceBoostDb,
      deEsserCutDb: p.deEsserCutDb,
      compressionRatio: p.compressionRatio,
      normalizeTargetLufs: p.normalizeTargetLufs,
    });
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl space-y-5 backdrop-blur-md">
      {/* Header & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Voice Enhance & Studio Clarity</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Noise removal, rumble cutoff, presence EQ, de-essing, voice compression & -16 LUFS mastering
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['podcast', 'lecture', 'noisy', 'music'] as VoicePreset[]).map((p) => {
            const isSelected = settings.preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'noisy' ? 'Phone/Noisy' : p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Intensity Slider */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">Enhance Intensity</span>
          <span className="font-mono text-emerald-400 font-bold">
            {Math.round(settings.intensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.intensity}
          disabled={!settings.enabled}
          onChange={(e) => onChange({ intensity: parseFloat(e.target.value) })}
          className="w-full h-2 accent-emerald-500 cursor-pointer disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Subtle (0%)</span>
          <span>Balanced (50%)</span>
          <span>Maximum (100%)</span>
        </div>
      </div>

      {/* Advanced Fine Tuning Accordion */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition py-1"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Advanced Voice DSP Settings</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 mt-2">
            {/* Target LUFS */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 block font-medium">Target LUFS</label>
              <select
                value={settings.normalizeTargetLufs}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ normalizeTargetLufs: parseFloat(e.target.value) })}
                className="w-full h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="-16">-16 LUFS (Podcast & Web Standard)</option>
                <option value="-14">-14 LUFS (Streaming / YouTube)</option>
                <option value="-18">-18 LUFS (Spoken Word)</option>
                <option value="-23">-23 LUFS (Broadcast EBU R128)</option>
              </select>
            </div>

            {/* Highpass Rumble */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Rumble Filter (HPF)</span>
                <span className="font-mono text-emerald-400">{settings.highpassFreq} Hz</span>
              </div>
              <input
                type="range"
                min="40"
                max="160"
                step="5"
                value={settings.highpassFreq}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ highpassFreq: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-emerald-500"
              />
            </div>

            {/* Presence Boost */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Presence (~3 kHz)</span>
                <span className="font-mono text-emerald-400">+{settings.presenceBoostDb} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={settings.presenceBoostDb}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ presenceBoostDb: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-emerald-500"
              />
            </div>

            {/* De-Esser Cut */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>De-Esser (~8 kHz)</span>
                <span className="font-mono text-emerald-400">{settings.deEsserCutDb} dB</span>
              </div>
              <input
                type="range"
                min="-8"
                max="0"
                step="0.5"
                value={settings.deEsserCutDb}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ deEsserCutDb: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-emerald-500"
              />
            </div>

            {/* Compression Ratio */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Compressor Ratio</span>
                <span className="font-mono text-emerald-400">{settings.compressionRatio}:1</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="8"
                step="0.5"
                value={settings.compressionRatio}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ compressionRatio: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-emerald-500"
              />
            </div>

            {/* Noise Reduction Strength */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Noise Filter (afftdn)</span>
                <span className="font-mono text-emerald-400">{Math.round(settings.noiseReductionStrength * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.noiseReductionStrength}
                disabled={!settings.enabled}
                onChange={(e) => onChange({ noiseReductionStrength: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-emerald-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
