import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AudioUploader } from './components/AudioUploader';
import { WaveformView } from './components/WaveformView';
import { AudioPlayer } from './components/AudioPlayer';
import { SilenceControls } from './components/SilenceControls';
import { SilenceList } from './components/SilenceList';
import { Footer } from './components/Footer';
import {
  AudioMetadata,
  ProcessingStats,
  SilenceInterval,
  SilenceSettings,
} from './types/audio';
import {
  audioBufferToWav,
  detectSilenceIntervals,
  formatTime,
  generateDemoAudioTrack,
  processAudioBuffer,
} from './utils/audioProcessor';
import {
  Download,
  Volume2,
  Sparkles,
  Scissors,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [silenceIntervals, setSilenceIntervals] = useState<SilenceInterval[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);

  // Audio player state
  const [activeTrack, setActiveTrack] = useState<'original' | 'processed'>('processed');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeSilenceId, setActiveSilenceId] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<SilenceSettings>({
    thresholdDb: -40,
    minDurationMs: 350,
    paddingMs: 40,
    mode: 'remove',
    truncateDurationMs: 250,
    crossfadeMs: 6,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((current) => (current === msg ? null : current));
    }, 4000);
  };

  // Run silence detection and processing
  const runSilenceProcessing = useCallback(
    (sourceBuffer: AudioBuffer, currentSettings: SilenceSettings, existingSilences?: SilenceInterval[]) => {
      setIsProcessing(true);
      try {
        let silences: SilenceInterval[];
        if (existingSilences) {
          silences = existingSilences;
        } else {
          silences = detectSilenceIntervals(sourceBuffer, currentSettings);
          setSilenceIntervals(silences);
        }

        const result = processAudioBuffer(sourceBuffer, silences, currentSettings);
        setProcessedBuffer(result.processedBuffer);
        setStats(result.stats);
        setActiveTrack('processed');
        setCurrentTime(0);
        setIsPlaying(false);

        if (result.stats.silenceCount > 0) {
          showToast(
            `Removed ${result.stats.silenceCount} pauses (${result.stats.timeSavedSec.toFixed(1)}s dead air eliminated)`
          );
        }
      } catch (err) {
        console.error('Error processing audio:', err);
        setErrorMessage('Failed to process audio buffer. Please verify the audio file format.');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Decode array buffer into AudioBuffer
  const handleAudioArrayBuffer = async (
    arrayBuffer: ArrayBuffer,
    fileName: string,
    fileSize: number,
    formatStr: string
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const ctx = getAudioContext();
      // Clone buffer because decodeAudioData detaches the arrayBuffer
      const bufferCopy = arrayBuffer.slice(0);
      const decodedBuffer = await ctx.decodeAudioData(bufferCopy);

      setAudioBuffer(decodedBuffer);
      setMetadata({
        name: fileName,
        sizeBytes: fileSize,
        durationSec: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        numberOfChannels: decodedBuffer.numberOfChannels,
        format: formatStr,
      });

      // Automatically run silence detection and trimming
      runSilenceProcessing(decodedBuffer, settings);
    } catch (err) {
      console.error('Error decoding audio:', err);
      setErrorMessage(
        'Could not decode this audio file. Please try standard MP3, WAV, AAC, or OGG.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle uploaded file
  const handleFileSelected = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const format = file.type || file.name.split('.').pop()?.toUpperCase() || 'Audio File';
      await handleAudioArrayBuffer(arrayBuffer, file.name, file.size, format);
    } catch (err) {
      console.error('Error reading file:', err);
      setErrorMessage('Could not read the selected file.');
    }
  };

  // Handle recorded microphone audio
  const handleRecordFinish = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      await handleAudioArrayBuffer(
        arrayBuffer,
        `mic_recording_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.webm`,
        audioBlob.size,
        'WEBM Audio (Microphone)'
      );
    } catch (err) {
      console.error('Error processing recording:', err);
      setErrorMessage('Failed to decode recorded audio.');
    }
  };

  // Load interactive demo audio
  const handleLoadDemo = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const ctx = getAudioContext();
      const { buffer, metadata: demoMeta } = await generateDemoAudioTrack(ctx);
      setAudioBuffer(buffer);
      setMetadata(demoMeta);
      runSilenceProcessing(buffer, settings);
      showToast('Loaded demo audio with 3 vocal phrases and deliberate pauses!');
    } catch (err) {
      console.error('Failed to generate demo audio:', err);
      setErrorMessage('Failed to generate sample audio.');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-run silence detection with current settings
  const handleApplySettings = () => {
    if (!audioBuffer) return;
    runSilenceProcessing(audioBuffer, settings);
  };

  // Toggle individual silence interval inclusion
  const handleToggleSilence = (id: string) => {
    if (!audioBuffer) return;
    const updated = silenceIntervals.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setSilenceIntervals(updated);
    runSilenceProcessing(audioBuffer, settings, updated);
  };

  // Toggle all silences
  const handleToggleAll = (enabled: boolean) => {
    if (!audioBuffer) return;
    const updated = silenceIntervals.map((s) => ({ ...s, enabled }));
    setSilenceIntervals(updated);
    runSilenceProcessing(audioBuffer, settings, updated);
  };

  // Preview an isolated silence section in the original track
  const handlePreviewSilence = (startSec: number, endSec: number) => {
    setActiveTrack('original');
    setCurrentTime(Math.max(0, startSec - 0.2));
    setActiveSilenceId(`silence-preview-${startSec}`);
  };

  // Download processed WAV
  const handleDownloadWav = () => {
    if (!processedBuffer) return;
    try {
      const wavBlob = audioBufferToWav(processedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = metadata?.name.replace(/\.[^/.]+$/, '') || 'audio';
      a.download = `${baseName}_silence_removed.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded clean WAV audio successfully!');
    } catch (err) {
      console.error('Error generating WAV:', err);
      setErrorMessage('Failed to generate WAV file.');
    }
  };

  // Seek handler
  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
        onDownloadWav={handleDownloadWav}
        canDownload={!!processedBuffer}
        onLoadDemo={handleLoadDemo}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Toast / Error Banner */}
        {notification && (
          <div className="flex items-center gap-2 p-3 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-xs text-indigo-200 shadow-sm animate-in fade-in">
            <CheckCircle size={15} className="text-indigo-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center justify-between p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Section if no audio loaded */}
        {!audioBuffer && (
          <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Scissors size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white max-w-xl">
              Automatic Audio Silence Detector & Remover
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
              Eliminate awkward dead-air pauses and speed up podcasts, voice recordings, lectures, and interviews with studio-grade micro-crossfade splicing.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleLoadDemo}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <Sparkles size={14} className="text-indigo-200" />
                Try Interactive Demo Audio
              </button>
            </div>
          </div>
        )}

        {/* Audio Uploader Box */}
        <section id="editor">
          <AudioUploader
            onFileSelected={handleFileSelected}
            onLoadDemo={handleLoadDemo}
            metadata={metadata}
            isLoading={isLoading}
            onRecordFinish={handleRecordFinish}
          />
        </section>

        {/* Waveforms & Playback Section */}
        {audioBuffer && (
          <section id="waveform" className="flex flex-col gap-4">
            {/* Audio Player bar */}
            <AudioPlayer
              originalBuffer={audioBuffer}
              processedBuffer={processedBuffer}
              activeTrack={activeTrack}
              onTrackChange={setActiveTrack}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onSeek={handleSeek}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
            />

            {/* Waveform Visualizer */}
            <div className="grid grid-cols-1 gap-4">
              {/* Processed Track Waveform (Cleaned) */}
              {processedBuffer && (
                <WaveformView
                  audioBuffer={processedBuffer}
                  silenceIntervals={[]}
                  currentTime={activeTrack === 'processed' ? currentTime : 0}
                  duration={processedBuffer.duration}
                  onSeek={(t) => {
                    setActiveTrack('processed');
                    handleSeek(t);
                  }}
                  title="Cleaned Audio Waveform (Silence Removed)"
                  isProcessed={true}
                />
              )}

              {/* Original Track Waveform with Silence Highlights */}
              <WaveformView
                audioBuffer={audioBuffer}
                silenceIntervals={silenceIntervals}
                currentTime={activeTrack === 'original' ? currentTime : 0}
                duration={audioBuffer.duration}
                onSeek={(t) => {
                  setActiveTrack('original');
                  handleSeek(t);
                }}
                title="Original Audio Waveform (Red zones mark detected pauses)"
                isProcessed={false}
              />
            </div>
          </section>
        )}

        {/* Silence Detection Controls & Interval List */}
        {audioBuffer && (
          <section id="parameters" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Parameter Sliders */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <SilenceControls
                settings={settings}
                onChange={setSettings}
                onProcess={handleApplySettings}
                isProcessing={isProcessing}
                disabled={!audioBuffer}
              />
            </div>

            {/* Right Column: Detected Silence List */}
            <div id="segments" className="lg:col-span-5 flex flex-col gap-4">
              <SilenceList
                silenceIntervals={silenceIntervals}
                stats={stats}
                onToggleSilence={handleToggleSilence}
                onToggleAll={handleToggleAll}
                onPreviewSilence={handlePreviewSilence}
                activeSilenceId={activeSilenceId}
              />
            </div>
          </section>
        )}

        {/* Export & Download Floating Bar (when audio is processed) */}
        {processedBuffer && stats && (
          <div className="rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-sm font-semibold text-white">
                  Audio Ready for Export
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  · {formatTime(stats.processedDurationSec)} duration
                </span>
              </div>
              <p className="text-xs text-slate-400">
                16-bit PCM RIFF WAV format compatible with all media players, podcast hosts, and DAWs.
              </p>
            </div>

            <button
              onClick={handleDownloadWav}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-md flex items-center gap-2"
            >
              <Download size={15} />
              <span>Download Processed Audio (WAV)</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
