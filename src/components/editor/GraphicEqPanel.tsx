'use client';

import React, { useRef, useEffect, useState } from 'react';
import { EqBands } from '@/lib/types/audio';
import { EQ_PRESETS } from '@/lib/audio/presets';
import { EQ_FREQUENCIES } from '@/lib/audio/webaudio-graph';
import { RotateCcw, Bookmark, Trash2, Plus } from 'lucide-react';

interface GraphicEqPanelProps {
  bands: EqBands;
  onChangeBand: (freq: keyof EqBands, val: number) => void;
  onApplyPreset: (bands: EqBands, presetName: string) => void;
  onReset: () => void;
  calculateCurve?: (freqs: Float32Array) => Float32Array;
  enabled: boolean;
  onToggleEnabled: () => void;
}

export function GraphicEqPanel({
  bands,
  onChangeBand,
  onApplyPreset,
  onReset,
  calculateCurve,
  enabled,
  onToggleEnabled,
}: GraphicEqPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [customPresets, setCustomPresets] = useState<Array<{ id: string; name: string; data: EqBands }>>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Fetch saved custom presets
  const fetchCustomPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      if (data.presets) {
        setCustomPresets(data.presets.filter((p: any) => p.type === 'eq'));
      }
    } catch {}
  };

  useEffect(() => {
    fetchCustomPresets();
  }, []);

  // Draw the smooth frequency response curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background grid lines (-12dB, -6dB, 0dB, +6dB, +12dB)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const dbLevels = [-12, -6, 0, 6, 12];
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';

    for (const db of dbLevels) {
      // Map dB to Y: +12dB -> 10px, 0dB -> height/2, -12dB -> height - 10px
      const y = height / 2 - (db / 12) * (height / 2 - 12);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      if (db === 0) {
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.strokeStyle = '#1e293b';
      }

      ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 6, y - 3);
    }

    if (!enabled) {
      // Flat line when disabled
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Generate logarithmic sample points across spectrum: 20 Hz to 20,000 Hz
    const numPoints = 128;
    const freqs = new Float32Array(numPoints);
    const minF = Math.log10(20);
    const maxF = Math.log10(20000);

    for (let i = 0; i < numPoints; i++) {
      const logF = minF + (i / (numPoints - 1)) * (maxF - minF);
      freqs[i] = Math.pow(10, logF);
    }

    let dbResponses: Float32Array;

    if (calculateCurve) {
      dbResponses = calculateCurve(freqs);
    } else {
      // Direct mathematical approximation based on peaking filters
      dbResponses = new Float32Array(numPoints);
      for (let i = 0; i < numPoints; i++) {
        const f = freqs[i];
        let totalDb = 0;
        for (const center of EQ_FREQUENCIES) {
          const gain = bands[center] || 0;
          if (gain !== 0) {
            const ratio = Math.log2(f / center);
            const bandwidth = 1.0; // octaves
            const weight = Math.exp(-0.5 * Math.pow(ratio / (bandwidth * 0.5), 2));
            totalDb += gain * weight;
          }
        }
        dbResponses[i] = totalDb;
      }
    }

    // Draw smooth response curve
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * width;
      const db = Math.max(-14, Math.min(14, dbResponses[i]));
      const y = height / 2 - (db / 12) * (height / 2 - 12);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Subtle gradient fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.fillStyle = gradient;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }, [bands, enabled, calculateCurve]);

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'eq',
          name: newPresetName.trim(),
          data: bands,
        }),
      });
      setNewPresetName('');
      setShowSavePrompt(false);
      fetchCustomPresets();
    } catch {}
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/presets?id=${id}`, { method: 'DELETE' });
      fetchCustomPresets();
    } catch {}
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl space-y-5 backdrop-blur-md">
      {/* Header, Enable Toggle, Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={onToggleEnabled}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
          <h3 className="text-sm font-bold text-white tracking-wide">
            10-Band Graphic Equalizer (±12 dB)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Selector */}
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (EQ_PRESETS[val]) {
                onApplyPreset(EQ_PRESETS[val], val);
              } else {
                const custom = customPresets.find((p) => p.id === val);
                if (custom) onApplyPreset(custom.data, custom.name);
              }
            }}
            className="h-8 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="flat">Preset: Flat</option>
            <option value="bass_boost">Bass Boost</option>
            <option value="treble_boost">Treble Boost</option>
            <option value="vocal_boost">Vocal Boost</option>
            <option value="speech_clarity">Speech Clarity</option>
            <option value="loudness">Loudness</option>
            <option value="reduce_muddiness">Reduce Muddiness</option>
            {customPresets.length > 0 && (
              <optgroup label="Custom Presets">
                {customPresets.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Save Preset */}
          <button
            type="button"
            onClick={() => setShowSavePrompt(!showSavePrompt)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Save custom preset"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition"
            title="Reset EQ to flat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Save Preset Prompt */}
      {showSavePrompt && (
        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center gap-2">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset Name (e.g. My Vocal EQ)..."
            className="flex-1 h-8 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Save
          </button>
        </div>
      )}

      {/* Dynamic Smooth Frequency Response Canvas */}
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2 overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={700}
          height={100}
          className="w-full h-24 block"
        />
      </div>

      {/* 10 Vertical Sliders */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 sm:gap-4 pt-1">
        {EQ_FREQUENCIES.map((freq) => {
          const val = bands[freq] || 0;
          const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;

          return (
            <div key={freq} className="flex flex-col items-center space-y-2">
              <span className="font-mono text-[10px] text-slate-400">
                {val > 0 ? `+${val}` : val} dB
              </span>

              {/* Vertical Slider wrapper */}
              <div className="relative h-32 flex items-center justify-center">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={val}
                  disabled={!enabled}
                  onChange={(e) => onChangeBand(freq, parseFloat(e.target.value))}
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                  }}
                  className="w-2 h-28 accent-emerald-500 cursor-pointer disabled:opacity-40"
                  aria-label={`${label} Hz EQ band gain`}
                />
              </div>

              <span className="font-mono text-xs font-bold text-slate-300">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
