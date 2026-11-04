import React from "react";
import {
  Sliders,
  Scissors,
  Copy,
  Trash2,
  Volume2,
  Gauge,
  ZoomIn,
  Crop,
  Layers,
  Sparkles,
  Info,
  Film,
  ChevronLeft,
} from "lucide-react";
import { MediaItem, ProjectSettings, TimelineClip, TimelineTrack } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface InspectorProps {
  selectedClip: TimelineClip | null;
  mediaItems: MediaItem[];
  project: ProjectSettings;
  currentTime: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onSplitClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onUpdateProject: (updates: Partial<ProjectSettings>) => void;
  onBackToStudio?: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedClip,
  mediaItems,
  project,
  currentTime,
  onUpdateClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onUpdateProject,
  onBackToStudio,
}) => {
  const media = selectedClip ? mediaItems.find((m) => m.id === selectedClip.mediaId) : null;

  if (!selectedClip) {
    return (
      <div className="w-full lg:w-72 bg-zinc-950 lg:border-l border-zinc-800 p-3 flex flex-col h-full min-h-0 select-none overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-200 px-1.5 py-1 transition min-h-[32px]"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-300">Project</h3>
          </div>
        </div>

        <div className="space-y-4 py-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Canvas Aspect Ratio:</label>
            <select
              value={project.aspectRatio}
              onChange={(e) => onUpdateProject({ aspectRatio: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-zinc-300 focus:outline-none focus:border-zinc-600"
            >
              <option value="16:9">16:9 (YouTube Standard)</option>
              <option value="9:16">9:16 (YouTube Shorts & TikTok)</option>
              <option value="1:1">1:1 (Square Social)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Export Resolution:</label>
            <select
              value={project.resolution}
              onChange={(e) => onUpdateProject({ resolution: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-zinc-300 focus:outline-none focus:border-zinc-600"
            >
              <option value="1080p">1080p (Full HD)</option>
              <option value="1440p">1440p (2K Quad HD)</option>
              <option value="4K">4K (Ultra HD)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Project Frame Rate:</label>
            <select
              value={project.frameRate}
              onChange={(e) => onUpdateProject({ frameRate: parseInt(e.target.value) as any })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-zinc-300 focus:outline-none focus:border-zinc-600"
            >
              <option value="24">24 fps (Cinematic Film)</option>
              <option value="25">25 fps (PAL Broadcast)</option>
              <option value="30">30 fps (Standard Web)</option>
              <option value="50">50 fps (European High Motion)</option>
              <option value="60">60 fps (Smooth Gaming/Action)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-zinc-800 space-y-1.5">
            <span className="text-[10px] text-zinc-500 block">Editing style</span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-300">{project.stylePreset || "Cinematic"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-72 bg-zinc-950 lg:border-l border-zinc-800 p-3 flex flex-col h-full min-h-0 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-200 px-1.5 py-1 transition min-h-[32px] shrink-0"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 text-zinc-500 shrink-0" />
            <h3 className="text-xs font-semibold text-zinc-300 truncate">
              Clip Inspector
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
          {selectedClip.trackType}
        </span>
      </div>

      <div className="space-y-3.5 py-3 text-xs">
        {/* Clip Title & Media Source */}
        <div>
          <h4 className="font-semibold text-zinc-200 truncate">{selectedClip.label || media?.name || "Timeline Clip"}</h4>
          {media && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Source: {media.format.toUpperCase()} • Duration: {formatTimecode(selectedClip.duration, false)}
            </p>
          )}
        </div>

        {/* Quick Clip Operations: Split, Duplicate, Delete */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
          <button
            onClick={() => onSplitClip(selectedClip.id)}
            className="flex-1 p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition"
            title="Split clip at playhead"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">Split</span>
          </button>
          <button
            onClick={() => onDuplicateClip(selectedClip.id)}
            className="flex-1 p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition"
            title="Duplicate clip"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">Duplicate</span>
          </button>
          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            className="flex-1 p-1.5 hover:bg-zinc-900 rounded text-zinc-500 hover:text-rose-300 flex items-center justify-center gap-1.5 transition"
            title="Delete clip"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">Delete</span>
          </button>
        </div>

        {/* Speed Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Gauge className="w-3.5 h-3.5 text-zinc-500" /> Playback Speed
            </span>
            <span className="font-mono text-zinc-400">{selectedClip.speed || 1}x</span>
          </div>
          <div className="flex items-center gap-1">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => onUpdateClip(selectedClip.id, { speed: s })}
                className={`flex-1 py-1 rounded text-[10px] font-mono transition ${
                  (selectedClip.speed || 1) === s
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900/60 text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume & Audio Ducking */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Volume2 className="w-3.5 h-3.5 text-zinc-500" /> Volume
            </span>
            <span className="font-mono text-zinc-400">{Math.round((selectedClip.volume ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={selectedClip.volume ?? 1}
            onChange={(e) => onUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-zinc-400 cursor-pointer"
          />
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedClip.ducking ?? false}
              onChange={(e) => onUpdateClip(selectedClip.id, { ducking: e.target.checked })}
              className="rounded accent-zinc-400"
            />
            <span className="text-[10px] text-zinc-400">Auto-duck volume under speech</span>
          </label>
        </div>

        {/* Zoom Scale */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <ZoomIn className="w-3.5 h-3.5 text-zinc-500" /> Cinematic Zoom
            </span>
            <span className="font-mono text-zinc-400">{((selectedClip.zoom || 1) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="1.6"
            step="0.02"
            value={selectedClip.zoom || 1}
            onChange={(e) => onUpdateClip(selectedClip.id, { zoom: parseFloat(e.target.value) })}
            className="w-full accent-zinc-400 cursor-pointer"
          />
        </div>

        {/* Reframe Mode */}
        <div className="space-y-1.5">
          <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
            <Crop className="w-3.5 h-3.5 text-zinc-500" /> Reframe / Focal Point
          </span>
          <select
            value={selectedClip.reframe || "center"}
            onChange={(e) => onUpdateClip(selectedClip.id, { reframe: e.target.value as any })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-zinc-300 focus:outline-none focus:border-zinc-600 text-xs"
          >
            <option value="center">Center Crop</option>
            <option value="face_focus">AI Face / Speaker Focus</option>
            <option value="fit">Fit Whole Frame (Letterbox)</option>
          </select>
        </div>

        {/* Transitions */}
        <div className="space-y-1.5">
          <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-zinc-500" /> Transition In
          </span>
          <select
            value={selectedClip.transitionIn || "None"}
            onChange={(e) => onUpdateClip(selectedClip.id, { transitionIn: e.target.value as any })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 text-zinc-300 focus:outline-none focus:border-zinc-600 text-xs"
          >
            <option value="None">None (Hard Cut)</option>
            <option value="Crossfade">Crossfade (Dissolve)</option>
            <option value="Dip to Black">Dip to Black</option>
            <option value="Zoom In">Dynamic Zoom In</option>
            <option value="Slide">Slide</option>
            <option value="Wipe">Wipe</option>
            <option value="Glitch">Glitch</option>
          </select>
        </div>
      </div>
    </div>
  );
};
