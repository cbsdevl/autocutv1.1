import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Check,
  Music,
  Scissors,
  Wand2,
  Clock,
  Zap,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  X,
  Layers,
  Film,
  Disc3,
  Repeat,
  Radio,
  Sliders,
  Flame,
  CheckCircle2,
  Upload,
  Play,
} from "lucide-react";
import { EDITING_PRESETS } from "../data/presets";
import { AutoEditOptions, EditingPreset, MediaItem } from "../types";
import { analyzeAudioBeat, BeatAnalysisResult } from "../utils/beatDetector";
import { formatTimecode } from "../utils/mediaUtils";

interface AIAutoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
  onOpenMediaUpload?: () => void;
  onRunAutoEdit: (options: AutoEditOptions) => Promise<void>;
  isProcessing: boolean;
  progressStep: string;
}

export const AIAutoEditModal: React.FC<AIAutoEditModalProps> = ({
  isOpen,
  onClose,
  mediaItems,
  onOpenMediaUpload,
  onRunAutoEdit,
  isProcessing,
  progressStep,
}) => {
  // Separate Video & Audio assets
  const videoItems = useMemo(
    () => mediaItems.filter((m) => m.type === "video"),
    [mediaItems]
  );
  const audioItems = useMemo(
    () => mediaItems.filter((m) => m.type === "audio"),
    [mediaItems]
  );

  const videoCount = videoItems.length;
  const audioCount = audioItems.length;

  // Selected Style Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>("music_video");
  const [sourceTrims, setSourceTrims] = useState<Record<string, { start: number; end: number }>>({});
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const trimPreviewRef = React.useRef<HTMLVideoElement | null>(null);

  // Audio Selection & Duration Matching
  const [selectedAudioId, setSelectedAudioId] = useState<string>(() => {
    return audioItems[0]?.id || "";
  });
  const [useAudioDuration, setUseAudioDuration] = useState<boolean>(true);
  const [customDuration, setCustomDuration] = useState<number>(60);

  // Cut Rhythm / Segment Duration (User requested: 5 sec or more based on what user wants)
  const [cutIntervalSec, setCutIntervalSec] = useState<number>(5.0);

  // Audio Muting (User requested: mute all videos and apply uploaded audio)
  const [muteOriginalVideoAudio, setMuteOriginalVideoAudio] = useState<boolean>(true);

  // Beat & Dance Sync
  const [beatSync, setBeatSync] = useState<boolean>(true);
  const [danceBeatAlignment, setDanceBeatAlignment] = useState<boolean>(true);
  const [beatAnalysis, setBeatAnalysis] = useState<BeatAnalysisResult | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState<boolean>(false);

  useEffect(() => {
    setSourceTrims((previous) => {
      let changed = false;
      const next = { ...previous };
      videoItems.forEach((video) => {
        const duration = Math.max(0.5, video.duration || 0.5);
        const trim = previous[video.id] || { start: 0, end: 0 };
        const start = Math.max(0, Math.min(trim.start, duration - 0.5));
        const end = Math.max(0, Math.min(trim.end, duration - start - 0.5));
        if (!previous[video.id] || start !== trim.start || end !== trim.end) {
          next[video.id] = { start, end };
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [videoItems]);

  useEffect(() => {
    const preview = trimPreviewRef.current;
    const trim = previewSourceId ? sourceTrims[previewSourceId] : null;
    if (preview && trim && preview.readyState >= 1) {
      preview.pause();
      preview.currentTime = trim.start;
    }
  }, [previewSourceId, sourceTrims]);

  // YouTube Anti-Copyright Transformative Shield
  const [antiCopyrightShield, setAntiCopyrightShield] = useState<boolean>(true);
  const [mirrorAlternateClips, setMirrorAlternateClips] = useState<boolean>(true);
  const [speedVariation, setSpeedVariation] = useState<boolean>(true);
  const [zoomVariation, setZoomVariation] = useState<boolean>(true);
  const [applyLut, setApplyLut] = useState<boolean>(true);

  // Find active audio
  const activeAudio = useMemo(() => {
    return audioItems.find((a) => a.id === selectedAudioId) || audioItems[0] || null;
  }, [audioItems, selectedAudioId]);

  // Sync selected audio when audioItems change
  useEffect(() => {
    if (audioItems.length > 0 && (!selectedAudioId || !audioItems.some((a) => a.id === selectedAudioId))) {
      setSelectedAudioId(audioItems[0].id);
    }
  }, [audioItems, selectedAudioId]);

  // Analyze audio beat & dance tempo when active audio changes
  useEffect(() => {
    if (!isOpen || !activeAudio) return;

    let isMounted = true;
    setIsAnalyzingAudio(true);

    analyzeAudioBeat(activeAudio.url, activeAudio.duration)
      .then((res) => {
        if (isMounted) {
          setBeatAnalysis(res);
          setIsAnalyzingAudio(false);
          // If dance beat detected, optionally suggest the calculated cut interval
          if (res.isDanceBeat && res.recommendedCutSec) {
            // Keep default close to 5s
            if (res.recommendedCutSec >= 3.5 && res.recommendedCutSec <= 6.5) {
              setCutIntervalSec(res.recommendedCutSec);
            }
          }
        }
      })
      .catch(() => {
        if (isMounted) setIsAnalyzingAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeAudio]);

  if (!isOpen) return null;

  const currentPreset = EDITING_PRESETS.find((p) => p.id === selectedPresetId) || EDITING_PRESETS[0];

  // Calculated target duration
  const effectiveTargetDuration =
    useAudioDuration && activeAudio
      ? Math.max(10, Math.ceil(activeAudio.duration || 60))
      : customDuration;

  // Estimated cut count
  const estimatedCutsCount = Math.max(1, Math.ceil(effectiveTargetDuration / (cutIntervalSec || 5)));

  // Can start only if at least 2 videos are present
  const hasEnoughVideos = videoCount >= 2;

  const handleStart = () => {
    if (!hasEnoughVideos) return;

    onRunAutoEdit({
      preset: currentPreset,
      targetDuration: effectiveTargetDuration,
      useAudioDuration: Boolean(useAudioDuration && activeAudio),
      selectedAudioId: activeAudio?.id,
      cutIntervalSec,
      beatSync,
      muteOriginalVideoAudio,
      antiCopyrightShield,
      mirrorAlternateClips,
      speedVariation,
      zoomVariation,
      danceBeatAlignment,
      applyLut,
      addMusic: Boolean(activeAudio),
      autoCaptions: false,
      transitionType: "Cut",
      sourceTrims,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 select-none font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl shadow-black/50 text-zinc-100">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-zinc-100 uppercase tracking-wide">
                  Music Video Auto Cut & Remix Engine
                </h2>
                <span className="text-[10px] font-mono text-zinc-500 font-medium">
                  Multi-Source Mashup
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Mix 2+ source videos to your audio track with rhythm cuts & YouTube anti-copyright protection.
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        {isProcessing ? (
          <div className="p-10 flex flex-col items-center justify-center space-y-6 text-center overflow-y-auto">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-zinc-100">AutoCut AI is Remixing Your Music Video</h3>
              <p className="text-xs text-amber-400 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg max-w-md mx-auto">
                {progressStep}
              </p>
            </div>

            <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
              Interleaving video cuts every {cutIntervalSec}s, applying dance beat synchronization, muting camera audio, and applying transformative anti-copyright filters...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* REQUIREMENT CARD: 2 OR MORE VIDEOS */}
            {!hasEnoughVideos ? (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Music Video Remixing Requires 2 or More Videos
                    </h3>
                    <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                      You currently have <strong className="text-white underline">{videoCount} video</strong> uploaded. To mix videos seamlessly to your music and avoid YouTube Content ID copyright flags, the AI needs at least <strong className="text-white">2 different source videos</strong> so it can alternate scenes and create a fresh mashup.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenMediaUpload) onOpenMediaUpload();
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow flex items-center gap-2 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload 2nd Video in Media Library</span>
                  </button>
                  <span className="text-[11px] text-amber-300/70">
                    Import MP4, MOV, or WEBM clips to unlock.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">
                      Multi-Source Mashup Ready: {videoCount} Videos Loaded
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      The AI will alternate scenes between all {videoCount} source videos every {cutIntervalSec}s to create a continuous mix.
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800">
                  <span>{videoCount} Sources</span>
                  <span>•</span>
                  <span>~{estimatedCutsCount} Cuts</span>
                </div>
              </div>
            )}

            {/* OPTIONAL SOURCE IN / OUT TRIM */}
            <section className="space-y-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">Trim source videos</h3>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Exclude unwanted intros, outros, or sections before Auto Cut.</p>
                </div>
                <span className="text-[10px] text-zinc-500">Optional</span>
              </div>

              <div className="space-y-2">
                {videoItems.map((video) => {
                  const duration = Math.max(0.5, video.duration || 0.5);
                  const trim = sourceTrims[video.id] || { start: 0, end: 0 };
                  const maxTrimEnd = Math.max(0, duration - trim.start - 0.5);
                  const usableDuration = Math.max(0.5, duration - trim.start - trim.end);
                  return (
                    <div key={video.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-zinc-800/80 py-2.5 last:border-0">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="h-8 w-11 rounded-sm object-cover bg-zinc-900" />
                      ) : (
                        <div className="h-8 w-11 rounded-sm bg-zinc-900 flex items-center justify-center text-zinc-600"><Film className="h-4 w-4" /></div>
                      )}
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-medium text-zinc-300">{video.name}</span>
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewSourceId((id) => id === video.id ? null : video.id)}
                            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-200"
                          >
                            <Play className="h-3 w-3" />
                            {previewSourceId === video.id ? "Hide preview" : "Preview range"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSourceTrims((previous) => ({ ...previous, [video.id]: { start: 0, end: 0 } }))}
                            disabled={trim.start === 0 && trim.end === 0}
                            className="text-[10px] text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="col-start-2 grid grid-cols-2 gap-3">
                        <label className="min-w-0 space-y-1">
                          <span className="flex justify-between gap-1 text-[9px] text-zinc-500">
                            <span>Start at</span><span className="font-mono text-zinc-300">{formatTimecode(trim.start, false)}</span>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, duration - trim.end - 0.5)}
                            step="0.1"
                            value={trim.start}
                            aria-label={`${video.name} start trim`}
                            onChange={(event) => {
                              const start = Number(event.target.value);
                              setSourceTrims((previous) => ({ ...previous, [video.id]: { start, end: trim.end } }));
                            }}
                            className="w-full accent-zinc-400"
                          />
                        </label>
                        <label className="min-w-0 space-y-1">
                          <span className="flex justify-between gap-1 text-[9px] text-zinc-500">
                            <span>End before</span><span className="font-mono text-zinc-300">{formatTimecode(trim.end, false)}</span>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max={maxTrimEnd}
                            step="0.1"
                            value={trim.end}
                            aria-label={`${video.name} end trim`}
                            onChange={(event) => {
                              const end = Number(event.target.value);
                              setSourceTrims((previous) => ({ ...previous, [video.id]: { start: trim.start, end } }));
                            }}
                            className="w-full accent-zinc-400"
                          />
                        </label>
                      </div>
                      {previewSourceId === video.id && (
                        <video
                          ref={trimPreviewRef}
                          src={video.url}
                          controls
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(event) => { event.currentTarget.currentTime = trim.start; }}
                          onTimeUpdate={(event) => {
                            const outPoint = Math.max(trim.start + 0.1, duration - trim.end);
                            if (event.currentTarget.currentTime >= outPoint) {
                              event.currentTarget.pause();
                              event.currentTarget.currentTime = trim.start;
                            }
                          }}
                          className="col-span-2 mt-1 max-h-36 w-full bg-black object-contain"
                          aria-label={`Preview ${video.name} selected range`}
                        />
                      )}
                      <span className="col-start-2 text-[9px] text-zinc-600">{formatTimecode(usableDuration, false)} available to Auto Cut</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 1: AUDIO TRACK & DURATION SYNC */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-indigo-400" />
                  1. Audio Track & Music Duration Match
                </span>
                {activeAudio && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    Duration: {formatTimecode(activeAudio.duration, false, 30)}
                  </span>
                )}
              </label>

              {audioCount === 0 ? (
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-zinc-500" />
                    <span>No audio music track uploaded yet.</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenMediaUpload) onOpenMediaUpload();
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                  >
                    Upload Song (MP3 / WAV)
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Audio selector dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {audioItems.map((audio) => {
                      const isSelected = selectedAudioId === audio.id;
                      return (
                        <button
                          key={audio.id}
                          onClick={() => setSelectedAudioId(audio.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                            isSelected
                              ? "bg-indigo-950/50 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/40"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Disc3 className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-400 animate-spin" : "text-zinc-500"}`} />
                            <span className="text-xs font-semibold truncate">{audio.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0 ml-2">
                            {formatTimecode(audio.duration, false, 30)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Beat & Dance Detection Box */}
                  {beatAnalysis && (
                    <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <Flame className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div>
                          <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                            <span>Dance Rhythm:</span>
                            <span className="text-amber-400 font-mono">{beatAnalysis.bpm} BPM</span>
                            <span className="text-zinc-400 font-normal">({beatAnalysis.danceType})</span>
                          </span>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">
                            Musical 4-beat bar: {beatAnalysis.measureIntervalSec}s • {beatAnalysis.dropTimestamps.length} energetic drops detected.
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 shrink-0">
                        Tempo Synced
                      </span>
                    </div>
                  )}

                  {/* Duration matching toggle */}
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                    <input
                      type="checkbox"
                      checked={useAudioDuration}
                      onChange={(e) => setUseAudioDuration(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4"
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-200 block">
                          Match Full Uploaded Music Duration ({formatTimecode(activeAudio?.duration || 60, false, 30)})
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Timeline duration and video sequence will span the full length of the song until it ends.
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-400 ml-2">
                        {Math.round(activeAudio?.duration || 60)}s
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* SECTION 2: CUT INTERVAL (EACH 5 SEC OR MORE) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  2. Clip Switching Interval (Cut Every X Seconds)
                </span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">
                  Current: Every {cutIntervalSec} seconds (~{estimatedCutsCount} cuts)
                </span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { sec: 3.0, label: "3s (Fast Beat)", desc: "High energy" },
                  { sec: 4.0, label: "4s (Pop Bar)", desc: "8-beat dance" },
                  { sec: 5.0, label: "5s (Standard)", desc: "Recommended" },
                  { sec: 6.5, label: "6.5s (Pacing)", desc: "Smooth flow" },
                  { sec: 8.0, label: "8s (Cinematic)", desc: "Longer shots" },
                ].map((interval) => (
                  <button
                    key={interval.sec}
                    onClick={() => setCutIntervalSec(interval.sec)}
                    className={`p-2.5 rounded-md border text-center transition flex flex-col justify-center ${
                      cutIntervalSec === interval.sec
                        ? "bg-zinc-800 border-zinc-500 text-zinc-100"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-xs font-bold block">{interval.label}</span>
                    <span className="text-[9px] text-zinc-500 font-mono mt-0.5">{interval.desc}</span>
                  </button>
                ))}
              </div>

              {/* Custom Interval Slider */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Fine-tune Cut Duration:</span>
                  <span className="font-mono text-zinc-100 font-bold">{cutIntervalSec}s per video clip</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="12.0"
                  step="0.5"
                  value={cutIntervalSec}
                  onChange={(e) => setCutIntervalSec(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                  <span>2s (Rapid Cuts)</span>
                  <span>5s (Default YouTube Music Video)</span>
                  <span>12s (Slow Observation)</span>
                </div>
              </div>
            </div>

            {/* SECTION 3: AUDIO MUTING & REPLACEMENT */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                3. Audio Management (Avoid Audio Copyright Claims)
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                <input
                  type="checkbox"
                  checked={muteOriginalVideoAudio}
                  onChange={(e) => setMuteOriginalVideoAudio(e.target.checked)}
                  className="rounded accent-rose-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">
                    Mute All Source Videos & Apply Uploaded Audio Track Exclusively
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block leading-relaxed">
                    Completely silences camera audio from the source videos. Your uploaded music track plays on Track A2 across the entire timeline with zero noise or sound clash, eliminating audio Content ID matches.
                  </span>
                </div>
              </label>
            </div>

            {/* SECTION 4: YOUTUBE ANTI-COPYRIGHT & TRANSFORMATIVE REMIX SHIELD */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  4. YouTube Copyright Shield & Transformative Remix Engine
                </label>
                <span className="text-[10px] font-mono text-emerald-400">Fair Use Transformative Protection</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <input
                    type="checkbox"
                    checked={mirrorAlternateClips}
                    onChange={(e) => setMirrorAlternateClips(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Alternating Horizontal Mirroring
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Flips alternate clips horizontally to break automated perceptual video hashes.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <input
                    type="checkbox"
                    checked={speedVariation}
                    onChange={(e) => setSpeedVariation(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Micro-Speed Cadence Shift (1.025x)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Alters temporal frame rate cadence without perceptible visual change.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <input
                    type="checkbox"
                    checked={zoomVariation}
                    onChange={(e) => setZoomVariation(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Dynamic Safe Crop & Punch Zooms (1.04x - 1.08x)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Trims border watermarks and breaks pixel-exact spatial fingerprints.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <input
                    type="checkbox"
                    checked={danceBeatAlignment}
                    onChange={(e) => setDanceBeatAlignment(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Dance Beat & Visual Rhythm Sync
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Aligns clip transitions with musical bass kicks and chorus drops.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* SECTION 5: COLOR GRADING LUT PRESET */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>5. Transformative Color Grade (Cinematic LUT)</span>
                <span className="text-[10px] text-zinc-500 font-mono">{currentPreset.colorMood}</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EDITING_PRESETS.slice(0, 8).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-2 rounded-lg border text-left transition ${
                        isSelected
                          ? "bg-zinc-800 border-zinc-500 text-zinc-100"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-xs font-bold block truncate">{preset.name}</span>
                      <span className="text-[9px] text-zinc-500 truncate block mt-0.5">{preset.tempo}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isProcessing && (
          <div className="p-4 border-t border-zinc-800 bg-[#16171b] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-zinc-400">
              {hasEnoughVideos ? (
                <span>
                  Ready to mix <strong className="text-amber-400">{videoCount} videos</strong> across{" "}
                  <strong className="text-white">{effectiveTargetDuration}s</strong> ({Math.ceil(effectiveTargetDuration / cutIntervalSec)} cuts).
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  ⚠️ Please import at least 2 videos to enable multi-source mashup.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>

              {!hasEnoughVideos ? (
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenMediaUpload) onOpenMediaUpload();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow transition flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload 2nd Video</span>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="px-5 py-2 rounded-md bg-zinc-200 hover:bg-white text-zinc-950 font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>Generate Music Video Mashup</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
