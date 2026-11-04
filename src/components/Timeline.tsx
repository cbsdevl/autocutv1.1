import React, { useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  Scissors,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  Magnet,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Layers,
  Film,
  Music,
  Type,
  Subtitles,
  Mic,
  ChevronLeft,
  ChevronRight,
  Sliders,
  X,
} from "lucide-react";
import { CaptionItem, MediaItem, TimelineClip, TimelineTrack, TrackType } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface TimelineProps {
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: CaptionItem[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  onSelectClip: (clip: TimelineClip | null) => void;
  onUpdateTracks: (tracks: TimelineTrack[]) => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSplitClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onApplyTransitionAtCut: (leftClipId: string, rightClipId: string, transition: NonNullable<TimelineClip["transitionIn"]>, duration: number) => void;
  onAddTextToTimeline: (text: string, style: NonNullable<TimelineClip["textStyle"]>, startTime: number, duration: number) => void;
  isVideoAudioMuted?: boolean;
  onToggleVideoAudioMuted?: () => void;
  onOpenInspector?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  mediaItems,
  captions,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClipId,
  onSelectClip,
  onUpdateTracks,
  onSeek,
  onTogglePlay,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onApplyTransitionAtCut,
  onAddTextToTimeline,
  isVideoAudioMuted = true,
  onToggleVideoAudioMuted,
  onOpenInspector,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Zoom: pixels per second (default 30px per sec)
  const [zoomLevel, setZoomLevel] = useState<number>(35);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);

  // Dragging / Trimming state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [overlayDropTrackId, setOverlayDropTrackId] = useState<string | null>(null);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    startClientX: number;
    initialStartTime: number;
    trackId: string;
  } | null>(null);

  const [trimmingHandle, setTrimmingHandle] = useState<{
    clipId: string;
    side: "left" | "right";
    startClientX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  // Keyboard shortcuts (Spacebar, Delete, Split 'S')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === "KeyS" && selectedClipId) {
        e.preventDefault();
        onSplitClip(selectedClipId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        onDeleteClip(selectedClipId);
      } else if (e.code === "KeyD" && selectedClipId) {
        e.preventDefault();
        onDuplicateClip(selectedClipId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, onTogglePlay, onSplitClip, onDeleteClip, onDuplicateClip]);

  // Handle Playhead Scrubbing (Mouse & Touch)
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    updatePlayheadFromClientX(e.clientX);
  };

  const handleRulerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setIsScrubbing(true);
      updatePlayheadFromClientX(e.touches[0].clientX);
    }
  };

  const updatePlayheadFromClientX = (clientX: number) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const scrollLeft = tracksContainerRef.current.scrollLeft;
    const clickX = clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, clickX / zoomLevel);
    onSeek(newTime);
  };

  const updatePlayheadFromMouseEvent = (e: React.MouseEvent | MouseEvent) => {
    updatePlayheadFromClientX(e.clientX);
  };

  // Mouse & Touch Move/Up Listeners for dragging / trimming / scrubbing
  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (isScrubbing) {
        updatePlayheadFromClientX(clientX);
      } else if (draggingClip) {
        const deltaX = clientX - draggingClip.startClientX;
        const deltaTime = deltaX / zoomLevel;
        let newStartTime = Math.max(0, draggingClip.initialStartTime + deltaTime);

        // Magnetic Snapping
        if (isSnapping) {
          if (Math.abs(newStartTime) < 0.2) newStartTime = 0;
          if (Math.abs(newStartTime - currentTime) < 0.2) newStartTime = currentTime;
        }

        const updatedTracks = tracks.map((track) => {
          if (track.id === draggingClip.trackId) {
            return {
              ...track,
              clips: track.clips.map((c) =>
                c.id === draggingClip.clipId ? { ...c, startTime: newStartTime } : c
              ),
            };
          }
          return track;
        });
        onUpdateTracks(updatedTracks);
      } else if (trimmingHandle) {
        const deltaX = clientX - trimmingHandle.startClientX;
        const deltaTime = deltaX / zoomLevel;

        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

        const updatedTracks = tracks.map((track) => {
          return {
            ...track,
            clips: track.clips.map((c) => {
              if (c.id !== trimmingHandle.clipId) return c;

              const media = mediaItems.find((m) => m.id === c.mediaId);
              const mediaDuration = Math.max(0.1, media?.duration || c.duration || 1);
              const minVisibleDuration = 0.3;
              const speedFactor = c.speed || 1;
              const trimStart = c.trimStart || 0;
              const trimEnd = c.trimEnd || 0;

              if (trimmingHandle.side === "left") {
                const deltaSource = deltaTime * speedFactor;
                const newTrimStart = clamp(trimStart + deltaSource, 0, mediaDuration - trimEnd - minVisibleDuration);
                const newDuration = clamp(c.duration - deltaTime, minVisibleDuration, mediaDuration - newTrimStart - trimEnd);

                return {
                  ...c,
                  startTime: Math.max(0, trimmingHandle.initialStart + deltaTime),
                  duration: newDuration,
                  trimStart: newTrimStart,
                };
              }

              const deltaSource = deltaTime * speedFactor;
              const newTrimEnd = clamp(trimEnd - deltaSource, 0, mediaDuration - trimStart - minVisibleDuration);
              const newDuration = clamp(c.duration + deltaTime, minVisibleDuration, mediaDuration - trimStart - newTrimEnd);

              return {
                ...c,
                duration: newDuration,
                trimEnd: newTrimEnd,
              };
            }),
          };
        });
        onUpdateTracks(updatedTracks);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsScrubbing(false);
      setDraggingClip(null);
      setTrimmingHandle(null);
    };

    if (isScrubbing || draggingClip || trimmingHandle) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleEnd);
      window.addEventListener("touchcancel", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [isScrubbing, draggingClip, trimmingHandle, zoomLevel, tracks, isSnapping, currentTime]);

  // Drop media from library directly into timeline tracks
  const handleTrackDrop = (e: React.DragEvent, track: TimelineTrack) => {
    e.preventDefault();
    try {
      const overlayData = e.dataTransfer.getData("application/x-autocut-overlay");
      if (overlayData) {
        if (track.type !== "T1") return;
        const overlay = JSON.parse(overlayData);
        if (typeof overlay.text !== "string" || !overlay.text.trim() || !overlay.style) return;
        const rect = tracksContainerRef.current?.getBoundingClientRect();
        const scrollLeft = tracksContainerRef.current?.scrollLeft || 0;
        const dropX = rect ? e.clientX - rect.left + scrollLeft : 0;
        const dropTime = Math.max(0, dropX / zoomLevel);
        onAddTextToTimeline(overlay.text, overlay.style, dropTime, Number(overlay.duration) || 4);
        return;
      }

      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const { mediaId } = JSON.parse(dataStr);
      const media = mediaItems.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = tracksContainerRef.current?.getBoundingClientRect();
      const scrollLeft = tracksContainerRef.current?.scrollLeft || 0;
      const dropX = rect ? e.clientX - rect.left + scrollLeft : 0;
      const dropTime = Math.max(0, dropX / zoomLevel);

      const newClip: TimelineClip = {
        id: "clip_" + Date.now(),
        mediaId: media.id,
        trackType: track.type,
        trackId: track.id,
        startTime: dropTime,
        duration: media.duration || 5,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        volume: 1,
        label: media.name,
      };

      const updated = tracks.map((t) =>
        t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t
      );
      onUpdateTracks(updated);
      onSelectClip(newClip);
    } catch (err) {
      console.warn("Drop error:", err);
    }
  };

  // Track controls
  const toggleTrackMute = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleTrackVisibility = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
    );
  };

  const toggleTrackLock = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  const timelineWidth = Math.max(1200, (totalDuration + 15) * zoomLevel);

  // Time markers on the ruler
  const stepSeconds = zoomLevel > 50 ? 1 : zoomLevel > 20 ? 2 : 5;
  const numMarkers = Math.ceil((totalDuration + 15) / stepSeconds);

  // Selected clip object for quick-action floating tool strip
  const selectedClip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null;

  return (
    <div className="h-full bg-zinc-950 border-t border-zinc-800 flex flex-col select-none overflow-hidden z-20 relative">
      {/* Mobile Floating Quick-Action Bar for Selected Clip */}
      {selectedClip && (
        <div className="md:hidden absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 flex items-center gap-1">
          <span className="text-[10px] font-medium text-zinc-300 max-w-[70px] truncate px-1">
            {selectedClip.label || "Clip"}
          </span>
          <div className="w-[1px] h-3.5 bg-zinc-700" />
          <button
            onClick={() => onSplitClip(selectedClip.id)}
            className="p-1 text-zinc-300 hover:text-white rounded active:bg-zinc-800"
            title="Split Clip at Playhead"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            onClick={() => onDuplicateClip(selectedClip.id)}
            className="p-1 text-zinc-300 hover:text-white rounded active:bg-zinc-800"
            title="Duplicate Clip"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            className="p-1 text-zinc-300 hover:text-rose-400 rounded active:bg-zinc-800"
            title="Delete Clip"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          </button>
          {onOpenInspector && (
            <>
              <div className="w-[1px] h-3.5 bg-zinc-700" />
              <button
                onClick={onOpenInspector}
                className="flex items-center gap-1 text-[10px] font-bold text-zinc-100 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full active:bg-amber-500/30"
                title="Inspect Clip"
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>Inspect</span>
              </button>
            </>
          )}
          <button
            onClick={() => onSelectClip(null)}
            className="p-0.5 text-zinc-500 hover:text-zinc-300 ml-0.5"
            title="Deselect"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Timeline Toolbar */}
      <div className="h-9 bg-zinc-950 border-b border-zinc-800 px-2 sm:px-3 flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 shrink-0">
        {/* Left: Split, Duplicate, Delete tools */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => selectedClipId && onSplitClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Split Clip at Playhead (S)"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 disabled:pointer-events-none font-medium transition min-h-[30px]"
          >
            <Scissors className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Split (S)</span>
          </button>
          <button
            onClick={() => selectedClipId && onDuplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Duplicate Clip (D)"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 disabled:pointer-events-none font-medium transition min-h-[30px]"
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button
            onClick={() => selectedClipId && onDeleteClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Delete Selected Clip (Del)"
            className="p-1.5 rounded text-zinc-500 hover:text-rose-300 hover:bg-zinc-900 disabled:opacity-30 disabled:pointer-events-none transition min-h-[30px] min-w-[30px] flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 sm:mx-1.5 hidden xs:block" />

          {/* Snapping Toggle */}
          <button
            onClick={() => setIsSnapping(!isSnapping)}
            title="Toggle Magnet Snapping (N)"
            className={`p-1.5 rounded transition min-h-[30px] min-w-[30px] flex items-center justify-center ${
              isSnapping
                ? "text-amber-400"
                : "text-zinc-600 hover:text-zinc-300"
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Playhead Timecode & Video Audio Mode Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-1 sm:gap-2 px-1">
            <span className="hidden xs:inline text-zinc-600">TIME</span>
            <span className="text-zinc-200 font-mono sm:hidden">{formatTimecode(currentTime, false)}</span>
            <span className="text-zinc-200 font-mono hidden sm:inline">{formatTimecode(currentTime, true)}</span>
          </div>

          {onToggleVideoAudioMuted && (
            <button
              onClick={onToggleVideoAudioMuted}
              title="Toggle muting all video camera audio so only uploaded music plays"
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium transition cursor-pointer min-h-[30px] ${
                isVideoAudioMuted
                  ? "text-rose-300 hover:bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {isVideoAudioMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Video Sound: Muted</span>
                  <span className="sm:hidden">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Video Sound: Active</span>
                  <span className="sm:hidden">Active</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setZoomLevel(Math.max(15, zoomLevel - 8))}
            className="p-1 sm:p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white min-w-[28px] min-h-[28px] flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="15"
            max="100"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseInt(e.target.value))}
            className="w-14 sm:w-20 accent-amber-400 h-1 cursor-pointer hidden sm:block"
          />
          <button
            onClick={() => setZoomLevel(Math.min(100, zoomLevel + 8))}
            className="p-1 sm:p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white min-w-[28px] min-h-[28px] flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Workspace (Tracks Headers on left + Track Lanes on right) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers */}
          <div className="w-12 sm:w-18 md:w-28 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 z-20">
          {/* Empty corner above tracks for the ruler */}
          <div className="h-6 bg-zinc-950 border-b border-zinc-800 px-1 sm:px-2 flex items-center justify-between text-[9px] text-zinc-600 font-mono">
            <span className="hidden md:inline">TRACKS</span>
            <span className="md:hidden">TRK</span>
          </div>

          {/* Track Headers */}
          <div className="flex-1 overflow-hidden flex flex-col justify-between py-1">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-8 px-1 sm:px-2 flex items-center justify-between border-b border-zinc-900 text-[11px] text-zinc-400 font-medium"
              >
                <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {track.type}
                  </span>
                  <span className="truncate text-xs hidden md:inline">{track.label}</span>
                </div>

                <div className="flex items-center gap-1 text-zinc-500">
                  {track.type.startsWith("A") ? (
                    <button
                      onClick={() => toggleTrackMute(track.id)}
                      className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                      title={track.muted ? "Unmute track" : "Mute track"}
                    >
                      {track.muted ? (
                        <VolumeX className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-zinc-400 hover:text-zinc-200" />
                      )}
                    </button>
                  ) : track.type.startsWith("V") ? (
                    <>
                      <button
                        onClick={() => toggleTrackMute(track.id)}
                        className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                        title={
                          track.muted || isVideoAudioMuted
                            ? "Video sound muted - Click to unmute"
                            : "Click to mute video sound"
                        }
                      >
                        {track.muted || isVideoAudioMuted ? (
                          <VolumeX className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Volume2 className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleTrackVisibility(track.id)}
                        className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                        title={track.visible ? "Hide track" : "Show track"}
                      >
                        {track.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-zinc-600" />
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleTrackVisibility(track.id)}
                      className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                      title={track.visible ? "Hide track" : "Show track"}
                    >
                      {track.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-zinc-600" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => toggleTrackLock(track.id)}
                    className="hover:text-zinc-200"
                    title={track.locked ? "Unlock track" : "Lock track"}
                  >
                    {track.locked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Track Lanes + Scrubbable Ruler */}
        <div
          ref={tracksContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative flex flex-col bg-zinc-950"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative flex-1 flex flex-col">
            {/* Top Ruler Bar */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              onTouchStart={handleRulerTouchStart}
              className="h-6 bg-zinc-950 border-b border-zinc-800 relative cursor-pointer select-none touch-none"
            >
              {Array.from({ length: numMarkers }).map((_, idx) => {
                const sec = idx * stepSeconds;
                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-zinc-900 text-[9px] font-mono text-zinc-600 pl-1 pt-0.5"
                    style={{ left: `${sec * zoomLevel}px` }}
                  >
                    {formatTimecode(sec, false)}
                  </div>
                );
              })}
            </div>

            {/* Playhead Red Cursor Line */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
              style={{ left: `${currentTime * zoomLevel}px` }}
            >
              <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1" />
              <div className="w-px flex-1 bg-rose-500" />
            </div>

            {/* Tracks Stack */}
            <div className="flex-1 flex flex-col justify-between py-1 relative">
              {tracks.every((t) => t.clips.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-4">
                  <div className="px-4 py-2 text-center pointer-events-auto">
                    <p className="text-xs font-medium text-zinc-400">Your timeline is empty</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      Upload your videos, audio, or photos in the Media Library and drag them onto track V1/A2.
                    </p>
                  </div>
                </div>
              )}
              {tracks.map((track) => (
                <div
                  key={track.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.types.includes("application/x-autocut-overlay")) {
                      setOverlayDropTrackId(track.type === "T1" ? track.id : null);
                      e.dataTransfer.dropEffect = track.type === "T1" ? "copy" : "none";
                    }
                  }}
                  onDragLeave={() => setOverlayDropTrackId(null)}
                  onDrop={(e) => {
                    setOverlayDropTrackId(null);
                    handleTrackDrop(e, track);
                  }}
                  className={`h-8 border-b border-zinc-900 relative transition ${
                    track.locked ? "opacity-50 pointer-events-none" : ""
                  } ${overlayDropTrackId === track.id ? "bg-amber-400/15 ring-1 ring-inset ring-amber-300/60" : ""}`}
                >
                  {overlayDropTrackId === track.id && track.type === "T1" && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-amber-400/10 text-[10px] font-semibold text-amber-200 pointer-events-none">
                      Release to place overlay
                    </div>
                  )}
                  {(["V1", "V2"].includes(track.type) ? [...track.clips].sort((a, b) => a.startTime - b.startTime) : [])
                    .slice(1)
                    .map((rightClip, index, orderedClips) => {
                      const leftClip = orderedClips[index];
                      const cutTime = leftClip.startTime + leftClip.duration;
                      if (Math.abs(cutTime - rightClip.startTime) > 1 / 30 + 0.001) return null;
                      return (
                        <div
                          key={`transition-drop-${leftClip.id}-${rightClip.id}`}
                          onDragOver={(event) => {
                            if (event.dataTransfer.types.includes("application/x-autocut-transition")) {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = "copy";
                            }
                          }}
                          onDrop={(event) => {
                            const payload = event.dataTransfer.getData("application/x-autocut-transition");
                            if (!payload) return;
                            event.preventDefault();
                            event.stopPropagation();
                            try {
                              const data = JSON.parse(payload);
                              onApplyTransitionAtCut(leftClip.id, rightClip.id, data.transition, Number(data.duration));
                            } catch (error) {
                              console.warn("Transition drop error:", error);
                            }
                          }}
                          className="absolute inset-y-0 z-30 w-6 -translate-x-1/2 cursor-copy rounded-sm border border-transparent hover:border-cyan-300 hover:bg-cyan-300/25"
                          style={{ left: `${cutTime * zoomLevel}px` }}
                          title="Drop transition on this cut"
                          aria-label={`Drop transition between ${leftClip.label || "clip"} and ${rightClip.label || "clip"}`}
                        />
                      );
                    })}

                  {/* Clips on this track */}
                  {track.clips.map((clip) => {
                    const media = mediaItems.find((m) => m.id === clip.mediaId);
                    const isSelected = selectedClipId === clip.id;
                    const clipLeft = clip.startTime * zoomLevel;
                    const clipWidth = Math.max(16, clip.duration * zoomLevel);

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip);
                          setDraggingClip({
                            clipId: clip.id,
                            startClientX: e.clientX,
                            initialStartTime: clip.startTime,
                            trackId: track.id,
                          });
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length > 0) {
                            e.stopPropagation();
                            onSelectClip(clip);
                            setDraggingClip({
                              clipId: clip.id,
                              startClientX: e.touches[0].clientX,
                              initialStartTime: clip.startTime,
                              trackId: track.id,
                            });
                          }
                        }}
                        className={`absolute top-0.5 bottom-0.5 rounded-sm overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-between text-xs transition-colors touch-none ${
                          isSelected
                            ? "ring-1 ring-amber-400 z-10"
                            : "hover:brightness-125"
                        } ${
                          track.type === "V1"
                            ? "bg-zinc-800 border border-zinc-700 text-zinc-100"
                            : track.type === "V2"
                            ? "bg-cyan-950/70 border border-cyan-900 text-cyan-100"
                            : track.type === "T1"
                            ? "bg-emerald-950/60 border border-emerald-900 text-emerald-100"
                            : track.type === "C1"
                            ? "bg-amber-950/50 border border-amber-900 text-amber-100"
                            : "bg-rose-950/50 border border-rose-900 text-rose-100"
                        }`}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`,
                        }}
                      >
                        {clip.transitionIn && clip.transitionIn !== "None" && (
                          <div
                            title={`${clip.transitionIn} in - ${(clip.transitionDuration ?? 0.5).toFixed(2)}s`}
                            className="absolute inset-y-0 left-0 z-10 w-px bg-cyan-300 pointer-events-none"
                          />
                        )}
                        {clip.transitionOut && clip.transitionOut !== "None" && (
                          <div
                            title={`${clip.transitionOut} out - ${(clip.transitionDuration ?? 0.5).toFixed(2)}s`}
                            className="absolute inset-y-0 right-0 z-10 w-px bg-cyan-300 pointer-events-none"
                          />
                        )}

                        {/* Left Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              clipId: clip.id,
                              side: "left",
                              startClientX: e.clientX,
                              initialStart: clip.startTime,
                              initialDuration: clip.duration,
                            });
                          }}
                          onTouchStart={(e) => {
                            if (e.touches.length > 0) {
                              e.stopPropagation();
                              setTrimmingHandle({
                                clipId: clip.id,
                                side: "left",
                                startClientX: e.touches[0].clientX,
                                initialStart: clip.startTime,
                                initialDuration: clip.duration,
                              });
                            }
                          }}
                          className="w-3.5 sm:w-2.5 h-full bg-zinc-950/50 hover:bg-white/50 cursor-ew-resize shrink-0 flex items-center justify-center touch-none"
                          title="Trim Head"
                        />

                        {/* Clip Content (Thumbnail strip or Waveform + Label) */}
                        <div className="flex-1 min-w-0 px-1 sm:px-2 flex items-center gap-1.5 overflow-hidden">
                          {media?.thumbnail && track.type === "V1" && (
                            <img
                              src={media.thumbnail}
                              alt=""
                              className="w-5 h-5 rounded object-cover shrink-0 hidden xs:block"
                            />
                          )}
                          <span className="text-[10px] sm:text-[11px] font-bold truncate leading-none">
                            {clip.label || media?.name || "Clip"}
                          </span>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              clipId: clip.id,
                              side: "right",
                              startClientX: e.clientX,
                              initialStart: clip.startTime,
                              initialDuration: clip.duration,
                            });
                          }}
                          onTouchStart={(e) => {
                            if (e.touches.length > 0) {
                              e.stopPropagation();
                              setTrimmingHandle({
                                clipId: clip.id,
                                side: "right",
                                startClientX: e.touches[0].clientX,
                                initialStart: clip.startTime,
                                initialDuration: clip.duration,
                              });
                            }
                          }}
                          className="w-3.5 sm:w-2.5 h-full bg-zinc-950/50 hover:bg-white/50 cursor-ew-resize shrink-0 flex items-center justify-center touch-none"
                          title="Trim Tail"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
