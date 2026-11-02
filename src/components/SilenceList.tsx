import React from 'react';
import { ProcessingStats, SilenceInterval } from '../types/audio';
import { formatTime } from '../utils/audioProcessor';
import { Play, CheckSquare, Square, Download, FileText, CheckCircle2 } from 'lucide-react';

interface SilenceListProps {
  silenceIntervals: SilenceInterval[];
  stats: ProcessingStats | null;
  onToggleSilence: (id: string) => void;
  onToggleAll: (enabled: boolean) => void;
  onPreviewSilence: (startSec: number, endSec: number) => void;
  activeSilenceId: string | null;
}

export const SilenceList: React.FC<SilenceListProps> = ({
  silenceIntervals,
  stats,
  onToggleSilence,
  onToggleAll,
  onPreviewSilence,
  activeSilenceId,
}) => {
  const allEnabled = silenceIntervals.length > 0 && silenceIntervals.every((s) => s.enabled);
  const someEnabled = silenceIntervals.some((s) => s.enabled);

  // Export silence intervals as Audacity label track (start \t end \t label)
  const exportAudacityLabels = () => {
    let content = '';
    silenceIntervals.forEach((s) => {
      content += `${s.startSec.toFixed(6)}\t${s.endSec.toFixed(6)}\tSilence_${s.index}_(${s.durationSec.toFixed(2)}s)\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'silence_markers_audacity.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportJson = () => {
    const data = JSON.stringify(silenceIntervals, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detected_silences.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-sm flex flex-col gap-4">
      {/* Stats summary banner */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Original Length
            </span>
            <span className="text-sm font-semibold font-mono tabular-nums text-slate-200 mt-0.5">
              {formatTime(stats.originalDurationSec)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Cleaned Length
            </span>
            <span className="text-sm font-semibold font-mono tabular-nums text-emerald-400 mt-0.5">
              {formatTime(stats.processedDurationSec)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Dead Air Cut
            </span>
            <span className="text-sm font-semibold font-mono tabular-nums text-rose-400 mt-0.5">
              -{stats.timeSavedSec.toFixed(2)}s
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Reduction
            </span>
            <span className="text-sm font-semibold font-mono tabular-nums text-indigo-400 mt-0.5">
              {stats.reductionPercentage}% shorter
            </span>
          </div>
        </div>
      )}

      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Detected Silent Segments ({silenceIntervals.length})
          </h3>
          {silenceIntervals.length > 0 && (
            <button
              onClick={() => onToggleAll(!allEnabled)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              {allEnabled ? <CheckSquare size={13} className="text-indigo-400" /> : <Square size={13} />}
              {allEnabled ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {silenceIntervals.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportAudacityLabels}
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 flex items-center gap-1.5 transition-colors"
              title="Download Audacity / DAW label track"
            >
              <FileText size={12} />
              Audacity Labels
            </button>
            <button
              onClick={exportJson}
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 flex items-center gap-1.5 transition-colors"
              title="Download raw silence timestamps as JSON"
            >
              <Download size={12} />
              JSON
            </button>
          </div>
        )}
      </div>

      {/* Silence items table / list */}
      {silenceIntervals.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs">
          No silent pauses detected above the selected threshold. Try lowering the threshold or minimum duration slider.
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {silenceIntervals.map((silence) => {
            const isActive = activeSilenceId === silence.id;
            return (
              <div
                key={silence.id}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : silence.enabled
                    ? 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                    : 'border-slate-900 bg-slate-950/30 text-slate-500 opacity-60'
                }`}
              >
                {/* Left: Checkbox & Number */}
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={silence.enabled}
                    onChange={() => onToggleSilence(silence.id)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="font-mono text-slate-400 font-semibold w-5 text-right">
                    #{silence.index}
                  </span>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-slate-300">
                      {formatTime(silence.startSec)}
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-300">
                      {formatTime(silence.endSec)}
                    </span>
                  </div>
                </div>

                {/* Right: Duration, dB and Preview button */}
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40">
                    {silence.durationSec.toFixed(2)}s pause
                  </span>
                  <span className="font-mono tabular-nums text-slate-500 text-[11px] hidden sm:inline-block">
                    {silence.averageDb} dB
                  </span>
                  <button
                    onClick={() => onPreviewSilence(silence.startSec, silence.endSec)}
                    title="Preview this silence segment"
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  >
                    <Play size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
