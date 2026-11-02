import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Repeat,
  Sparkles,
  Layers,
} from 'lucide-react';
import { formatTime } from '../utils/audioProcessor';

interface AudioPlayerProps {
  originalBuffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
  activeTrack: 'original' | 'processed';
  onTrackChange: (track: 'original' | 'processed') => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  originalBuffer,
  processedBuffer,
  activeTrack,
  onTrackChange,
  currentTime,
  onTimeUpdate,
  onSeek,
  isPlaying,
  setIsPlaying,
}) => {
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const currentBuffer = activeTrack === 'processed' ? processedBuffer : originalBuffer;
  const currentDuration = currentBuffer ? currentBuffer.duration : 0;

  // Initialize AudioContext
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass && !audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        isMuted ? 0 : volume,
        audioCtxRef.current.currentTime
      );
    }
  }, [volume, isMuted]);

  // Stop playback node
  const stopAudioSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Start playback node
  const startAudioSource = useCallback(
    (offsetSec: number) => {
      stopAudioSource();

      if (!currentBuffer || !audioCtxRef.current) return;
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const ctx = audioCtxRef.current;
      const source = ctx.createBufferSource();
      source.buffer = currentBuffer;
      source.playbackRate.value = playbackRate;
      source.loop = isLooping;

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      sourceNodeRef.current = source;
      gainNodeRef.current = gain;

      const clampedOffset = Math.max(0, Math.min(offsetSec, currentBuffer.duration));
      startTimeRef.current = ctx.currentTime;
      startOffsetRef.current = clampedOffset;

      source.start(0, clampedOffset);
      setIsPlaying(true);

      source.onended = () => {
        if (!isLooping && sourceNodeRef.current === source) {
          setIsPlaying(false);
          onTimeUpdate(0);
          startOffsetRef.current = 0;
        }
      };

      // Animation loop for smooth playhead updating
      const updateLoop = () => {
        if (sourceNodeRef.current === source && ctx) {
          const elapsed = (ctx.currentTime - startTimeRef.current) * playbackRate;
          let newTime = startOffsetRef.current + elapsed;

          if (isLooping && currentBuffer.duration > 0) {
            newTime = newTime % currentBuffer.duration;
          } else if (newTime >= currentBuffer.duration) {
            newTime = currentBuffer.duration;
            setIsPlaying(false);
          }

          onTimeUpdate(newTime);
          if (newTime < currentBuffer.duration || isLooping) {
            animFrameRef.current = requestAnimationFrame(updateLoop);
          }
        }
      };

      animFrameRef.current = requestAnimationFrame(updateLoop);
    },
    [currentBuffer, isLooping, isMuted, onTimeUpdate, playbackRate, setIsPlaying, stopAudioSource, volume]
  );

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!currentBuffer) return;

    if (isPlaying) {
      stopAudioSource();
      setIsPlaying(false);
    } else {
      let resumeTime = currentTime;
      if (resumeTime >= currentDuration - 0.05) {
        resumeTime = 0;
      }
      startAudioSource(resumeTime);
    }
  };

  // Keyboard shortcut: Spacebar to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, currentDuration, currentBuffer]);

  // Restart
  const handleRestart = () => {
    onSeek(0);
    if (isPlaying) {
      startAudioSource(0);
    }
  };

  // Skip backward 5s
  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 5);
    onSeek(newTime);
    if (isPlaying) {
      startAudioSource(newTime);
    }
  };

  // Skip forward 5s
  const handleSkipForward = () => {
    const newTime = Math.min(currentDuration, currentTime + 5);
    onSeek(newTime);
    if (isPlaying) {
      startAudioSource(newTime);
    }
  };

  // Handle manual track change (A/B comparison)
  const handleTrackToggle = (targetTrack: 'original' | 'processed') => {
    if (targetTrack === activeTrack) return;
    const targetBuffer = targetTrack === 'processed' ? processedBuffer : originalBuffer;
    if (!targetBuffer) return;

    // Scale proportional time position or clamp
    const ratio = currentDuration > 0 ? currentTime / currentDuration : 0;
    const newTime = Math.min(targetBuffer.duration, ratio * targetBuffer.duration);

    onTrackChange(targetTrack);
    onSeek(newTime);

    if (isPlaying) {
      setTimeout(() => {
        startAudioSource(newTime);
      }, 50);
    }
  };

  // Handle Playback rate change
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (sourceNodeRef.current && audioCtxRef.current) {
      sourceNodeRef.current.playbackRate.setValueAtTime(
        rate,
        audioCtxRef.current.currentTime
      );
    }
  };

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-sm flex flex-col gap-4">
      {/* Top row: Track Mode Selector (Original vs Cleaned) & Timecode */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Audio Stream:
          </span>
          <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => handleTrackToggle('original')}
              disabled={!originalBuffer}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTrack === 'original'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              Original with Silence
            </button>
            <button
              onClick={() => handleTrackToggle('processed')}
              disabled={!processedBuffer}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTrack === 'processed'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
              }`}
            >
              <Sparkles size={13} />
              Cleaned (Silence Removed)
            </button>
          </div>
        </div>

        {/* Big Timecode */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Position:</span>
          <div className="font-mono tabular-nums text-lg font-semibold text-white px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
            {formatTime(currentTime)}
            <span className="text-slate-500 font-normal text-sm">
              {' '}/ {formatTime(currentDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Scrub bar */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono tabular-nums text-slate-400 w-12 text-right">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={currentDuration || 1}
          step={0.01}
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            onSeek(time);
            if (isPlaying) {
              startAudioSource(time);
            }
          }}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
        />
        <span className="text-[11px] font-mono tabular-nums text-slate-400 w-12">
          {formatTime(currentDuration)}
        </span>
      </div>

      {/* Bottom controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-slate-800/80">
        {/* Playback action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            title="Restart to beginning"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleSkipBack}
            title="Rewind 5 seconds"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Rewind size={16} />
          </button>
          <button
            onClick={togglePlay}
            disabled={!currentBuffer}
            className={`p-3 rounded-full text-white transition-all shadow-md flex items-center justify-center ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            } disabled:opacity-40`}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
          </button>
          <button
            onClick={handleSkipForward}
            title="Fast forward 5 seconds"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <FastForward size={16} />
          </button>
          <button
            onClick={() => setIsLooping(!isLooping)}
            title="Loop playback"
            className={`p-2 rounded-lg transition-colors ${
              isLooping
                ? 'text-indigo-400 bg-indigo-950/60 border border-indigo-800/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* Speed and Volume */}
        <div className="flex items-center gap-4">
          {/* Speed selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Speed:</span>
            <div className="flex items-center bg-slate-950 rounded-md border border-slate-800 p-0.5">
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium font-mono tabular-nums transition-colors ${
                    playbackRate === rate
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
