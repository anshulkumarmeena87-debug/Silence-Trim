import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-6 text-xs text-slate-500">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>
            Client-Side Privacy: Audio processing is performed locally in browser memory via Web Audio API. No audio is ever uploaded to a server.
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1.5">
            <Cpu size={14} className="text-indigo-400" />
            16-bit PCM RIFF Audio Engine
          </span>
          <span>·</span>
          <span>SilenceTrim Studio</span>
        </div>
      </div>
    </footer>
  );
};
