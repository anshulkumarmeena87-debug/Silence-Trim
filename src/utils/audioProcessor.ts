import { AudioMetadata, ProcessingStats, SilenceInterval, SilenceSettings } from '../types/audio';

/**
 * Detect silence regions in an AudioBuffer based on user-defined threshold and duration.
 */
export function detectSilenceIntervals(
  audioBuffer: AudioBuffer,
  settings: SilenceSettings
): SilenceInterval[] {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  
  // 15ms window size for energy calculation
  const hopMs = 15;
  const hopSize = Math.max(1, Math.floor((sampleRate * hopMs) / 1000));
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const minDurationSec = settings.minDurationMs / 1000;
  const thresholdDb = settings.thresholdDb;

  const silences: SilenceInterval[] = [];
  let inSilence = false;
  let silenceStartSample = 0;
  let currentSilenceDbSum = 0;
  let currentSilenceFrames = 0;

  for (let sampleIdx = 0; sampleIdx < totalSamples; sampleIdx += hopSize) {
    const frameLength = Math.min(hopSize, totalSamples - sampleIdx);
    let frameRmsSum = 0;

    // Calculate combined RMS energy across all channels
    for (let c = 0; c < numChannels; c++) {
      const data = channelData[c];
      let sumSq = 0;
      for (let i = 0; i < frameLength; i++) {
        const val = data[sampleIdx + i];
        sumSq += val * val;
      }
      frameRmsSum += Math.sqrt(sumSq / frameLength);
    }

    const avgRms = frameRmsSum / numChannels;
    // Calculate dB with -100 dB noise floor clamp
    const frameDb = avgRms > 1e-5 ? 20 * Math.log10(avgRms) : -100;

    const isFrameSilent = frameDb < thresholdDb;

    if (isFrameSilent) {
      if (!inSilence) {
        inSilence = true;
        silenceStartSample = sampleIdx;
        currentSilenceDbSum = frameDb;
        currentSilenceFrames = 1;
      } else {
        currentSilenceDbSum += frameDb;
        currentSilenceFrames++;
      }
    } else {
      if (inSilence) {
        const silenceEndSample = sampleIdx;
        const durationSec = (silenceEndSample - silenceStartSample) / sampleRate;

        if (durationSec >= minDurationSec) {
          const startSec = silenceStartSample / sampleRate;
          const endSec = silenceEndSample / sampleRate;
          const avgDb = Math.round((currentSilenceDbSum / Math.max(1, currentSilenceFrames)) * 10) / 10;

          silences.push({
            id: `silence-${silences.length + 1}-${Math.round(startSec * 1000)}`,
            index: silences.length + 1,
            startSec,
            endSec,
            durationSec,
            averageDb: avgDb,
            enabled: true,
          });
        }
        inSilence = false;
      }
    }
  }

  // Handle trailing silence at the end of the audio file
  if (inSilence) {
    const silenceEndSample = totalSamples;
    const durationSec = (silenceEndSample - silenceStartSample) / sampleRate;
    if (durationSec >= minDurationSec) {
      const startSec = silenceStartSample / sampleRate;
      const endSec = silenceEndSample / sampleRate;
      const avgDb = Math.round((currentSilenceDbSum / Math.max(1, currentSilenceFrames)) * 10) / 10;

      silences.push({
        id: `silence-${silences.length + 1}-${Math.round(startSec * 1000)}`,
        index: silences.length + 1,
        startSec,
        endSec,
        durationSec,
        averageDb: avgDb,
        enabled: true,
      });
    }
  }

  return silences;
}

interface AudioSegmentRange {
  startSample: number;
  endSample: number;
}

/**
 * Removes or truncates detected silence regions from the audio buffer,
 * applying safety padding and micro-crossfades to prevent clicks.
 */
export function processAudioBuffer(
  audioBuffer: AudioBuffer,
  silenceIntervals: SilenceInterval[],
  settings: SilenceSettings
): { processedBuffer: AudioBuffer; stats: ProcessingStats } {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const originalDurationSec = audioBuffer.duration;

  // Filter only active/enabled silences
  const activeSilences = silenceIntervals.filter((s) => s.enabled);

  if (activeSilences.length === 0) {
    // Return copy of original buffer
    const copyBuffer = new AudioBuffer({
      numberOfChannels: numChannels,
      length: totalSamples,
      sampleRate: sampleRate,
    });
    for (let c = 0; c < numChannels; c++) {
      copyBuffer.copyToChannel(audioBuffer.getChannelData(c), c);
    }
    return {
      processedBuffer: copyBuffer,
      stats: {
        originalDurationSec,
        processedDurationSec: originalDurationSec,
        timeSavedSec: 0,
        reductionPercentage: 0,
        silenceCount: 0,
      },
    };
  }

  const paddingSamples = Math.floor((settings.paddingMs / 1000) * sampleRate);
  const truncateSamples = Math.floor((settings.truncateDurationMs / 1000) * sampleRate);

  // Compute regions to CUT
  interface CutRange {
    start: number;
    end: number;
  }
  const cutRanges: CutRange[] = [];

  for (const silence of activeSilences) {
    const rawStartSample = Math.floor(silence.startSec * sampleRate);
    const rawEndSample = Math.min(totalSamples, Math.floor(silence.endSec * sampleRate));

    if (settings.mode === 'remove') {
      // Keep safety padding around speech
      const effectiveStart = Math.min(rawEndSample, rawStartSample + paddingSamples);
      const effectiveEnd = Math.max(effectiveStart, rawEndSample - paddingSamples);

      if (effectiveEnd > effectiveStart) {
        cutRanges.push({ start: effectiveStart, end: effectiveEnd });
      }
    } else {
      // Truncate mode: shorten silence to target truncateSamples
      const availableSilence = rawEndSample - rawStartSample;
      if (availableSilence > truncateSamples) {
        const cutAmount = availableSilence - truncateSamples;
        // Cut from the center of the silence block
        const halfKept = Math.floor(truncateSamples / 2);
        const cutStart = rawStartSample + halfKept;
        const cutEnd = cutStart + cutAmount;
        cutRanges.push({ start: cutStart, end: cutEnd });
      }
    }
  }

  // Sort and merge overlapping cut ranges if any
  cutRanges.sort((a, b) => a.start - b.start);
  const mergedCuts: CutRange[] = [];
  for (const cut of cutRanges) {
    if (mergedCuts.length === 0) {
      mergedCuts.push({ ...cut });
    } else {
      const last = mergedCuts[mergedCuts.length - 1];
      if (cut.start <= last.end) {
        last.end = Math.max(last.end, cut.end);
      } else {
        mergedCuts.push({ ...cut });
      }
    }
  }

  // Build KEEP ranges
  const keepRanges: AudioSegmentRange[] = [];
  let currentSample = 0;

  for (const cut of mergedCuts) {
    if (cut.start > currentSample) {
      keepRanges.push({ startSample: currentSample, endSample: cut.start });
    }
    currentSample = Math.max(currentSample, cut.end);
  }

  if (currentSample < totalSamples) {
    keepRanges.push({ startSample: currentSample, endSample: totalSamples });
  }

  // Calculate total kept samples
  let totalKeptSamples = 0;
  for (const range of keepRanges) {
    totalKeptSamples += range.endSample - range.startSample;
  }

  if (totalKeptSamples === 0) {
    // Failsafe in case entire audio was marked silent
    totalKeptSamples = Math.min(totalSamples, Math.floor(sampleRate * 0.1));
    keepRanges.length = 0;
    keepRanges.push({ startSample: 0, endSample: totalKeptSamples });
  }

  // Construct processed AudioBuffer
  const processedBuffer = new AudioBuffer({
    numberOfChannels: numChannels,
    length: totalKeptSamples,
    sampleRate: sampleRate,
  });

  // Micro-crossfade samples
  const crossfadeSamples = Math.min(
    Math.floor((settings.crossfadeMs / 1000) * sampleRate),
    300
  );

  for (let c = 0; c < numChannels; c++) {
    const srcData = audioBuffer.getChannelData(c);
    const destData = processedBuffer.getChannelData(c);

    let destOffset = 0;
    for (let r = 0; r < keepRanges.length; r++) {
      const { startSample, endSample } = keepRanges[r];
      const segmentLen = endSample - startSample;

      // Copy segment
      for (let i = 0; i < segmentLen; i++) {
        destData[destOffset + i] = srcData[startSample + i];
      }

      // Apply subtle micro-fade at splice boundaries to avoid audio pop/click
      if (crossfadeSamples > 0 && segmentLen >= crossfadeSamples * 2) {
        // Fade in at segment start (unless it's the very beginning of the track)
        if (r > 0) {
          for (let f = 0; f < crossfadeSamples; f++) {
            const gain = f / crossfadeSamples;
            destData[destOffset + f] *= gain;
          }
        }
        // Fade out at segment end (unless it's the very end of the track)
        if (r < keepRanges.length - 1) {
          for (let f = 0; f < crossfadeSamples; f++) {
            const gain = 1 - f / crossfadeSamples;
            destData[destOffset + segmentLen - crossfadeSamples + f] *= gain;
          }
        }
      }

      destOffset += segmentLen;
    }
  }

  const processedDurationSec = processedBuffer.duration;
  const timeSavedSec = Math.max(0, originalDurationSec - processedDurationSec);
  const reductionPercentage =
    originalDurationSec > 0
      ? Math.round((timeSavedSec / originalDurationSec) * 1000) / 10
      : 0;

  return {
    processedBuffer,
    stats: {
      originalDurationSec,
      processedDurationSec,
      timeSavedSec,
      reductionPercentage,
      silenceCount: activeSilences.length,
    },
  };
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM RIFF WAV format.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, format, true); // Audio format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave audio samples into 16-bit PCM
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Generate a rich spoken speech simulation demo track with deliberate pauses.
 */
export async function generateDemoAudioTrack(audioCtx: AudioContext): Promise<{ buffer: AudioBuffer; metadata: AudioMetadata }> {
  const sampleRate = audioCtx.sampleRate;
  const totalDurationSec = 11.5;
  const numChannels = 2;
  const totalSamples = Math.floor(sampleRate * totalDurationSec);

  const buffer = audioCtx.createBuffer(numChannels, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Spoken phrase intervals with silent pauses:
  // Phrase 1: 0.5s to 2.8s ("Welcome to SilenceTrim voice studio.")
  // Pause 1: 2.8s to 4.6s (1.8s silence)
  // Phrase 2: 4.6s to 6.9s ("All detected pauses will be removed automatically.")
  // Pause 2: 6.9s to 8.8s (1.9s silence)
  // Phrase 3: 8.8s to 10.7s ("Listen to the crisp final cut without dead air.")
  // Pause 3: 10.7s to 11.5s (0.8s silence)

  const phrases = [
    { start: 0.6, end: 2.8, pitch: 180, cadence: 1.1 },
    { start: 4.6, end: 6.9, pitch: 200, cadence: 1.2 },
    { start: 8.8, end: 10.7, pitch: 190, cadence: 1.0 },
  ];

  // Synthesize realistic speech-like vowel formant bursts + subtle room warmth
  for (const phrase of phrases) {
    const startIdx = Math.floor(phrase.start * sampleRate);
    const endIdx = Math.floor(phrase.end * sampleRate);
    const phraseLen = endIdx - startIdx;

    for (let i = 0; i < phraseLen; i++) {
      const t = i / sampleRate;
      const progress = i / phraseLen;

      // Syllable rhythm modulation (approx 4-5 syllables per second)
      const syllableEnv = Math.pow(Math.sin(progress * Math.PI * 14), 2);
      // Overall phrase envelope (fade in / fade out)
      const phraseEnv = Math.sin(progress * Math.PI);

      // Fundamental frequency + pitch intonation inflection
      const pitchMod = phrase.pitch + Math.sin(progress * Math.PI * 3) * 20;

      // Vocal formant harmonics (F1, F2, F3)
      const fundamental = Math.sin(2 * Math.PI * pitchMod * t) * 0.4;
      const harmonic2 = Math.sin(2 * Math.PI * pitchMod * 2 * t) * 0.25;
      const formant1 = Math.sin(2 * Math.PI * (pitchMod * 3.8) * t) * 0.2;
      const formant2 = Math.sin(2 * Math.PI * (pitchMod * 7.2) * t) * 0.12;

      // Add soft vocal breath friction
      const noise = (Math.random() * 2 - 1) * 0.04;

      const rawSignal = (fundamental + harmonic2 + formant1 + formant2 + noise) * syllableEnv * phraseEnv * 0.65;

      const idx = startIdx + i;
      if (idx < totalSamples) {
        // Slight stereo spread
        left[idx] = rawSignal * 0.95;
        right[idx] = rawSignal * 1.05;
      }
    }
  }

  // Add subtle realistic low-level room ambience (-68 dB)
  for (let i = 0; i < totalSamples; i++) {
    const ambientNoise = (Math.random() * 2 - 1) * 0.0003;
    left[i] += ambientNoise;
    right[i] += ambientNoise;
  }

  const metadata: AudioMetadata = {
    name: 'demo_voice_narration.wav',
    sizeBytes: Math.round(totalSamples * 4),
    durationSec: totalDurationSec,
    sampleRate: sampleRate,
    numberOfChannels: numChannels,
    format: 'WAV (16-bit Stereo Demo)',
  };

  return { buffer, metadata };
}

/**
 * Format seconds to standard mm:ss.ms
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
}

/**
 * Format byte size to readable MB / KB
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
