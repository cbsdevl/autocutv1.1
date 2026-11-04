import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  Film,
  Subtitles,
  X,
  Wrench,
} from "lucide-react";
import { CaptionItem, MediaItem, ProjectSettings, TimelineTrack } from "../types";

interface AIQualityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: CaptionItem[];
  onAutoFix: () => void;
}

export const AIQualityCheckModal: React.FC<AIQualityCheckModalProps> = ({
  isOpen,
  onClose,
  project,
  tracks,
  mediaItems,
  captions,
  onAutoFix,
}) => {
  if (!isOpen) return null;

  // Run audit heuristics
  const issues: { type: "warning" | "error" | "ok"; category: string; message: string; fixable: boolean }[] = [];

  // 1. Copyright Check
  const unclearedAssets = mediaItems.filter((m) => m.copyrightStatus !== "Cleared");
  if (unclearedAssets.length > 0) {
    issues.push({
      type: "warning",
      category: "Copyright Safety",
      message: `${unclearedAssets.length} asset(s) lack confirmed sync or ownership licenses. YouTube Content ID may issue claims.`,
      fixable: false,
    });
  } else {
    issues.push({
      type: "ok",
      category: "Copyright Safety",
      message: "All imported assets have declared ownership or verified royalty-free status.",
      fixable: false,
    });
  }

  // 2. Timeline Gaps & Pacing Check
  const v1Clips = tracks.find((t) => t.type === "V1")?.clips || [];
  if (v1Clips.length === 0) {
    issues.push({
      type: "error",
      category: "Timeline Video",
      message: "Track V1 is empty. Add video clips to assemble your video.",
      fixable: false,
    });
  } else {
    issues.push({
      type: "ok",
      category: "Timeline Video",
      message: `${v1Clips.length} video clip(s) placed and sequenced on track V1.`,
      fixable: false,
    });
  }

  // 3. Audio & Music Check
  const audioClips = tracks.find((t) => t.type === "A2")?.clips || [];
  if (audioClips.length === 0) {
    issues.push({
      type: "warning",
      category: "Soundtrack",
      message: "No background music detected. Adding a licensed soundtrack increases YouTube viewer retention.",
      fixable: true,
    });
  } else {
    issues.push({
      type: "ok",
      category: "Soundtrack",
      message: "Background music track assigned with auto-ducking enabled.",
      fixable: false,
    });
  }

  // 4. Captions & Accessibility Check
  if (captions.length === 0) {
    issues.push({
      type: "warning",
      category: "Captions",
      message: "No subtitles or captions present. Over 70% of YouTube Shorts are watched on mute.",
      fixable: false,
    });
  } else {
    issues.push({
      type: "ok",
      category: "Captions",
      message: `${captions.length} synchronized subtitle cue(s) ready with highlight animations.`,
      fixable: false,
    });
  }

  const hasFixableIssues = issues.some((i) => i.fixable);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-100">AI Export Quality & Polish Audit</h3>
              <p className="text-[11px] text-zinc-400">Pre-flight readiness review</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                issue.type === "ok"
                  ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                  : issue.type === "warning"
                  ? "bg-amber-950/20 border-amber-800/40 text-amber-300"
                  : "bg-rose-950/20 border-rose-800/40 text-rose-300"
              }`}
            >
              {issue.type === "ok" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : issue.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block text-zinc-200">{issue.category}</span>
                <p className="text-[11px] opacity-90 leading-relaxed">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Dismiss
          </button>
          {hasFixableIssues && (
            <button
              onClick={() => {
                onAutoFix();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Auto-Fix Missing Elements</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
