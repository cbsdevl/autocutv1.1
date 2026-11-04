import React, { useState } from "react";
import { Film, Sparkles, X, Layers, Check } from "lucide-react";
import { AspectRatio, ProjectSettings } from "../types";
import { EDITING_PRESETS } from "../data/presets";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: ProjectSettings, loadDemoMedia: boolean) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState("My Video Project");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<"1080p" | "1440p" | "4K">("1080p");
  const [frameRate, setFrameRate] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [stylePreset, setStylePreset] = useState("Cinematic");
  const [loadDemoMedia, setLoadDemoMedia] = useState(false);

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreateProject(
      {
        id: "proj_" + Date.now(),
        name: name.trim() || "Untitled Video Project",
        aspectRatio,
        resolution,
        frameRate,
        stylePreset,
        autoSave: true,
        duration: 0,
      },
      loadDemoMedia
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Create New Video Project</h3>
              <p className="text-[11px] text-zinc-400">Configure canvas and AI editing preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Project Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Target Format & Aspect Ratio:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "16:9", label: "16:9 Landscape", sub: "YouTube Videos" },
                { id: "9:16", label: "9:16 Portrait", sub: "Shorts & Reels" },
                { id: "1:1", label: "1:1 Square", sub: "Instagram Post" },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setAspectRatio(fmt.id as AspectRatio)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    aspectRatio === fmt.id
                      ? "bg-zinc-800 border-amber-500 text-amber-300 font-bold shadow"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-xs block">{fmt.label}</span>
                  <span className="text-[10px] text-zinc-500 font-normal">{fmt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Resolution:</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
              >
                <option value="1080p">1080p (Full HD)</option>
                <option value="1440p">1440p (2K QHD)</option>
                <option value="4K">4K (Ultra HD)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Framerate:</label>
              <select
                value={frameRate}
                onChange={(e) => setFrameRate(parseInt(e.target.value) as any)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
              >
                <option value="24">24 fps (Film)</option>
                <option value="30">30 fps (Web)</option>
                <option value="60">60 fps (Gaming/Action)</option>
              </select>
            </div>
          </div>

          {/* Quick Start with Demo Assets checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
            <input
              type="checkbox"
              checked={loadDemoMedia}
              onChange={(e) => setLoadDemoMedia(e.target.checked)}
              className="rounded accent-amber-500 w-4 h-4"
            />
            <div>
              <span className="text-xs font-bold text-zinc-200 block">
                Load Sample Royalty-Free Footage (Optional)
              </span>
              <span className="text-[10px] text-zinc-500">
                Leave unchecked to start blank and use only your own imported media files.
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
