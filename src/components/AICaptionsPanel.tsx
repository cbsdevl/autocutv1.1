import React, { useState } from "react";
import {
  Subtitles,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  AlignLeft,
  AlignCenter,
  Type,
  Palette,
  Check,
  Languages,
  ChevronLeft,
} from "lucide-react";
import { CaptionItem } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface AICaptionsPanelProps {
  captions: CaptionItem[];
  onUpdateCaptions: (captions: CaptionItem[]) => void;
  onGenerateAICaptions: (style: string) => Promise<void>;
  isTranscribing: boolean;
  selectedCaptionStyle: string;
  onSelectCaptionStyle: (style: string) => void;
  onBackToStudio?: () => void;
}

export const AICaptionsPanel: React.FC<AICaptionsPanelProps> = ({
  captions,
  onUpdateCaptions,
  onGenerateAICaptions,
  isTranscribing,
  selectedCaptionStyle,
  onSelectCaptionStyle,
  onBackToStudio,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCaptionText, setNewCaptionText] = useState("");
  const [newStart, setNewStart] = useState<number>(0);
  const [newEnd, setNewEnd] = useState<number>(3);

  const captionStyles = [
    { id: "YouTube", name: "YouTube Classic", preview: "Black semi-transparent bar, bold white text" },
    { id: "TikTok", name: "TikTok Viral", preview: "Large centered font with active word pops" },
    { id: "Shorts", name: "Shorts Punch", preview: "High-contrast color badge with heavy outline" },
    { id: "Karaoke", name: "Karaoke Glow", preview: "Real-time active golden word highlight" },
    { id: "Cinematic", name: "Cinematic", preview: "Letterspaced elegant serif at bottom center" },
    { id: "Minimal", name: "Minimal Clean", preview: "Subtle modern font with drop shadow" },
    { id: "Bold", name: "Bold Impact", preview: "Massive uppercase yellow & white lettering" },
  ];

  const handleAddCaption = () => {
    if (!newCaptionText.trim()) return;
    const newItem: CaptionItem = {
      id: "c_" + Date.now(),
      startTime: Number(newStart) || 0,
      endTime: Number(newEnd) || (Number(newStart) || 0) + 3,
      text: newCaptionText.trim(),
      highlightWords: newCaptionText.trim().split(" ").slice(0, 2),
    };
    onUpdateCaptions([...captions, newItem].sort((a, b) => a.startTime - b.startTime));
    setNewCaptionText("");
  };

  const handleDeleteCaption = (id: string) => {
    onUpdateCaptions(captions.filter((c) => c.id !== id));
  };

  const handleUpdateText = (id: string, text: string) => {
    onUpdateCaptions(captions.map((c) => (c.id === id ? { ...c, text } : c)));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none overflow-hidden">
      {/* Captions Header */}
      <div className="p-2.5 sm:p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 transition active:scale-95 min-h-[32px]"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
              AI Subtitles & Captions
            </h2>
            <p className="text-[10px] text-zinc-500">Auto Speech-to-Text & Karaoke</p>
          </div>
        </div>
      </div>

      {/* Auto Speech-to-Text Generator CTA */}
      <div className="p-3 border-b border-zinc-800/70 bg-indigo-950/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Automatic Speech-to-Text
          </span>
          <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
            <Languages className="w-3 h-3" /> Auto-Detect
          </span>
        </div>
        <button
          onClick={() => onGenerateAICaptions(selectedCaptionStyle)}
          disabled={isTranscribing}
          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {isTranscribing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Transcribing Speech with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Captions from Audio</span>
            </>
          )}
        </button>
      </div>

      {/* Style Selector */}
      <div className="p-3 border-b border-zinc-800/70 space-y-2">
        <label className="text-[11px] font-bold text-zinc-300 block">Caption Style:</label>
        <div className="grid grid-cols-2 gap-1.5">
          {captionStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => onSelectCaptionStyle(style.id)}
              className={`p-2 rounded-lg text-left border transition ${
                selectedCaptionStyle === style.id
                  ? "bg-zinc-800 border-indigo-500 text-indigo-300 font-semibold"
                  : "bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{style.name}</span>
                {selectedCaptionStyle === style.id && <Check className="w-3 h-3 text-indigo-400" />}
              </div>
              <p className="text-[9px] text-zinc-500 truncate mt-0.5">{style.preview}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Captions List & Manual Editor */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Timeline Subtitles ({captions.length})
          </span>
        </div>

        {captions.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl">
            <Subtitles className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-300 font-semibold">No captions generated yet</p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Click "Generate Captions from Audio" above or add cues manually below.
            </p>
          </div>
        ) : (
          captions.map((cap) => (
            <div
              key={cap.id}
              className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5 group hover:border-zinc-700 transition"
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="font-mono text-zinc-400">
                  {formatTimecode(cap.startTime, false)} → {formatTimecode(cap.endTime, false)}
                </span>
                <button
                  onClick={() => handleDeleteCaption(cap.id)}
                  className="text-zinc-600 hover:text-rose-400 p-0.5 transition"
                  title="Delete caption"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={cap.text}
                onChange={(e) => handleUpdateText(cap.id, e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
              {cap.highlightWords && cap.highlightWords.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[9px]">
                  <span className="text-zinc-500">Highlighted words:</span>
                  {cap.highlightWords.map((w, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* Add Manual Caption Row */}
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-2 mt-3">
          <span className="text-[11px] font-bold text-zinc-300 block">Add Manual Subtitle Cue:</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 block">Start (sec)</label>
              <input
                type="number"
                step="0.5"
                value={newStart}
                onChange={(e) => setNewStart(parseFloat(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">End (sec)</label>
              <input
                type="number"
                step="0.5"
                value={newEnd}
                onChange={(e) => setNewEnd(parseFloat(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Enter subtitle line..."
              value={newCaptionText}
              onChange={(e) => setNewCaptionText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCaption()}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddCaption}
              className="px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
