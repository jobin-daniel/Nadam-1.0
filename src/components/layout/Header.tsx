'use client';

import React from 'react';
import { Music2, Download, Sliders, Library, Shield, Sun, Moon, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { SystemEnvironmentStatus } from '@/lib/security/binaries';

interface HeaderProps {
  activeTab: 'download' | 'bulk' | 'editor' | 'library';
  onTabChange: (tab: 'download' | 'bulk' | 'editor' | 'library') => void;
  envStatus: SystemEnvironmentStatus | null;
  onOpenLegal: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  envStatus,
  onOpenLegal,
  isDark,
  onToggleTheme,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">Video2MP3</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRO DSP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Audio Ingestion & Mastering Suite</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onTabChange('download')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'download'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            onClick={() => onTabChange('bulk')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'bulk'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Bulk Convert</span>
          </button>

          <button
            onClick={() => onTabChange('editor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'editor'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Audio Editor</span>
          </button>

          <button
            onClick={() => onTabChange('library')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'library'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>
        </nav>

        {/* Actions & Status */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {envStatus && (
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${
                envStatus.ready
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
              }`}
            >
              {envStatus.ready ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Engines Ready</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Engine Setup</span>
                </>
              )}
            </div>
          )}

          {/* Legal Notice */}
          <button
            onClick={onOpenLegal}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
            title="Terms & Legal Notice"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Dark/Light mode */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
