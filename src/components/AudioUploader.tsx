import React, { useRef, useState } from 'react';
import { UploadCloud, Music, Mic, Square, Sparkles, FileAudio } from 'lucide-react';
import { AudioMetadata } from '../types/audio';
import { formatFileSize, formatTime } from '../utils/audioProcessor';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
  onLoadDemo: () => void;
  metadata: AudioMetadata | null;
  isLoading: boolean;
  onRecordFinish: (audioBlob: Blob) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileSelected,
  onLoadDemo,
  metadata,
  isLoading,
  onRecordFinish,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i)) {
        onFileSelected(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordFinish(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access was denied or not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/30'
            : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-slate-200">
              {isLoading
                ? 'Decoding audio stream...'
                : 'Click to upload or drag & drop audio here'}
            </p>
            <p className="text-xs text-slate-400">
              Supports MP3, WAV, OGG, M4A, FLAC, AAC, WEBM (Client-side, 100% private)
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onLoadDemo}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={13} className="text-amber-400" />
              Load Test Audio Demo
            </button>

            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors flex items-center gap-1.5 animate-pulse"
              >
                <Square size={13} />
                Stop Recording
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Mic size={13} className="text-rose-400" />
                Record Voice
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loaded File Metadata Bar */}
      {metadata && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileAudio size={18} className="text-indigo-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-slate-200 truncate block">
                {metadata.name}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {metadata.format} · {formatFileSize(metadata.sizeBytes)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono tabular-nums text-[11px]">
            <div>
              <span className="text-slate-500">Duration: </span>
              <span className="text-slate-200 font-medium">
                {formatTime(metadata.durationSec)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Sample Rate: </span>
              <span className="text-slate-200 font-medium">
                {metadata.sampleRate} Hz
              </span>
            </div>
            <div>
              <span className="text-slate-500">Channels: </span>
              <span className="text-slate-200 font-medium">
                {metadata.numberOfChannels === 1 ? 'Mono' : 'Stereo'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
