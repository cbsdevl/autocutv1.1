import React, { useEffect, useState } from "react";
import { Type, Plus, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Sparkles, ChevronLeft, RectangleHorizontal } from "lucide-react";
import { TextStyle, TimelineClip } from "../types";

interface TextEditorPanelProps {
  onAddTextToTimeline: (text: string, style: TextStyle, startTime?: number, duration?: number) => void;
  selectedClip: TimelineClip | null;
  onUpdateSelectedClip: (updates: Partial<TimelineClip>) => void;
  onBackToStudio?: () => void;
}

export const TextEditorPanel: React.FC<TextEditorPanelProps> = ({
  onAddTextToTimeline,
  selectedClip,
  onUpdateSelectedClip,
  onBackToStudio,
}) => {
  const [inputText, setInputText] = useState("NEW TITLE");
  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("rgba(0, 0, 0, 0.65)");
  const [positionY, setPositionY] = useState(50); // percentage
  const [positionX, setPositionX] = useState(50);
  const [fontFamily, setFontFamily] = useState<string>("sans-serif");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<"left"|"center"|"right">("center");
  const [outlineColor, setOutlineColor] = useState("#111827");
  const [outlineWidth, setOutlineWidth] = useState(0);
  const [hasShadow, setHasShadow] = useState(true);
  const [boxRadius, setBoxRadius] = useState(8);
  const [animation, setAnimation] = useState<NonNullable<TextStyle["animation"]>>("rise");
  const [animationDuration, setAnimationDuration] = useState(0.65);
  const [overlayDuration, setOverlayDuration] = useState(4);
  const selectedTextClip = selectedClip?.trackType === "T1" && selectedClip.text !== undefined ? selectedClip : null;

  useEffect(() => {
    if (!selectedTextClip) return;
    const style = selectedTextClip.textStyle;
    setInputText(selectedTextClip.text || "");
    setFontSize(style?.fontSize ?? 28);
    setFontColor(style?.color ?? "#ffffff");
    setBgColor(style?.backgroundColor ?? "transparent");
    setPositionX(style?.positionX ?? 50);
    setPositionY(style?.positionY ?? 82);
    setFontFamily(style?.fontFamily ?? "sans-serif");
    setBold(style?.bold ?? true);
    setItalic(style?.italic ?? false);
    setAlign(style?.align ?? "center");
    setOutlineColor(style?.outlineColor ?? "#111827");
    setOutlineWidth(style?.outlineWidth ?? 0);
    setHasShadow(style?.shadow ?? true);
    setBoxRadius(style?.boxRadius ?? 8);
    setAnimation(style?.animation ?? "none");
    setAnimationDuration(style?.animationDuration ?? 0.65);
    setOverlayDuration(selectedTextClip.duration || 4);
  }, [selectedTextClip?.id]);

  const presets = [
    {
      name: "YouTube Main Title",
      text: "ULTIMATE GUIDE",
      style: {
        fontFamily: "Inter, sans-serif",
        fontSize: 36,
        color: "#ffffff",
        backgroundColor: "transparent",
        positionX: 50,
        positionY: 50,
        bold: true,
        align: "center" as const,
        outlineColor: "#000000",
        outlineWidth: 2,
        shadow: true,
        animation: "rise" as const,
        animationDuration: 0.7,
      },
    },
    {
      name: "Lower Third Nameplate",
      text: "Alex Rivera | Travel Filmmaker",
      style: {
        fontFamily: "sans-serif",
        fontSize: 20,
        color: "#ffffff",
        backgroundColor: "rgba(24, 24, 27, 0.88)",
        positionX: 50,
        positionY: 82,
        bold: true,
        align: "left" as const,
        boxRadius: 4,
        shadow: true,
        animation: "slide" as const,
        animationDuration: 0.55,
      },
    },
    {
      name: "Subscribe CTA",
      text: "SUBSCRIBE  /  LIKE",
      style: {
        fontFamily: "sans-serif",
        fontSize: 22,
        color: "#ffffff",
        backgroundColor: "#dc2626",
        positionX: 78,
        positionY: 88,
        bold: true,
        align: "center" as const,
        boxRadius: 6,
        shadow: true,
        animation: "pop" as const,
        animationDuration: 0.4,
      },
    },
    {
      name: "Cinematic Header",
      text: "PART ONE  /  THE JOURNEY",
      style: {
        fontFamily: "serif",
        fontSize: 26,
        color: "#f4f4f5",
        backgroundColor: "transparent",
        positionX: 50,
        positionY: 30,
        italic: true,
        align: "center" as const,
        shadow: true,
        animation: "fade" as const,
        animationDuration: 1,
      },
    },
    {
      name: "Social Handle Badge",
      text: "@AutoCutAI #Creator",
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        color: "#38bdf8",
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        positionX: 50,
        positionY: 15,
        bold: true,
        align: "center" as const,
        boxRadius: 18,
        animation: "pop" as const,
        animationDuration: 0.45,
      },
    },
  ];

  const buildStyle = (): TextStyle => ({
    fontFamily,
    fontSize,
    color: fontColor,
    backgroundColor: bgColor,
    positionX,
    positionY,
    bold,
    italic,
    align,
    outlineColor,
    outlineWidth,
    shadow: hasShadow,
    boxRadius,
    animation,
    animationDuration,
  });

  const updateStyle = (patch: Partial<TextStyle>) => {
    const style = { ...buildStyle(), ...patch };
    if ("fontFamily" in patch) setFontFamily(style.fontFamily);
    if ("fontSize" in patch) setFontSize(style.fontSize);
    if ("color" in patch) setFontColor(style.color);
    if ("backgroundColor" in patch) setBgColor(style.backgroundColor || "transparent");
    if ("positionX" in patch) setPositionX(style.positionX);
    if ("positionY" in patch) setPositionY(style.positionY);
    if ("bold" in patch) setBold(Boolean(style.bold));
    if ("italic" in patch) setItalic(Boolean(style.italic));
    if ("align" in patch) setAlign(style.align || "center");
    if ("outlineColor" in patch) setOutlineColor(style.outlineColor || "#111827");
    if ("outlineWidth" in patch) setOutlineWidth(style.outlineWidth || 0);
    if ("shadow" in patch) setHasShadow(Boolean(style.shadow));
    if ("boxRadius" in patch) setBoxRadius(style.boxRadius || 0);
    if ("animation" in patch) setAnimation(style.animation || "none");
    if ("animationDuration" in patch) setAnimationDuration(style.animationDuration || 0.65);
    if (selectedTextClip) onUpdateSelectedClip({ textStyle: style });
  };

  const handleAdd = () => {
    if (!inputText.trim()) return;
    if (selectedTextClip) {
      onUpdateSelectedClip({ text: inputText.trim(), label: inputText.trim().slice(0, 24), textStyle: buildStyle(), duration: overlayDuration });
      return;
    }
    onAddTextToTimeline(inputText.trim(), buildStyle(), undefined, overlayDuration);
  };

  const handleUsePreset = (preset: typeof presets[0]) => {
    if (selectedTextClip) {
      setInputText(preset.text);
      setFontFamily(preset.style.fontFamily);
      setFontSize(preset.style.fontSize);
      setFontColor(preset.style.color);
      setBgColor(preset.style.backgroundColor || "transparent");
      setPositionX(preset.style.positionX);
      setPositionY(preset.style.positionY);
      setBold(preset.style.bold ?? true);
      setItalic(preset.style.italic ?? false);
      setAlign(preset.style.align ?? "center");
      setOutlineColor(preset.style.outlineColor ?? "#111827");
      setOutlineWidth(preset.style.outlineWidth ?? 0);
      setHasShadow(preset.style.shadow ?? true);
      setBoxRadius(preset.style.boxRadius ?? 8);
      setAnimation(preset.style.animation ?? "none");
      setAnimationDuration(preset.style.animationDuration ?? 0.65);
      onUpdateSelectedClip({ text: preset.text, label: preset.name, textStyle: preset.style });
    } else {
      onAddTextToTimeline(preset.text, preset.style, undefined, overlayDuration);
    }
  };

  const handlePresetDragStart = (event: React.DragEvent, preset: typeof presets[0]) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-autocut-overlay", JSON.stringify({
      text: preset.text,
      style: preset.style,
      duration: overlayDuration,
    }));
  };

  const handleCustomDragStart = (event: React.DragEvent) => {
    if (!inputText.trim()) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-autocut-overlay", JSON.stringify({
      text: inputText.trim(),
      style: buildStyle(),
      duration: overlayDuration,
    }));
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
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-amber-400" />
              Titles & Graphic Overlays
            </h2>
            <p className="text-[10px] text-zinc-500">Lower thirds, headlines, and call-to-actions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 text-xs">
        {/* Presets List */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
            Overlay Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(event) => handlePresetDragStart(event, p)}
                className="min-h-20 bg-zinc-950 border border-zinc-800 hover:border-amber-500/60 rounded-md p-2 flex flex-col justify-between group transition cursor-grab active:cursor-grabbing"
              >
                <button type="button" onClick={() => handleUsePreset(p)} className="min-w-0 text-left">
                  <span className="mb-2 flex h-7 items-center overflow-hidden rounded-sm px-2 text-[10px] font-bold" style={{ backgroundColor: p.style.backgroundColor, color: p.style.color, borderRadius: p.style.boxRadius ?? 2 }}>
                    <span className="truncate">{p.text}</span>
                  </span>
                  <span className="block truncate text-[10px] font-semibold text-zinc-200">{p.name}</span>
                  <span className="mt-0.5 block text-[9px] text-zinc-500">Drag to T1</span>
                </button>
                <div className="mt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleUsePreset(p)}
                    className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800 text-zinc-300 transition hover:bg-amber-400 hover:text-zinc-950"
                    title={selectedTextClip ? "Apply style to selected title" : "Add preset at playhead"}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Text Creator */}
        <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-300">{selectedTextClip ? "Edit selected overlay" : "Custom overlay"}</span>
            {selectedTextClip && <span className="text-[9px] font-mono text-amber-300">T1 / GRAPHICS</span>}
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (selectedTextClip) onUpdateSelectedClip({ text: e.target.value, label: e.target.value.slice(0, 24) });
            }}
            placeholder="Type your title text..."
            aria-label="Overlay text"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:outline-none focus:border-amber-500 text-xs"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Font Size ({fontSize}px)</label>
              <input
                type="range"
                min="14"
                max="96"
                value={fontSize}
                onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Duration ({overlayDuration.toFixed(1)}s)</label>
              <input
                type="range"
                min="0.5"
                max="20"
                step="0.5"
                value={overlayDuration}
                onChange={(e) => {
                  const duration = parseFloat(e.target.value);
                  setOverlayDuration(duration);
                  if (selectedTextClip) onUpdateSelectedClip({ duration });
                }}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Horizontal Position ({positionX}%)</label>
              <input type="range" min="5" max="95" value={positionX} onChange={(e) => updateStyle({ positionX: parseInt(e.target.value) })} className="w-full accent-amber-400 cursor-pointer" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Vertical Position ({positionY}%)</label>
              <input type="range" min="5" max="95" value={positionY} onChange={(e) => updateStyle({ positionY: parseInt(e.target.value) })} className="w-full accent-amber-400 cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Text Color</label>
              <input
                type="color"
                value={fontColor}
                onChange={(e) => updateStyle({ color: e.target.value })}
                className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Background Box</label>
              <select
                value={bgColor}
                onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-zinc-300 text-xs h-7"
              >
                <option value="rgba(0, 0, 0, 0.7)">Dark Box</option>
                <option value="rgba(225, 29, 72, 0.85)">Red Banner</option>
                <option value="rgba(14, 165, 233, 0.85)">Sky Banner</option>
                <option value="rgba(16, 185, 129, 0.9)">Emerald Tag</option>
                <option value="rgba(24, 24, 27, 0.88)">Lower Third</option>
                <option value="transparent">No Background</option>
              </select>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">Font Family</label>
            <select value={fontFamily} onChange={e => updateStyle({ fontFamily: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-zinc-300 text-xs">
              <option value="sans-serif">Sans-Serif (Clean)</option>
              <option value="serif">Serif (Editorial)</option>
              <option value="monospace">Monospace (Code/Tech)</option>
              <option value="'Georgia', serif">Georgia (Classic)</option>
              <option value="'Impact', sans-serif">Impact (Bold Title)</option>
            </select>
          </div>

          {/* Style toggles + Align */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 shrink-0">Style:</span>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-[11px] font-bold">
              <button type="button" aria-label="Bold" aria-pressed={bold} onClick={() => updateStyle({ bold: !bold })}
                className={`px-2.5 py-1 transition flex items-center gap-1 ${bold ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                <Bold className="w-3 h-3" />
              </button>
              <button type="button" aria-label="Italic" aria-pressed={italic} onClick={() => updateStyle({ italic: !italic })}
                className={`px-2.5 py-1 transition flex items-center gap-1 ${italic ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                <Italic className="w-3 h-3" />
              </button>
            </div>
            <span className="text-[10px] text-zinc-400 ml-1 shrink-0">Align:</span>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                <button key={a} type="button" aria-label={`Align ${a}`} aria-pressed={align === a} onClick={() => updateStyle({ align: a })}
                  className={`px-2 py-1 transition ${align===a ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3">
            <label className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
              Outline
              <input type="color" value={outlineColor} onChange={(e) => updateStyle({ outlineColor: e.target.value })} className="h-6 w-8 cursor-pointer border-0 bg-transparent" />
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-400">
              Stroke
              <input type="range" min="0" max="6" step="1" value={outlineWidth} onChange={(e) => updateStyle({ outlineWidth: Number(e.target.value) })} className="min-w-0 flex-1 accent-amber-400" />
              <span className="w-3 font-mono">{outlineWidth}</span>
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-400">
              Card corners
              <input type="range" min="0" max="24" step="2" value={boxRadius} onChange={(e) => updateStyle({ boxRadius: Number(e.target.value) })} className="min-w-0 flex-1 accent-amber-400" />
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-400">
              <input type="checkbox" checked={hasShadow} onChange={(e) => updateStyle({ shadow: e.target.checked })} className="accent-amber-400" />
              Drop shadow
            </label>
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="title-animation" className="text-[10px] font-semibold text-zinc-300">Entrance animation</label>
              <select
                id="title-animation"
                value={animation}
                onChange={(e) => updateStyle({ animation: e.target.value as NonNullable<TextStyle["animation"]> })}
                className="min-w-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-amber-400"
              >
                <option value="none">None</option>
                <option value="fade">Soft Fade</option>
                <option value="rise">Rise Up</option>
                <option value="pop">Pop In</option>
                <option value="slide">Slide In</option>
                <option value="reveal">Wipe Reveal</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 text-[10px] text-zinc-400">
              <span>Motion length <span className="font-mono text-amber-300">{animationDuration.toFixed(2)}s</span></span>
              <input
                type="range"
                min="0.15"
                max="1.5"
                step="0.05"
                value={animationDuration}
                disabled={animation === "none"}
                onChange={(e) => updateStyle({ animationDuration: Number(e.target.value) })}
                className="w-24 accent-amber-400 disabled:opacity-40"
              />
            </label>
          </div>

          <button
            type="button"
            draggable
            onDragStart={handleCustomDragStart}
            onClick={handleAdd}
            title="Click to add or update, or drag this overlay to the T1 graphics track"
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg transition text-xs flex items-center justify-center gap-1.5 shadow cursor-grab active:cursor-grabbing"
          >
            {selectedTextClip ? <RectangleHorizontal className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{selectedTextClip ? "Update selected overlay" : "Add overlay at playhead"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
