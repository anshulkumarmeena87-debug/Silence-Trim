import React from 'react';
import { SilenceSettings } from '../types/audio';
import { Sliders, Scissors, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

interface SilenceControlsProps {
  settings: SilenceSettings;
  onChange: (settings: SilenceSettings) => void;
  onProcess: () => void;
  isProcessing: boolean;
  disabled: boolean;
}

export const SilenceControls: React.FC<SilenceControlsProps> = ({
  settings,
  onChange,
  onProcess,
  isProcessing,
  disabled,
}) => {
  const updateSetting = <K extends keyof SilenceSettings>(key: K, value: SilenceSettings[K]) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const handleResetDefaults = () => {
    onChange({
      thresholdDb: -40,
      minDurationMs: 350,
      paddingMs: 40,
      mode: 'remove',
      truncateDurationMs: 250,
      crossfadeMs: 6,
    });
  };

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
            Silence Detection & Removal Parameters
          </h2>
        </div>
        <button
          onClick={handleResetDefaults}
          disabled={disabled || isProcessing}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Threshold dB */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200">
              Silence Threshold (dB)
            </label>
            <span className="text-xs font-mono tabular-nums text-indigo-400 font-semibold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/50">
              {settings.thresholdDb} dB
            </span>
          </div>
          <input
            type="range"
            min={-65}
            max={-15}
            step={1}
            value={settings.thresholdDb}
            disabled={disabled}
            onChange={(e) => updateSetting('thresholdDb', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>-65 dB (High sensitivity)</span>
            <span>-40 dB (Recommended)</span>
            <span>-15 dB (Aggressive)</span>
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Audio frames below this energy level are considered silent pauses.
          </p>
        </div>

        {/* Min Duration */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200">
              Minimum Silence Duration
            </label>
            <span className="text-xs font-mono tabular-nums text-indigo-400 font-semibold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/50">
              {settings.minDurationMs} ms ({(settings.minDurationMs / 1000).toFixed(2)}s)
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={25}
            value={settings.minDurationMs}
            disabled={disabled}
            onChange={(e) => updateSetting('minDurationMs', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
          />
          <div className="flex items-center gap-1.5 pt-0.5">
            {[200, 350, 600, 1000].map((ms) => (
              <button
                key={ms}
                onClick={() => updateSetting('minDurationMs', ms)}
                disabled={disabled}
                className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  settings.minDurationMs === ms
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-950/40'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200 bg-slate-950'
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Pauses shorter than this duration will remain intact.
          </p>
        </div>

        {/* Safety Padding (Margin) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200">
              Safety Padding Margin
            </label>
            <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
              {settings.paddingMs} ms
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={150}
            step={5}
            value={settings.paddingMs}
            disabled={disabled}
            onChange={(e) => updateSetting('paddingMs', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
          />
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Protects word attacks, vocal consonant plosives (e.g. &apos;t&apos;, &apos;p&apos;), and natural decay tails.
          </p>
        </div>

        {/* Processing Mode */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-200">
            Trimming Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateSetting('mode', 'remove')}
              disabled={disabled}
              className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                settings.mode === 'remove'
                  ? 'border-indigo-500 bg-indigo-950/40 text-slate-100'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-300">
                <Scissors size={14} />
                Remove Completely
              </div>
              <span className="text-[11px] text-slate-400 leading-tight">
                Splices spoken chunks directly with zero gap.
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateSetting('mode', 'truncate')}
              disabled={disabled}
              className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                settings.mode === 'truncate'
                  ? 'border-indigo-500 bg-indigo-950/40 text-slate-100'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-300">
                <Sparkles size={14} />
                Compress to Natural Pause
              </div>
              <span className="text-[11px] text-slate-400 leading-tight">
                Shortens long dead-air pauses to {settings.truncateDurationMs}ms.
              </span>
            </button>
          </div>

          {settings.mode === 'truncate' && (
            <div className="mt-2 flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-300">Target pause length:</span>
              <div className="flex items-center gap-1">
                {[150, 250, 400].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => updateSetting('truncateDurationMs', ms)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                      settings.truncateDurationMs === ms
                        ? 'border-indigo-500 bg-indigo-900/60 text-white'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    {ms}ms
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Process CTA Button */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
        <button
          onClick={onProcess}
          disabled={disabled || isProcessing}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors shadow-md flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
        >
          {isProcessing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing & Processing Audio...</span>
            </>
          ) : (
            <>
              <Scissors size={15} />
              <span>Apply & Remove Silence</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
