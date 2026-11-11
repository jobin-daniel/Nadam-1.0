'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LegalNoticeModal({ isOpen, onClose }: LegalNoticeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Terms of Use & Legal Disclaimer</h3>
            <p className="text-xs text-slate-400">Responsible use of Video2MP3</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-4">
          <p>
            Video2MP3 is intended strictly for personal archiving, creative fair use, and media production with content
            that you own, content in the public domain, or content for which you hold explicit permission from the copyright holder.
          </p>
          <p>
            Downloading audio from online streaming providers may violate the host platform&apos;s Terms of Service or copyright laws
            in your jurisdiction.
          </p>
          <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <strong>User Responsibility:</strong> The end user assumes all legal liability for content ingested, processed, and
            distributed using this software. The developers do not host, index, or distribute copyrighted media.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
