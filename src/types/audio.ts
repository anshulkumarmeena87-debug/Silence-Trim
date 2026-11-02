export interface AudioMetadata {
  name: string;
  sizeBytes: number;
  durationSec: number;
  sampleRate: number;
  numberOfChannels: number;
  format: string;
}

export interface SilenceInterval {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  averageDb: number;
  enabled: boolean;
}

export interface SilenceSettings {
  thresholdDb: number; // e.g. -40 dB
  minDurationMs: number; // e.g. 350 ms
  paddingMs: number; // e.g. 40 ms safety margin before and after speech
  mode: 'remove' | 'truncate'; // 'remove' = complete cut, 'truncate' = shorten to target length
  truncateDurationMs: number; // target duration for kept silence in 'truncate' mode (e.g. 200 ms)
  crossfadeMs: number; // e.g. 6 ms to avoid clicks at splice boundaries
}

export interface ProcessingStats {
  originalDurationSec: number;
  processedDurationSec: number;
  timeSavedSec: number;
  reductionPercentage: number;
  silenceCount: number;
}
