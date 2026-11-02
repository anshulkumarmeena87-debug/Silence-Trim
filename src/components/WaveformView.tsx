import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SilenceInterval } from '../types/audio';
import { formatTime } from '../utils/audioProcessor';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface WaveformViewProps {
  audioBuffer: AudioBuffer | null;
  silenceIntervals: SilenceInterval[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  title: string;
  isProcessed?: boolean;
}

export const WaveformView: React.FC<WaveformViewProps> = ({
  audioBuffer,
  silenceIntervals,
  currentTime,
  duration,
  onSeek,
  title,
  isProcessed = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x, 2x, 4x, 8x
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  // Downsample waveform peaks for smooth canvas rendering
  const peaks = useMemo(() => {
    if (!audioBuffer) return [];

    const numPoints = 1200 * zoomLevel;
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channelData.length / numPoints));
    const extractedPeaks: { min: number; max: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      let min = 0;
      let max = 0;

      for (let j = start; j < end; j++) {
        const val = channelData[j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      extractedPeaks.push({ min, max });
    }
    return extractedPeaks;
  }, [audioBuffer, zoomLevel]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const topGridY = height * 0.25;
    const bottomGridY = height * 0.75;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, topGridY);
    ctx.lineTo(width, topGridY);
    ctx.moveTo(0, bottomGridY);
    ctx.lineTo(width, bottomGridY);
    ctx.stroke();

    // Draw Time Grid / Ruler marks
    const timeStepSec = duration > 60 ? 10 : duration > 20 ? 5 : 2;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';

    for (let t = 0; t <= duration; t += timeStepSec) {
      const x = (t / duration) * width;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillText(formatTime(t).substring(0, 5), x + 4, 14);
    }

    // Highlight detected silence zones if this is the original track
    if (!isProcessed && silenceIntervals.length > 0) {
      for (const silence of silenceIntervals) {
        if (!silence.enabled) continue;
        const startX = (silence.startSec / duration) * width;
        const endX = (silence.endSec / duration) * width;
        const silenceWidth = Math.max(2, endX - startX);

        // Translucent amber / rose strip
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.fillRect(startX, 0, silenceWidth, height);

        // Boundary lines
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label if wide enough
        if (silenceWidth > 45) {
          ctx.fillStyle = 'rgba(252, 165, 165, 0.85)';
          ctx.font = '10px JetBrains Mono, monospace';
          const label = `-${silence.durationSec.toFixed(1)}s`;
          ctx.fillText(label, startX + 4, height - 8);
        }
      }
    }

    // Draw Audio Waveform Bars / Envelopes
    const barWidth = width / peaks.length;
    const centerY = height / 2;
    const maxAmplitudeHeight = height * 0.44;

    for (let i = 0; i < peaks.length; i++) {
      const { min, max } = peaks[i];
      const x = i * barWidth;
      const barTop = centerY - max * maxAmplitudeHeight;
      const barBottom = centerY - min * maxAmplitudeHeight;
      const barH = Math.max(1.5, barBottom - barTop);

      const sampleTime = (i / peaks.length) * duration;
      const isPlayed = sampleTime <= currentTime;

      if (isProcessed) {
        // Emerald / Teal for clean processed audio
        ctx.fillStyle = isPlayed ? '#10b981' : 'rgba(52, 211, 153, 0.45)';
      } else {
        // Indigo / Sky for original audio
        ctx.fillStyle = isPlayed ? '#6366f1' : 'rgba(129, 140, 248, 0.45)';
      }

      ctx.fillRect(x, barTop, Math.max(1, barWidth - 0.5), barH);
    }

    // Draw Playhead scrubber cursor
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;

      // Glow beam
      const glow = ctx.createLinearGradient(playheadX - 6, 0, playheadX + 6, 0);
      glow.addColorStop(0, 'rgba(244, 63, 94, 0)');
      glow.addColorStop(0.5, 'rgba(244, 63, 94, 0.25)');
      glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(playheadX - 6, 0, 12, height);

      // Playhead vertical line
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead handle marker at top
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Hover time indicator
    if (hoverTime !== null && isHovering) {
      const hoverX = (hoverTime / duration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [audioBuffer, peaks, silenceIntervals, currentTime, duration, isProcessed, hoverTime, isHovering]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = Math.max(0, Math.min(duration, (clickX / rect.width) * duration));
    onSeek(seekTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const time = (mouseX / rect.width) * duration;
    setHoverTime(time);
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setHoverTime(null);
  };

  return (
    <div className="flex flex-col rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-slate-200">
            {title}
          </span>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          {!isProcessed && silenceIntervals.length > 0 && (
            <span className="text-xs text-rose-400 flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              {silenceIntervals.filter((s) => s.enabled).length} Silent Zones
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setZoomLevel((z) => Math.max(1, z / 2))}
            disabled={zoomLevel <= 1}
            aria-label="Zoom Out"
            className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[11px] font-mono tabular-nums px-1 text-slate-300">
            {zoomLevel}x
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(8, z * 2))}
            disabled={zoomLevel >= 8}
            aria-label="Zoom In"
            className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          {zoomLevel > 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
              className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas container with horizontal scroll for zoomed state */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto relative rounded-lg border border-slate-800/80 bg-[#090d16]"
      >
        <div
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
          className="relative"
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full h-32 cursor-pointer block select-none"
          />
          {isHovering && hoverTime !== null && (
            <div
              className="absolute top-2 pointer-events-none text-[10px] font-mono tabular-nums bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded shadow border border-slate-700"
              style={{
                left: `${(hoverTime / duration) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
