import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Film,
  CheckCircle2,
  X,
  Play,
  Sparkles,
  AlertTriangle,
  RotateCcw,
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
import { formatTimecode } from "../utils/mediaUtils";
import { getTimelineDuration } from "../utils/renderEngine";

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

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  tracks,
  mediaItems,
  onStartRender,
  onCancelRender,
  renderProgress,
}) => {
  // Simple CapCut-style settings
  const [outputFileName, setOutputFileName] = useState(() => {
    return `${project.name.replace(/\s+/g, "_")}_Export.mp4`;
  });
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4K">("1080p");
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");

  // Sync project default name on open
  useEffect(() => {
    if (isOpen) {
      const baseName = project.name.replace(/\s+/g, "_");
      setOutputFileName(`${baseName}_Export.mp4`);
    }
  }, [isOpen, project.name]);

  // Calculate actual timeline duration
  const calculatedDuration = useMemo(() => {
    return Math.ceil(getTimelineDuration(tracks));
  }, [tracks]);

  const effectiveDuration = calculatedDuration || 10;

  // Estimated file size (MB) based on resolution and duration
  const estimatedFileSizeMB = useMemo(() => {
    const bitrateMbps = resolution === "4K" ? 35 : resolution === "1080p" ? 14 : 7;
    const mb = (bitrateMbps * effectiveDuration) / 8 + 0.5;
    return Math.max(0.5, mb).toFixed(1);
  }, [resolution, effectiveDuration]);

  if (!isOpen) return null;

  const isRendering = Boolean(renderProgress?.isRendering);
  const hasFinishedRender = Boolean(renderProgress?.downloadUrl && !isRendering);
  const isTimelineEmpty = tracks.every((t) => t.clips.length === 0);

  // Smooth, non-reversing progress percentage
  const displayPercent = Math.min(
    100,
    Math.max(0, Math.round(renderProgress?.progress || renderProgress?.percent || 0))
  );
  const downloadFileName =
    renderProgress?.format === "WEBM" && /\.mp4$/i.test(outputFileName)
      ? outputFileName.replace(/\.mp4$/i, ".webm")
      : outputFileName;

  const handleFormatChange = (newFormat: "mp4" | "webm") => {
    setFormat(newFormat);
    setOutputFileName((prev) => {
      const base = prev.replace(/\.(mp4|webm)$/i, "");
      return `${base}.${newFormat}`;
    });
  };

  const handleExportClick = () => {
    const bitrateMbps = resolution === "4K" ? 35 : resolution === "1080p" ? 14 : 7;
    const finalName = outputFileName.endsWith(`.${format}`)
      ? outputFileName
      : `${outputFileName.replace(/\.(mp4|webm)$/i, "")}.${format}`;

    onStartRender({
      format,
      fileName: finalName,
      resolution,
      frameRate,
      quality: resolution === "4K" ? "maximum" : "high",
      bitrateMbps,
      durationMode: "full",
      renderQuality: "standard",
      audioSampleRate: 48000,
      audioBitrate: "192k",
      muteVideoAudio: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-zinc-100 flex flex-col">
        
        {/* Simple CapCut Header Bar */}
        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Film className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 leading-none">Export Video</h2>
              <span className="text-[11px] text-zinc-400 font-mono mt-0.5 block truncate max-w-[200px]">
                {project.name} • {project.aspectRatio}
              </span>
            </div>
          </div>

          {!isRendering && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 flex flex-col justify-center">
          {isRendering ? (
            /* 1. SIMPLE CAPCUT RENDERING PROGRESS VIEW */
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-5">
              {/* Large Centered Percentage */}
              <div className="relative flex items-center justify-center">
                <div className="w-28 h-28 rounded-full border-4 border-zinc-800 border-t-amber-500 animate-spin" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold font-mono text-zinc-100">
                    {displayPercent}%
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 mt-0.5">
                    Rendering
                  </span>
                </div>
              </div>

              {/* Status Message */}
              <div className="space-y-1.5 max-w-xs">
                <h3 className="text-sm font-bold text-zinc-100">
                  Exporting Your Video...
                </h3>
                <p className="text-xs text-zinc-400">
                  {renderProgress?.status || "Processing video frames with local GPU acceleration..."}
                </p>
              </div>

              {/* Smooth Progress Bar */}
              <div className="w-full max-w-sm space-y-1.5">
                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, displayPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Hardware Fast Engine</span>
                  <span>{formatTimecode(effectiveDuration, false, frameRate)}</span>
                </div>
              </div>

              {/* Cancel Button */}
              <button
                onClick={onCancelRender}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition border border-zinc-800 cursor-pointer min-h-[36px]"
              >
                Cancel Export
              </button>
            </div>
          ) : hasFinishedRender ? (
            /* 2. SIMPLE CAPCUT FINISHED & DOWNLOAD VIEW */
            <div className="py-2 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100">Export Complete!</h3>
                <p className="text-xs text-zinc-400">
                  Your video is ready for immediate download and sharing.
                </p>
              </div>

              {/* Video Player Preview */}
              <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-inner">
                <video
                  src={renderProgress?.downloadUrl}
                  controls
                  playsInline
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Video Specs Badge */}
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span>{resolution}</span>
                <span>•</span>
                <span>{frameRate} fps</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">
                  {renderProgress?.fileSize
                    ? `${(renderProgress.fileSize / (1024 * 1024)).toFixed(1)} MB`
                    : `~${estimatedFileSizeMB} MB`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full pt-1">
                <button
                  onClick={onCancelRender}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition border border-zinc-800 cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Export Again</span>
                </button>

                <a
                  href={renderProgress?.downloadUrl}
                  download={downloadFileName}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer min-h-[42px] flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Video</span>
                </a>
              </div>
            </div>
          ) : (
            /* 3. SIMPLE CAPCUT CONFIGURATION VIEW */
            <div className="space-y-4">
              {/* File Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition"
                    placeholder="My_Video_Export.mp4"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] font-mono text-zinc-500 pointer-events-none">
                    .{format}
                  </span>
                </div>
              </div>

              {/* Resolution Segmented Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Resolution</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {resolution === "4K" ? "3840 x 2160" : resolution === "1080p" ? "1920 x 1080" : "1280 x 720"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["720p", "1080p", "4K"] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer flex flex-col items-center justify-center ${
                        resolution === res
                          ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      <span>{res}</span>
                      {res === "1080p" && (
                        <span className="text-[9px] text-amber-400/90 font-normal leading-none mt-0.5">
                          Recommended
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate Segmented Selector */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-zinc-300">Frame Rate</span>
                <div className="grid grid-cols-3 gap-2">
                  {([24, 30, 60] as const).map((fpsVal) => (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => setFrameRate(fpsVal)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer flex flex-col items-center justify-center ${
                        frameRate === fpsVal
                          ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                      }`}
                    >
                      <span>{fpsVal} fps</span>
                      <span className="text-[9px] text-zinc-500 font-normal leading-none mt-0.5">
                        {fpsVal === 30 ? "Standard" : fpsVal === 60 ? "Smooth" : "Cinematic"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Selector */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-zinc-300">Format</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFormatChange("mp4")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                      format === "mp4"
                        ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    MP4 (Universal)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormatChange("webm")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                      format === "webm"
                        ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    WEBM (Web Standard)
                  </button>
                </div>
              </div>

              {/* Empty Timeline Warning */}
              {isTimelineEmpty && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Timeline is empty. Please add video or audio to your timeline first.</span>
                </div>
              )}

              {/* Error Notice */}
              {renderProgress?.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Render Notice</span>
                    <span className="text-rose-400 text-[11px] block">{renderProgress.errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Summary Bar */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="text-[11px]">Duration: {formatTimecode(effectiveDuration, false, frameRate)}</span>
                <span className="text-zinc-200 font-bold">~{estimatedFileSizeMB} MB</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition border border-zinc-800 min-h-[42px] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExportClick}
                  disabled={isTimelineEmpty || isRendering}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer min-h-[42px] flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Export Video</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
