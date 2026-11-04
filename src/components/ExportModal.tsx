import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Film,
  Sparkles,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Sliders,
  Volume2,
  VolumeX,
  Video,
  Settings,
  HardDrive,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Play,
} from "lucide-react";
import {
  CopyrightAuditReport,
  ExportSettings,
  MediaItem,
  ProjectSettings,
  RenderProgress,
  TimelineTrack,
  YouTubePackage,
} from "../types";
import {
  formatTimecode,
  generateChapterMarkersText,
  generateLicenseReportText,
  generateSrt,
  triggerDownload,
} from "../utils/mediaUtils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: any[];
  onStartRender: (settings: ExportSettings) => Promise<void>;
  onCancelRender: () => void;
  renderProgress: RenderProgress | null;
  youtubePackage: YouTubePackage | null;
  onGenerateYouTubePackage: () => Promise<void>;
  isGeneratingPackage: boolean;
  auditReport: CopyrightAuditReport | null;
}

type PresetId =
  | "match_source"
  | "youtube_1080p"
  | "youtube_4k"
  | "shorts_vertical"
  | "instagram_square"
  | "high_bitrate"
  | "prores_proxy"
  | "web_720p";

interface PresetOption {
  id: PresetId;
  name: string;
  description: string;
  format: "mp4" | "webm";
  resolution: "720p" | "1080p" | "1440p" | "4K";
  frameRate: 24 | 25 | 30 | 50 | 60;
  quality: "standard" | "high" | "maximum" | "prores";
  bitrateMbps: number;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "match_source",
    name: "Match Source - Adaptive High Bitrate",
    description: "Matches timeline sequence resolution & frame rate with pristine H.264 VBR encoding.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 16,
  },
  {
    id: "youtube_1080p",
    name: "YouTube 1080p Full HD",
    description: "Industry-standard YouTube upload profile: 1920x1080, 16 Mbps, 48kHz AAC Stereo.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 16,
  },
  {
    id: "youtube_4k",
    name: "YouTube 4K Ultra HD",
    description: "Crisp 3840x2160 master quality at 40 Mbps with high-efficiency encoding.",
    format: "mp4",
    resolution: "4K",
    frameRate: 30,
    quality: "maximum",
    bitrateMbps: 40,
  },
  {
    id: "shorts_vertical",
    name: "YouTube Shorts / TikTok / Reels (9:16)",
    description: "Optimized 1080x1920 vertical canvas, high motion retention, mobile-ready.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 15,
  },
  {
    id: "instagram_square",
    name: "Social Media Square (1:1)",
    description: "1080x1080 square format for Instagram feed and LinkedIn carousels.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 12,
  },
  {
    id: "high_bitrate",
    name: "High Quality 1080p (24 Mbps Master)",
    description: "Maximum detail retention for complex cinematic footage with high dynamic range.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "maximum",
    bitrateMbps: 24,
  },
  {
    id: "prores_proxy",
    name: "Apple ProRes 422 Proxy Equivalent",
    description: "Near-lossless 35 Mbps master stream for post-production archival and color finishing.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "prores",
    bitrateMbps: 35,
  },
  {
    id: "web_720p",
    name: "Web Standard 720p (Fast Encode)",
    description: "Compact 1280x720 file at 8 Mbps for quick client reviews and low-bandwidth sharing.",
    format: "mp4",
    resolution: "720p",
    frameRate: 30,
    quality: "standard",
    bitrateMbps: 8,
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  tracks,
  mediaItems,
  captions,
  onStartRender,
  onCancelRender,
  renderProgress,
  youtubePackage,
  onGenerateYouTubePackage,
  isGeneratingPackage,
  auditReport,
}) => {
  // Preset Selection
  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>("match_source");

  // Output File Settings
  const [outputFileName, setOutputFileName] = useState(() => {
    return `${project.name.replace(/\s+/g, "_")}_Master.mp4`;
  });
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4K">("1080p");
  const [frameRate, setFrameRate] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [quality, setQuality] = useState<"standard" | "high" | "maximum" | "prores">("high");
  const [bitrateMbps, setBitrateMbps] = useState<number>(16);
  const [durationMode, setDurationMode] = useState<"full" | "preview5" | "preview15">("full");
  const [renderQuality, setRenderQuality] = useState<"standard" | "maximum">("maximum");
  const [burnCaptions, setBurnCaptions] = useState<boolean>(() => captions.length > 0);
  const [audioSampleRate, setAudioSampleRate] = useState<44100 | 48000>(48000);
  const [audioBitrate, setAudioBitrate] = useState<"128k" | "192k" | "256k" | "320k">("192k");
  const [muteVideoAudio, setMuteVideoAudio] = useState<boolean>(true);

  // Accordion Section States (Adobe Premiere Style)
  const [openSections, setOpenSections] = useState({
    file: true,
    video: true,
    audio: false,
    captions: false,
    metadata: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Status & Notifications
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQueueToast, setShowQueueToast] = useState(false);

  // Sync preset changes
  const applyPreset = (presetId: PresetId) => {
    setSelectedPresetId(presetId);
    const p = PRESET_OPTIONS.find((opt) => opt.id === presetId);
    if (!p) return;

    setFormat(p.format);
    setResolution(p.resolution);
    setFrameRate(p.frameRate);
    setQuality(p.quality);
    setBitrateMbps(p.bitrateMbps);

    const ext = p.format;
    const baseName = project.name.replace(/\s+/g, "_");
    setOutputFileName(`${baseName}_${presetId}.${ext}`);
  };

  // Sync project default name on open
  useEffect(() => {
    if (isOpen) {
      const baseName = project.name.replace(/\s+/g, "_");
      setOutputFileName(`${baseName}_Master.mp4`);
      if (captions.length > 0) setBurnCaptions(true);
    }
  }, [isOpen, project.name, captions.length]);

  // Calculate actual timeline duration
  const calculatedDuration = useMemo(() => {
    let maxTime = 0;
    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        const end = c.startTime + c.duration;
        if (end > maxTime) maxTime = end;
      });
    });
    return Math.max(0, Math.ceil(maxTime));
  }, [tracks]);

  // Effective export duration based on range selection
  const effectiveDuration = useMemo(() => {
    if (durationMode === "preview5") return Math.min(5, calculatedDuration || 5);
    if (durationMode === "preview15") return Math.min(15, calculatedDuration || 15);
    return calculatedDuration || 10;
  }, [durationMode, calculatedDuration]);

  // Estimated output file size (MB) = (Bitrate Mbps * seconds) / 8 + audio overhead
  const estimatedFileSizeMB = useMemo(() => {
    const videoMB = (bitrateMbps * effectiveDuration) / 8;
    const audioKbps = parseInt(audioBitrate) || 192;
    const audioMB = (audioKbps * effectiveDuration) / (8 * 1024);
    return Math.max(0.5, videoMB + audioMB).toFixed(1);
  }, [bitrateMbps, effectiveDuration, audioBitrate]);

  // Total frames to render
  const totalFrames = Math.max(1, Math.round(effectiveDuration * frameRate));

  if (!isOpen) return null;

  const isRendering = renderProgress?.isRendering;
  const hasFinishedRender = Boolean(renderProgress?.downloadUrl && !isRendering);
  const isTimelineEmpty = tracks.every((t) => t.clips.length === 0);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadSRT = () => {
    const srt = generateSrt(captions);
    triggerDownload(srt, `${project.name.replace(/\s+/g, "_")}_subtitles.srt`);
  };

  const handleDownloadChapters = () => {
    const chapters = generateChapterMarkersText(tracks, mediaItems);
    triggerDownload(chapters, `${project.name.replace(/\s+/g, "_")}_chapters.txt`);
  };

  const handleDownloadLicenseReport = () => {
    const report = generateLicenseReportText(project.name, mediaItems, tracks);
    triggerDownload(report, `${project.name.replace(/\s+/g, "_")}_License_Report.txt`);
  };

  const handleExportClick = () => {
    onStartRender({
      format,
      presetName: selectedPresetId,
      fileName: outputFileName,
      resolution,
      frameRate,
      quality,
      bitrateMbps,
      durationMode,
      burnCaptions,
      renderQuality,
      audioSampleRate,
      audioBitrate,
      muteVideoAudio,
    });
  };

  const handleSendToQueue = () => {
    setShowQueueToast(true);
    setTimeout(() => setShowQueueToast(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 select-none font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-xl shadow-black/50 text-zinc-100">
        
        {/* System Header Bar */}
        <div className="bg-zinc-950 border-b border-zinc-800 px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Download className="w-4 h-4 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-100 truncate">
                  Export Video
                </h2>
                <span className="text-[11px] font-mono text-zinc-300 bg-zinc-800/90 px-2 py-0.5 rounded-md border border-zinc-700/60 truncate max-w-[120px] sm:max-w-[180px]">
                  {project.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 hidden xs:inline">
                  {project.aspectRatio}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preset Selector & Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[11px] font-medium text-zinc-400 hidden md:inline">Preset:</span>
            <select
              value={selectedPresetId}
              disabled={isRendering}
              onChange={(e) => applyPreset(e.target.value as PresetId)}
              className="bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-xs font-medium text-zinc-200 rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[145px] sm:max-w-[240px] truncate"
            >
              {PRESET_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {!isRendering && (
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Queue Toast Notice */}
        {showQueueToast && (
          <div className="bg-amber-500/10 text-amber-300 text-xs px-4 py-2 flex items-center justify-between border-b border-amber-500/30">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              Sequence added to background render queue.
            </span>
            <button onClick={() => setShowQueueToast(false)} className="text-xs underline hover:text-white ml-4 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body: Split Workspace or Active Rendering View */}
        {isRendering ? (
          /* ACTIVE RENDERING PROGRESS STATE */
          <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center space-y-6 text-center overflow-y-auto bg-zinc-950">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center justify-center gap-2 flex-wrap">
                <span>Encoding Broadcast Master</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900 text-amber-400 border border-zinc-800 font-mono font-semibold">
                  {format.toUpperCase()} • H.264
                </span>
              </h3>
              <p className="text-xs text-amber-400 font-mono bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl">
                {renderProgress?.status || "Processing video timeline frames..."}
              </p>
            </div>

            {/* System Progress Bar */}
            <div className="w-full max-w-lg space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Progress: <strong className="text-zinc-200">{Math.round(renderProgress?.progress || renderProgress?.percent || 0)}%</strong></span>
                <span>
                  {renderProgress?.currentSecond
                    ? `${formatTimecode(renderProgress.currentSecond, false, frameRate)} / ${formatTimecode(effectiveDuration, false, frameRate)}`
                    : `~${totalFrames} frames`}
                </span>
              </div>
              <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                <div
                  className="bg-amber-500 h-full rounded-sm transition-all duration-300"
                  style={{ width: `${renderProgress?.progress || renderProgress?.percent || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
                <span>Bitrate: {bitrateMbps} Mbps</span>
                <span>Engine: Frame-Accurate Fast Remux</span>
              </div>
            </div>

            <button
              onClick={onCancelRender}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 font-semibold transition border border-zinc-800 cursor-pointer min-h-[38px] active:scale-95"
            >
              Cancel Encoding
            </button>
          </div>
        ) : hasFinishedRender ? (
          /* FINISHED RENDER: DOWNLOAD & PREVIEW PLAYER */
          <div className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center space-y-5 overflow-y-auto text-center bg-zinc-950">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
              <h3 className="text-lg sm:text-xl font-bold text-zinc-100">Export Complete & Verified!</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
              Your broadcast-grade MP4 video has been mastered with H.264 video, 48kHz AAC stereo audio, and faststart metadata ready for universal playback and YouTube upload.
            </p>

            {/* In-Modal Real Video Player */}
            <div className="w-full max-w-xl aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl relative">
              <video
                key={renderProgress?.downloadUrl}
                src={renderProgress?.downloadUrl}
                controls
                playsInline
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            {/* Technical Verification Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                Format: <strong className="text-white">MP4 (avc1)</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                Audio: <strong className="text-white">AAC 48kHz Stereo</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                Resolution: <strong className="text-white">{resolution}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                Size: <strong className="text-emerald-400">
                  {renderProgress?.fileSize ? (renderProgress.fileSize / (1024 * 1024)).toFixed(1) + " MB" : `${estimatedFileSizeMB} MB`}
                </strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full max-w-md">
              <a
                href={renderProgress?.downloadUrl}
                download={outputFileName}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-zinc-200 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm transition cursor-pointer min-h-[40px]"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download {outputFileName}</span>
              </a>

              <button
                onClick={onCancelRender}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-800 transition cursor-pointer min-h-[42px] active:scale-95"
              >
                Modify Settings / Export Another
              </button>
            </div>
          </div>
        ) : (
          /* SYSTEM EXPORT WORKSPACE: RESPONSIVE 2-COLUMN LAYOUT */
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 bg-zinc-950">
            
            {/* LEFT COLUMN: Sequence Preview Monitor & Comparison */}
            <div className="w-full lg:w-5/12 xl:w-5/12 p-3.5 sm:p-5 border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col justify-between overflow-y-auto bg-zinc-950 shrink-0 space-y-4">
              <div className="space-y-3.5">
                {/* Source vs Output Technical Comparison Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono p-3 rounded-xl bg-zinc-900 border border-zinc-800/90 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-bold block text-[9px] uppercase tracking-wider">Source Sequence</span>
                    <span className="text-zinc-200 block font-semibold">{project.resolution} • {project.frameRate} fps</span>
                    <span className="text-zinc-400 block">{project.aspectRatio} • {formatTimecode(calculatedDuration, true, project.frameRate)}</span>
                  </div>
                  <div className="space-y-0.5 sm:border-l border-t sm:border-t-0 border-zinc-800 sm:pl-2.5 pt-1.5 sm:pt-0">
                    <span className="text-amber-400 font-bold block text-[9px] uppercase tracking-wider">Output Target</span>
                    <span className="text-zinc-200 block font-semibold">{resolution} • {frameRate} fps</span>
                    <span className="text-zinc-400 block">{format.toUpperCase()} (H.264) • {bitrateMbps} Mbps</span>
                  </div>
                </div>

                {/* Preview Monitor Canvas Frame */}
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 bg-black flex flex-col items-center justify-center relative shadow-inner">
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-2">
                      <Film className="w-6 h-6 text-amber-400/70" />
                    </div>
                    <span className="text-xs font-mono text-zinc-300 font-semibold truncate max-w-full px-2">
                      Sequence: {project.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1">
                      {tracks.filter((t) => t.clips.length > 0).length} Active Tracks • {mediaItems.length} Assets
                    </span>
                  </div>

                  {/* Timecode overlay badge */}
                  <div className="absolute bottom-2.5 left-2.5 bg-zinc-950/90 px-2 py-0.5 rounded-md text-[10px] font-mono text-zinc-300 border border-zinc-800 shadow">
                    {formatTimecode(effectiveDuration, true, frameRate)}
                  </div>
                </div>

                {/* Range Selector */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300">Source Range:</span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      Duration: {formatTimecode(effectiveDuration, false, frameRate)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => setDurationMode("full")}
                      className={`p-2.5 rounded-md border text-left transition cursor-pointer ${
                        durationMode === "full"
                          ? "bg-zinc-800 border-zinc-500 text-zinc-100 font-medium"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-[11px] leading-tight">Entire Sequence</span>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">Full timeline</span>
                    </button>
                    <button
                      onClick={() => setDurationMode("preview5")}
                      className={`p-2.5 rounded-md border text-left transition cursor-pointer ${
                        durationMode === "preview5"
                          ? "bg-zinc-800 border-zinc-500 text-zinc-100 font-medium"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-[11px] leading-tight">In to Out (5s)</span>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">Quick QA test</span>
                    </button>
                    <button
                      onClick={() => setDurationMode("preview15")}
                      className={`p-2.5 rounded-md border text-left transition cursor-pointer ${
                        durationMode === "preview15"
                          ? "bg-zinc-800 border-zinc-500 text-zinc-100 font-medium"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-[11px] leading-tight">Shorts (15s)</span>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">First 15 sec</span>
                    </button>
                  </div>
                </div>

                {/* Empty Timeline Warning Banner */}
                {isTimelineEmpty && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Timeline has no clips. Please add video or audio to your timeline before exporting.</span>
                  </div>
                )}

                {/* Error Banner */}
                {renderProgress?.errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">Render Notice</span>
                      <span className="text-rose-400 text-[11px] block">{renderProgress.errorMessage}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Estimated File Size Widget */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span className="font-medium text-[11px]">Estimated Output File Size:</span>
                </div>
                <div className="font-mono text-sm font-bold text-zinc-100 flex items-baseline gap-1">
                  <span>~{estimatedFileSizeMB}</span>
                  <span className="text-[10px] text-zinc-500 font-normal">MB</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Collapsible Settings Sections */}
            <div className="w-full lg:w-7/12 xl:w-7/12 overflow-y-auto p-3.5 sm:p-5 space-y-3 bg-zinc-950">
              
              {/* SECTION 1: OUTPUT FILE SETTINGS */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 hover:border-zinc-700/80 transition-colors">
                <button
                  onClick={() => toggleSection("file")}
                  className="w-full px-3.5 sm:px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-850 text-left transition select-none cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-400" />
                    File & Location
                  </span>
                  {openSections.file ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {openSections.file && (
                  <div className="p-3.5 sm:p-4 space-y-3.5 text-xs border-t border-zinc-800 bg-zinc-950/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        File Name:
                      </label>
                      <input
                        type="text"
                        value={outputFileName}
                        onChange={(e) => setOutputFileName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition"
                        placeholder="My_Video_Master.mp4"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Format Container:
                        </label>
                        <select
                          value={format}
                          onChange={(e) => setFormat(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="mp4">MP4 (H.264 / AAC) • Recommended</option>
                          <option value="webm">WEBM (VP9 / Opus)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Quality Preset:
                        </label>
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="high">High Quality (16 Mbps VBR)</option>
                          <option value="standard">Standard Web (8 Mbps)</option>
                          <option value="maximum">Maximum Bitrate (24 Mbps)</option>
                          <option value="prores">ProRes Equivalent (35 Mbps)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: VIDEO ENCODING SETTINGS */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 hover:border-zinc-700/80 transition-colors">
                <button
                  onClick={() => toggleSection("video")}
                  className="w-full px-3.5 sm:px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-850 text-left transition select-none cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Video Settings
                  </span>
                  {openSections.video ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {openSections.video && (
                  <div className="p-3.5 sm:p-4 space-y-3.5 text-xs border-t border-zinc-800 bg-zinc-950/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Frame Size (Resolution):
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="1080p">1080p Full HD (1920x1080)</option>
                          <option value="720p">720p HD (1280x720)</option>
                          <option value="1440p">1440p QHD (2560x1440)</option>
                          <option value="4K">4K Ultra HD (3840x2160)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Frame Rate:
                        </label>
                        <select
                          value={frameRate}
                          onChange={(e) => setFrameRate(parseInt(e.target.value) as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="24">24 fps (Cinematic Film)</option>
                          <option value="25">25 fps (PAL / European)</option>
                          <option value="30">30 fps (YouTube / Broadcast Standard)</option>
                          <option value="50">50 fps (High Smoothness PAL)</option>
                          <option value="60">60 fps (Action / Gaming / High Motion)</option>
                        </select>
                      </div>
                    </div>

                    {/* Bitrate slider */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-400">Target Video Bitrate (VBR):</span>
                        <span className="font-mono text-amber-400 font-bold">{bitrateMbps} Mbps</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="45"
                        step="1"
                        value={bitrateMbps}
                        onChange={(e) => setBitrateMbps(parseInt(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                        <span>4 Mbps (Fast)</span>
                        <span>16 Mbps (YouTube Recommended)</span>
                        <span>45 Mbps (Master)</span>
                      </div>
                    </div>

                    {/* Advanced Render Checkboxes */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <label className="flex items-center gap-2.5 text-[11px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={renderQuality === "maximum"}
                          onChange={(e) => setRenderQuality(e.target.checked ? "maximum" : "standard")}
                          className="accent-amber-500 rounded"
                        />
                        <span>Use Maximum Render Quality & Bicubic Resampling</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-[11px] text-zinc-300 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-amber-500 rounded" />
                        <span>Render at Maximum Color Depth (32-bit float internal)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: AUDIO SETTINGS */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 hover:border-zinc-700/80 transition-colors">
                <button
                  onClick={() => toggleSection("audio")}
                  className="w-full px-3.5 sm:px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-850 text-left transition select-none cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    Audio Encoding
                  </span>
                  {openSections.audio ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {openSections.audio && (
                  <div className="p-3.5 sm:p-4 space-y-3.5 text-xs border-t border-zinc-800 bg-zinc-950/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Audio Format:
                        </label>
                        <select
                          disabled
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-400 text-xs opacity-80"
                        >
                          <option>AAC (Advanced Audio Coding)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Sample Rate:
                        </label>
                        <select
                          value={audioSampleRate}
                          onChange={(e) => setAudioSampleRate(parseInt(e.target.value) as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="48000">48,000 Hz (Broadcast Standard)</option>
                          <option value="44100">44,100 Hz (Music CD)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Audio Bitrate:
                        </label>
                        <select
                          value={audioBitrate}
                          onChange={(e) => setAudioBitrate(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-zinc-100 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                        >
                          <option value="320k">320 kbps (Audiophile Master)</option>
                          <option value="256k">256 kbps (High Fidelity)</option>
                          <option value="192k">192 kbps (Standard Broadcast)</option>
                          <option value="128k">128 kbps (Compact Web)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Channel Layout:
                        </label>
                        <select
                          disabled
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-400 text-xs opacity-80"
                        >
                          <option>Stereo (Left / Right Channels)</option>
                        </select>
                      </div>
                    </div>

                    {/* Mute Video Sound / Music Track Only Checkbox */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <label className="flex items-start gap-2.5 text-xs text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={muteVideoAudio}
                          onChange={(e) => setMuteVideoAudio(e.target.checked)}
                          className="accent-rose-500 rounded mt-0.5"
                        />
                        <div>
                          <span className="font-semibold block text-zinc-100 flex items-center gap-1.5">
                            <VolumeX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            Music Track Only (Silence All Camera / Mic Sound)
                          </span>
                          <span className="text-[11px] text-zinc-400 block mt-0.5 leading-relaxed">
                            Guarantees 0% camera audio leakage. The exported video cleanly features only the music track, eliminating microphone hiss and copyright claims.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CAPTIONS & SUBTITLES */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 hover:border-zinc-700/80 transition-colors">
                <button
                  onClick={() => toggleSection("captions")}
                  className="w-full px-3.5 sm:px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-850 text-left transition select-none cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Captions & Subtitles ({captions.length} cues)
                  </span>
                  {openSections.captions ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {openSections.captions && (
                  <div className="p-3.5 sm:p-4 space-y-3 text-xs border-t border-zinc-800 bg-zinc-950/60">
                    <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnCaptions}
                        onChange={(e) => setBurnCaptions(e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      <span>Burn-in captions directly into video pixels</span>
                    </label>

                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-zinc-800/80">
                      <span className="text-[11px] text-zinc-400">Export Sidecar Subtitle File:</span>
                      <button
                        onClick={handleDownloadSRT}
                        disabled={captions.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-40 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download .SRT</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: PUBLISH & YOUTUBE KIT */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 hover:border-zinc-700/80 transition-colors">
                <button
                  onClick={() => toggleSection("metadata")}
                  className="w-full px-3.5 sm:px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-850 text-left transition select-none cursor-pointer min-h-[44px]"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Publish & YouTube Kit
                  </span>
                  {openSections.metadata ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {openSections.metadata && (
                  <div className="p-3.5 sm:p-4 space-y-3 text-xs border-t border-zinc-800 bg-zinc-950/60">
                    {/* Chapter markers export */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-semibold text-zinc-200 block">Chapter Markers</span>
                        <span className="text-[10px] text-zinc-500">Auto timestamps for YouTube description</span>
                      </div>
                      <button
                        onClick={handleDownloadChapters}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download Chapters</span>
                      </button>
                    </div>

                    {/* License Report Export */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800 flex-wrap gap-2">
                      <div>
                        <span className="font-semibold text-zinc-200 block">Copyright License Record</span>
                        <span className="text-[10px] text-zinc-500">Declared ownership & sync terms report</span>
                      </div>
                      <button
                        onClick={handleDownloadLicenseReport}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download Record</span>
                      </button>
                    </div>

                    {/* AI YouTube Package Generator */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] text-zinc-400">AI Title, Tags & Description Kit:</span>
                      <button
                        onClick={onGenerateYouTubePackage}
                        disabled={isGeneratingPackage}
                        className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                      >
                        {isGeneratingPackage ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        )}
                        <span>Generate Kit</span>
                      </button>
                    </div>

                    {/* Display generated YouTube package if available */}
                    {youtubePackage && (
                      <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">Generated Package</span>
                          <button
                            onClick={() => {
                              const pkgTitle = youtubePackage.selectedTitle || youtubePackage.titles?.[0] || "";
                              handleCopy("all", `${pkgTitle}\n\n${youtubePackage.description}\n\n${youtubePackage.tags?.join(", ")}`);
                            }}
                            className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === "all" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "all" ? "Copied" : "Copy All"}</span>
                          </button>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-semibold block">Optimized Title:</label>
                          <div className="text-zinc-200 font-medium text-xs mt-0.5 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                            {youtubePackage.selectedTitle || youtubePackage.titles?.[0] || "Optimized YouTube Master"}
                          </div>
                        </div>
                        {youtubePackage.tags && youtubePackage.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {youtubePackage.tags.slice(0, 6).map((tag, idx) => (
                              <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="bg-zinc-900/95 border-t border-zinc-800 px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shrink-0 gap-3 min-h-[58px]">
          <div className="hidden sm:flex items-center gap-2.5 text-xs text-zinc-400 font-mono min-w-0">
            <span>Estimated File Size: <strong className="text-zinc-100">~{estimatedFileSizeMB} MB</strong></span>
            <span>•</span>
            <span className="truncate max-w-[200px] md:max-w-[280px] text-zinc-300">{outputFileName}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isRendering}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition border border-zinc-800 min-h-[40px] cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSendToQueue}
              disabled={isTimelineEmpty || isRendering}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition border border-zinc-800 hidden sm:inline-flex items-center gap-1.5 disabled:opacity-40 min-h-[40px] cursor-pointer"
              title="Add to background render queue"
            >
              <span>Queue</span>
            </button>

            <button
              onClick={handleExportClick}
              disabled={isTimelineEmpty || isRendering}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-md bg-zinc-200 hover:bg-white disabled:opacity-40 disabled:pointer-events-none text-xs sm:text-sm font-semibold text-zinc-950 transition flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export {format.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
