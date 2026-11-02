import React from 'react';
import { Volume2, Download, Sparkles } from 'lucide-react';

interface HeaderProps {
  onDownloadWav: () => void;
  canDownload: boolean;
  onLoadDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onDownloadWav,
  canDownload,
  onLoadDemo,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <Volume2 size={18} />
        </div>
        <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
          SilenceTrim
        </span>
      </div>

      {/* Zone 2: 4-5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <a href="#editor" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Audio Editor
        </a>
        <a href="#waveform" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Waveform Analyzer
        </a>
        <a href="#parameters" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Detection Parameters
        </a>
        <a href="#segments" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Silence Segments
        </a>
        <button
          onClick={onLoadDemo}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
        >
          <Sparkles size={13} />
          Load Test Audio
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onDownloadWav}
          disabled={!canDownload}
          className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 shadow-sm disabled:opacity-40 flex items-center gap-1.5"
        >
          <Download size={14} />
          Download WAV
        </button>
      </div>
    </header>
  );
};
