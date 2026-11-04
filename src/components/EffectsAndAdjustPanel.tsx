import React, { useState } from "react";
import {
  Sparkles,
  Sliders,
  Layers,
  Wand2,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  CircleDot,
  Check,
  Scissors,
  UserCheck,
  Volume2,
  ChevronLeft,
  RotateCcw,
  Focus,
  Trash2,
} from "lucide-react";
import { TimelineClip } from "../types";

interface EffectsAndAdjustPanelProps {
  type: "transitions" | "effects" | "adjust" | "ai_tools";
  selectedClip: TimelineClip | null;
  canApplyTransition?: boolean;
  hasTransitionAtBoundary?: boolean;
  onApplyTransitionAtBoundary?: (transition: NonNullable<TimelineClip["transitionIn"]>, duration: number) => void;
  onChangeBoundaryTransitionDuration?: (duration: number) => void;
  onUpdateSelectedClip: (updates: Partial<TimelineClip>) => void;
  onApplyPresetToAll: (lut: string) => void;
  onRunSilenceCut: () => void;
  onRunFaceReframe: () => void;
  onRunAudioNormalize: () => void;
  onBackToStudio?: () => void;
}

export const EffectsAndAdjustPanel: React.FC<EffectsAndAdjustPanelProps> = ({
  type,
  selectedClip,
  canApplyTransition = false,
  hasTransitionAtBoundary = false,
  onApplyTransitionAtBoundary,
  onChangeBoundaryTransitionDuration,
  onUpdateSelectedClip,
  onApplyPresetToAll,
  onRunSilenceCut,
  onRunFaceReframe,
  onRunAudioNormalize,
  onBackToStudio,
}) => {
  const [defaultTransitionDuration, setDefaultTransitionDuration] = useState(0.5);
  const [lutScope, setLutScope] = useState<'clip'|'all'>('clip');
  const transitionsList = [
    { id: "None", name: "Hard Cut", desc: "Instant edit", color: "#a1a1aa", mark: "CUT" },
    { id: "Crossfade", name: "Cross Dissolve", desc: "Blend between shots", color: "#22d3ee", mark: "A+B" },
    { id: "Dip to Black", name: "Dip to Black", desc: "Fade through black", color: "#71717a", mark: "BLACK" },
    { id: "Zoom In", name: "Push In", desc: "Scale into the next shot", color: "#fbbf24", mark: "ZOOM" },
    { id: "Slide", name: "Slide", desc: "Directional frame movement", color: "#34d399", mark: "MOVE" },
    { id: "Wipe", name: "Wipe", desc: "Clean edge reveal", color: "#60a5fa", mark: "WIPE" },
    { id: "Glitch", name: "Digital Glitch", desc: "Brief signal breakup", color: "#fb7185", mark: "RGB" },
  ] as const;
  const transitionDuration = selectedClip?.transitionDuration ?? defaultTransitionDuration;

  const updateTransitionDuration = (duration: number) => {
    if (canApplyTransition && (selectedClip?.transitionIn || selectedClip?.transitionOut)) {
      onChangeBoundaryTransitionDuration?.(duration);
    } else {
      setDefaultTransitionDuration(duration);
    }
  };

  const applyTransition = (transition: typeof transitionsList[number]["id"]) => {
    if (!canApplyTransition) return;
    onApplyTransitionAtBoundary?.(transition, transitionDuration);
  };

  const colorLuts = [
    { id: "natural", name: "Natural Film", desc: "Balanced skin tones and true whites", b: 1, c: 1.05, s: 1.05, temp: 0, v: 0 },
    { id: "cinematic", name: "Cinematic Teal & Orange", desc: "Hollywood blockbuster aesthetic", b: 1.02, c: 1.15, s: 1.18, temp: -5, v: 0.25 },
    { id: "vivid", name: "YouTube Vivid Pop", desc: "Scroll-stopping saturation and high contrast", b: 1.05, c: 1.12, s: 1.3, temp: 5, v: 0.1 },
    { id: "warm_amber", name: "Golden Hour Glow", desc: "Sunset warmth for travel and romance", b: 1.03, c: 1.08, s: 1.2, temp: 15, v: 0.15 },
    { id: "dramatic_bw", name: "Dramatic Noir B&W", desc: "High-contrast monochrome", b: 0.98, c: 1.35, s: 0, temp: 0, v: 0.35 },
    { id: "neon", name: "Cyber Neon", desc: "Vibrant gaming and music video edge", b: 1.08, c: 1.22, s: 1.45, temp: -15, v: 0.2 },
  ];

  const filter = selectedClip?.filter || {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    vignette: 0,
    sharpen: 0,
  };

  const handleSliderChange = (key: keyof typeof filter, value: number) => {
    if (!selectedClip) return;
    onUpdateSelectedClip({
      filter: {
        ...filter,
        [key]: value,
      },
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none overflow-hidden">
      {/* Header */}
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            {type === "transitions" ? (
              <>
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Transitions
              </>
            ) : type === "effects" ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Video Effects & LUTs
              </>
            ) : type === "adjust" ? (
              <>
                <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Color Grading & Adjust
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 text-rose-400" /> AI Video Tools
              </>
            )}
          </h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* TRANSITIONS PANEL */}
        {type === "transitions" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">Cut transition</h3>
                <p className="text-[11px] text-zinc-500 mt-1 truncate">
                  {canApplyTransition ? `Between clips at ${selectedClip?.label || "selected edit"}` : "Select a split clip beside an adjoining clip"}
                </p>
              </div>
              <Layers className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
            </div>

            <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
              <div className="flex items-center justify-between">
                <label htmlFor="transition-duration" className="text-[11px] font-medium text-zinc-300">Duration</label>
                <div className="flex items-center gap-1">
                  <input
                    id="transition-duration"
                    type="number"
                    min="0.1"
                    max="2"
                    step="0.05"
                    value={transitionDuration.toFixed(2)}
                    disabled={!canApplyTransition}
                    onChange={(event) => updateTransitionDuration(Math.max(0.1, Math.min(2, Number(event.target.value))))}
                    className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right font-mono text-xs text-cyan-200 outline-none focus:border-cyan-400 disabled:opacity-40"
                  />
                  <span className="text-[10px] text-zinc-500">sec</span>
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.05"
                value={transitionDuration}
                disabled={!canApplyTransition}
                aria-label="Transition duration"
                onChange={(event) => updateTransitionDuration(Number(event.target.value))}
                className="w-full accent-cyan-400 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] font-mono text-zinc-600"><span>0.1s</span><span>1.0s</span><span>2.0s</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {transitionsList.map((transition) => {
                const isSelected = selectedClip?.transitionIn === transition.id || selectedClip?.transitionOut === transition.id;
                return (
                  <button
                    key={transition.id}
                    type="button"
                    draggable
                    onClick={() => applyTransition(transition.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData("application/x-autocut-transition", JSON.stringify({
                        transition: transition.id,
                        duration: transitionDuration,
                      }));
                    }}
                    aria-pressed={isSelected}
                    title={canApplyTransition ? `Click to apply or drag ${transition.name} to another cut` : `Drag ${transition.name} onto a cut`}
                    className={`min-h-[76px] cursor-grab rounded-md border p-2 text-left transition active:cursor-grabbing ${isSelected ? "border-cyan-400/70 bg-cyan-950/40 ring-1 ring-cyan-400/20" : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-600"}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex h-6 min-w-8 items-center justify-center rounded-sm bg-zinc-900 px-1 font-mono text-[9px] font-bold" style={{ color: transition.color }}>{transition.mark}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-cyan-300" />}
                    </div>
                    <span className="block text-[11px] font-semibold text-zinc-200">{transition.name}</span>
                    <span className="mt-0.5 block text-[9px] text-zinc-500">{transition.desc}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!canApplyTransition || !hasTransitionAtBoundary}
              onClick={() => applyTransition("None")}
              className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-rose-900/70 bg-rose-950/30 px-3 text-[11px] font-semibold text-rose-200 transition hover:border-rose-700 hover:bg-rose-950/60 disabled:cursor-not-allowed disabled:opacity-40"
              title="Remove the transition from this cut"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove transition
            </button>
            {!canApplyTransition && <p className="text-[10px] text-zinc-500">Transitions apply only across an adjoining edit. Split a clip, then select either side of the cut.</p>}
          </div>
        )}

        {/* EFFECTS & LUTS PANEL */}
        {type === "effects" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-400">Select a cinematic color grade LUT:</p>
              <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-[10px] font-bold">
                {(['clip','all'] as const).map(s => (
                  <button key={s} onClick={() => setLutScope(s)}
                    className={`px-2.5 py-1 transition ${lutScope===s ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                    {s === 'clip' ? 'Clip' : 'Project'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {colorLuts.map((lut) => (
                <button
                  key={lut.id}
                  onClick={() => {
                    if (selectedClip && lutScope === 'clip') {
                      onUpdateSelectedClip({
                        filter: { brightness: lut.b, contrast: lut.c, saturation: lut.s, temperature: lut.temp, vignette: lut.v, lut: lut.id },
                      });
                    } else {
                      onApplyPresetToAll(lut.id);
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-2.5 rounded-xl text-left transition space-y-1 group"
                >
                  <div className="h-10 rounded-lg bg-zinc-900 overflow-hidden relative border border-zinc-800">
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          lut.id === "cinematic"
                            ? "linear-gradient(135deg, #0d9488 0%, #ea580c 100%)"
                            : lut.id === "vivid"
                            ? "linear-gradient(135deg, #e11d48 0%, #f59e0b 100%)"
                            : lut.id === "dramatic_bw"
                            ? "linear-gradient(135deg, #18181b 0%, #d4d4d8 100%)"
                            : lut.id === "warm_amber"
                            ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
                            : lut.id === "neon"
                            ? "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)"
                            : "linear-gradient(135deg, #52525b 0%, #a1a1aa 100%)",
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                    {lut.name}
                  </h4>
                  <p className="text-[9px] text-zinc-500 line-clamp-1">{lut.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => onApplyPresetToAll("cinematic")}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-lg transition"
            >
              Apply Cinematic LUT to All Clips
            </button>
          </div>
        )}

        {/* ADJUST PANEL */}
        {type === "adjust" && (
          <div className="space-y-4">
            {!selectedClip ? (
              <div className="p-4 text-center border border-dashed border-zinc-800 rounded-xl">
                <Sliders className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-300">Select a clip to adjust</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Click on any video or image clip in the timeline to adjust lighting and color sliders.
                </p>
              </div>
            ) : (
              <>
                {/* Brightness */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.brightness * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={filter.brightness}
                    onChange={(e) => handleSliderChange("brightness", parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Contrast className="w-3.5 h-3.5 text-indigo-400" /> Contrast
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.contrast * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.6"
                    step="0.05"
                    value={filter.contrast}
                    onChange={(e) => handleSliderChange("contrast", parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Droplets className="w-3.5 h-3.5 text-rose-400" /> Saturation
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.saturation * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={filter.saturation}
                    onChange={(e) => handleSliderChange("saturation", parseFloat(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                </div>

                {/* Vignette */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <CircleDot className="w-3.5 h-3.5 text-zinc-400" /> Vignette Shadow
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round((filter.vignette || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={filter.vignette || 0}
                    onChange={(e) => handleSliderChange("vignette", parseFloat(e.target.value))}
                    className="w-full accent-zinc-400 cursor-pointer"
                  />
                </div>

                {/* Temperature */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Thermometer className="w-3.5 h-3.5 text-sky-400" /> Temperature
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">{filter.temperature > 0 ? '+' : ''}{filter.temperature}K</span>
                  </div>
                  <input type="range" min="-50" max="50" step="1"
                    value={filter.temperature}
                    onChange={e => handleSliderChange("temperature", parseFloat(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* Sharpen */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Focus className="w-3.5 h-3.5 text-emerald-400" /> Sharpen
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">{Math.round((filter.sharpen||0)*100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05"
                    value={filter.sharpen||0}
                    onChange={e => handleSliderChange("sharpen", parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* Reset Button */}
                <button
                  onClick={() =>
                    onUpdateSelectedClip({
                      filter: { brightness: 1, contrast: 1, saturation: 1, temperature: 0, vignette: 0, sharpen: 0 },
                    })
                  }
                  className="w-full py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" /> Reset All Adjustments
                </button>
              </>
            )}
          </div>
        )}

        {/* AI TOOLS PANEL */}
        {type === "ai_tools" && (
          <div className="space-y-2.5">
            <p className="text-[11px] text-zinc-400">
              One-click specialized AI automation tools:
            </p>

            <button
              onClick={onRunSilenceCut}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-amber-400">
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>Auto Silence & Dead-Air Remover</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Detects pauses over 0.6s and trims empty gaps for ultra-crisp YouTube Vlog pacing.
              </p>
            </button>

            <button
              onClick={onRunFaceReframe}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-indigo-400">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>Smart Face-Centering & Auto-Reframe</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Maintains face and speaker focus when converting 16:9 widescreen footage into 9:16 Shorts.
              </p>
            </button>

            <button
              onClick={onRunAudioNormalize}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-emerald-400">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Audio Loudness Normalization & Ducking</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Balances voice peaks to -14 LUFS standard and ducks background music under spoken words.
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
