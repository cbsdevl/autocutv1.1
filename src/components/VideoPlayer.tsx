import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { CaptionItem, MediaItem, ProjectSettings, TimelineClip, TimelineTrack, VideoFit } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface VideoPlayerProps {
  project: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: CaptionItem[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onStepFrame: (direction: number) => void;
  selectedClip: TimelineClip | null;
  isVideoAudioMuted?: boolean;
  onToggleVideoAudioMuted?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  tracks,
  mediaItems,
  captions,
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  onTogglePlay,
  onStepFrame,
  selectedClip,
  isVideoAudioMuted = true,
  onToggleVideoAudioMuted,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Persistent video element — src-swapped on clip change, never remounted (prevents black flash)
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  // Reactive state so freeze canvas re-renders correctly (useRef is NOT reactive)
  const [hasCapturedFrame, setHasCapturedFrame] = useState<boolean>(false);
  // Track both identity and URL because restored media receives a fresh object URL.
  const lastMediaSourceRef = useRef<string | null>(null);

  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<VideoFit>("contain");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(true);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const generatedBlobUrlRef = useRef<string | null>(null);

  const isUsableBrowserMediaUrl = useCallback((url?: string) => {
    if (!url || !url.trim()) return false;
    const trimmed = url.trim();
    if (/^(?:blob:|data:|https?:\/\/)/i.test(trimmed)) return true;
    if (/^(?:file:\/\/|[a-zA-Z]:[\\/]|\\\\|\/)/i.test(trimmed)) return false;
    return true;
  }, []);

  const getPlaybackUrl = useCallback((media: MediaItem | null): string | null => {
    if (!media) return null;
    if (media.file) {
      if (media.blobUrl && media.blobUrl.startsWith("blob:")) return media.blobUrl;
      if (media.url.startsWith("blob:")) return media.url;
      const freshUrl = URL.createObjectURL(media.file);
      if (generatedBlobUrlRef.current && generatedBlobUrlRef.current !== freshUrl) {
        URL.revokeObjectURL(generatedBlobUrlRef.current);
      }
      generatedBlobUrlRef.current = freshUrl;
      return freshUrl;
    }
    return isUsableBrowserMediaUrl(media.url) ? media.url : null;
  }, [isUsableBrowserMediaUrl]);

  // Track lookups
  const v1Track = tracks.find((t) => t.type === "V1" && t.visible);
  const v2Track = tracks.find((t) => t.type === "V2" && t.visible);
  const t1Track = tracks.find((t) => t.type === "T1" && t.visible);

  // Active clip finder with high tolerance and resilient track fallback
  const activeClip = useMemo(() => {
    const findVisibleClip = (clips: TimelineClip[]) => {
      const orderedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
      const exact = orderedClips.find(
        (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      );
      if (exact) return exact;

      const previous = [...orderedClips]
        .reverse()
        .find((clip) => clip.startTime + clip.duration <= currentTime);
      return previous || orderedClips[0] || null;
    };

    if (v1Track && v1Track.clips.length > 0) {
      return findVisibleClip(v1Track.clips);
    }

    if (v2Track && v2Track.clips.length > 0) {
      return findVisibleClip(v2Track.clips);
    }

    return null;
  }, [v1Track, v2Track, currentTime]);

  // V2 Overlay clip if V1 is already active
  const activeV2Clip = v1Track?.clips.length
    ? v2Track?.clips.find(
        (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
      )
    : null;

  const activeTextClip = t1Track?.clips.find(
    (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
  );

  const textMotionStyle = useMemo(() => {
    if (!activeTextClip?.textStyle) return {};
    const style = activeTextClip.textStyle;
    const animation = style.animation || "none";
    if (animation === "none") return {};
    const duration = Math.max(0.15, style.animationDuration || 0.65);
    const progress = Math.max(0, Math.min(1, (currentTime - activeTextClip.startTime) / duration));
    const eased = 1 - Math.pow(1 - progress, 3);
    if (animation === "rise") return { opacity: eased, transform: `translateY(${(1 - eased) * 30}px)` };
    if (animation === "pop") return { opacity: eased, transform: `scale(${0.72 + eased * 0.28})` };
    if (animation === "slide") return { opacity: eased, transform: `translateX(${(1 - eased) * -48}px)` };
    if (animation === "reveal") return { clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)` };
    return { opacity: eased };
  }, [activeTextClip, currentTime]);

  // Resilient active media resolution:
  // If activeClip exists, find media by id; fallback to any video media item
  const activeMedia = useMemo(() => {
    if (activeClip) {
      return mediaItems.find((m) => m.id === activeClip.mediaId) ||
        mediaItems.find((m) => m.name.trim().toLocaleLowerCase() === activeClip.label?.trim().toLocaleLowerCase()) ||
        null;
    }
    return null;
  }, [activeClip, mediaItems]);

  // ── Src-swap: swap video src imperatively when active media changes ──────────
  // This prevents React from remounting the <video> element, which is what causes
  // the black-frame flash. The freeze canvas holds the last frame while the new
  // video loads.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const newSourceKey = activeMedia ? `${activeMedia.id}:${getPlaybackUrl(activeMedia)}` : null;
    if (newSourceKey === lastMediaSourceRef.current) return;
    lastMediaSourceRef.current = newSourceKey;

    if (!activeMedia || activeMedia.type !== "video") {
      // No video clip — freeze canvas holds last frame; pause the element
      if (!video.paused) video.pause();
      return;
    }

    if (!activeMedia.file && !isUsableBrowserMediaUrl(activeMedia.url)) {
      setVideoLoadError("This project has the original file path, but the file data is not available in browser storage. Re-import the original file to restore playback.");
      setIsVideoReady(true);
      return;
    }

    // Show freeze canvas while new clip loads
    setIsVideoReady(false);
    setVideoLoadError(null);

    // Prefer the original File-backed blob to avoid dead blob URLs from prior browser sessions.
    const newSrc = getPlaybackUrl(activeMedia);
    if (!newSrc) {
      setVideoLoadError("This video is missing from the project storage. Re-import the original file to restore it.");
      setIsVideoReady(true);
      return;
    }

    if (video.src !== newSrc) {
      if (!newSrc.startsWith("blob:") && !newSrc.startsWith("data:")) {
        video.crossOrigin = "anonymous";
      } else {
        video.removeAttribute("crossorigin");
      }
      video.src = newSrc;
      video.load();
    }
  }, [activeMedia, getPlaybackUrl, isUsableBrowserMediaUrl]);

  const overlayMedia = activeV2Clip
    ? mediaItems.find((m) => m.id === activeV2Clip.mediaId)
    : null;

  // Active caption
  const activeCaption = captions.find(
    (cap) => currentTime >= cap.startTime && currentTime <= cap.endTime
  );

  // Capture current video frame into freeze canvas to prevent black flash during cut handoffs
  const captureFrameToCanvas = useCallback((videoEl: HTMLVideoElement) => {
    if (!freezeCanvasRef.current || videoEl.readyState < 2) return;
    try {
      const canvas = freezeCanvasRef.current;
      if (videoEl.videoWidth > 0 && canvas.width !== videoEl.videoWidth) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
      }
      const ctx = canvas.getContext("2d");
      if (ctx && videoEl.videoWidth > 0) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        setHasCapturedFrame(true);  // reactive — triggers re-render so freeze canvas shows
      }
    } catch {
      // Ignored
    }
  }, []);

  // Strict imperative muting on video element (guarantees camera audio is silenced)
  useEffect(() => {
    if (videoRef.current) {
      const shouldMute =
        isVideoAudioMuted ||
        Boolean(v1Track?.muted) ||
        isMuted ||
        (activeClip?.volume ?? 1) <= 0.001;

      videoRef.current.muted = shouldMute;
      videoRef.current.volume = shouldMute
        ? 0
        : Math.max(0, Math.min(1, (activeClip?.volume ?? 1) * volume));
    }
  }, [isVideoAudioMuted, v1Track?.muted, isMuted, activeClip?.volume, volume]);

  useEffect(() => {
    if (overlayVideoRef.current) {
      overlayVideoRef.current.muted = true;
      overlayVideoRef.current.volume = 0;
    }
  }, [overlayMedia]);

  // Helper: compute where in the source video file the playhead should be.
  // Real editor trim behavior: in-point = trimStart, out-point = media duration - trimEnd.
  const getVideoTargetSec = useCallback((clip: typeof activeClip, tlTime: number) => {
    if (!clip) return Math.max(0, tlTime);

    const media = mediaItems.find((item) => item.id === clip.mediaId);
    const mediaDuration = Math.max(0.1, media?.duration || clip.duration || 1);
    const trimStart = Math.max(0, clip.trimStart || 0);
    const trimEnd = Math.max(0, clip.trimEnd || 0);
    const sourceStart = Math.min(trimStart, mediaDuration);
    const sourceEnd = Math.max(sourceStart, mediaDuration - trimEnd);
    const elapsed = Math.max(0, Math.min(clip.duration, tlTime - clip.startTime));
    const sourceTime = sourceStart + elapsed * (clip.speed || 1);

    return Math.max(sourceStart, Math.min(sourceTime, Math.max(sourceStart, sourceEnd - 0.001)));
  }, [mediaItems]);

  // Ref to track the pending play() promise so we can safely pause after it resolves
  const playPromiseRef = useRef<Promise<void> | null>(null);
  // Ref to track current clip id so we can detect clip transitions inside event handlers
  const activeClipIdRef = useRef<string | null>(null);

  // ── Effect 1: Play / Pause transitions ─────────────────────────────────────
  // Runs ONLY when isPlaying, the active clip, or media changes — NOT on every currentTime tick.
  // This is what a real media player does: call play() once and let it run natively.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeMedia || activeMedia.type !== "video") return;

    const clip = activeClip;
    activeClipIdRef.current = clip?.id ?? null;

    // Always keep playback rate synced to clip speed setting
    video.playbackRate = (clip?.speed || 1) * playbackSpeed;

    const doPlay = () => {
      if (video.readyState < 2) {
        // Not ready yet — wait for canplay then try again
        const onReady = () => {
          video.removeEventListener("canplay", onReady);
          if (activeClipIdRef.current === (clip?.id ?? null)) {
            playPromiseRef.current = video.play();
            playPromiseRef.current?.catch(() => { playPromiseRef.current = null; });
          }
        };
        video.addEventListener("canplay", onReady);
        return;
      }
      playPromiseRef.current = video.play();
      playPromiseRef.current?.catch(() => { playPromiseRef.current = null; });
    };

    if (isPlaying) {
      const targetSec = clip ? getVideoTargetSec(clip, currentTime) : Math.max(0, currentTime);

      // Keep preview aligned to the timeline while playing, without pausing at clip ends.
      if (Math.abs(video.currentTime - targetSec) > 0.15) {
        try { video.currentTime = targetSec; } catch {}
      }

      if (video.paused) {
        doPlay();
      }
    } else {
      // Pause
      const safePause = () => {
        if (!video.paused) video.pause();
      };
      if (playPromiseRef.current) {
        playPromiseRef.current.then(safePause).catch(() => {});
        playPromiseRef.current = null;
      } else {
        safePause();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeClip?.id, activeMedia?.id, playbackSpeed]);

  // ── Effect 2: Scrubbing — only when PAUSED ─────────────────────────────────
  // Runs on every currentTime change but ONLY acts when video is paused.
  // During active playback this effect is a no-op — video plays natively, untouched.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeMedia || activeMedia.type !== "video") return;
    if (isPlaying) return; // ← key guard: never interrupt live playback

    const targetSec = getVideoTargetSec(activeClip, currentTime);
    if (Math.abs(video.currentTime - targetSec) > 0.04) {
      try { video.currentTime = targetSec; } catch {}
    }
    if (!video.paused) video.pause();
  }, [currentTime, isPlaying, activeClip, activeMedia, getVideoTargetSec]);

  // Multi-Track Audio Players for A1, A2, A3
  const audioTracks = tracks.filter((t) => t.type.startsWith("A") && !t.muted);
  const activeAudioItems = audioTracks.flatMap((track) => {
    const clip = track.clips.find(
      (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
    if (!clip || (clip.volume ?? 1) <= 0.001) return [];
    const media = mediaItems.find((m) => m.id === clip.mediaId);
    if (!media) return [];
    return [{ clip, media, trackType: track.type, trackId: track.id }];
  });

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Compute CSS aspect ratio classes with guaranteed width/height layout
  const aspectClass =
    project.aspectRatio === "9:16"
      ? "h-full max-h-[82vh] aspect-[9/16] max-w-full"
      : project.aspectRatio === "1:1"
      ? "h-full max-h-[82vh] aspect-square max-w-full"
      : "w-full max-w-4xl max-h-[82vh] aspect-video";

  // Active filter string for activeClip
  const filter = activeClip?.filter;
  const filterStyle = filter
    ? {
        filter: `brightness(${filter.brightness || 1}) contrast(${filter.contrast || 1}) saturate(${
          filter.saturation || 1
        })`,
      }
    : {};

  const zoomStyle = {
    transform: `scale(${activeClip?.zoom || 1}) scaleX(${activeClip?.flipHorizontal ? -1 : 1})`,
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden select-none relative">
      {/* Video Stage Canvas */}
      <div
        ref={containerRef}
        onClick={onTogglePlay}
        className="flex-1 relative flex items-center justify-center p-2 sm:p-3 md:p-6 bg-zinc-950 overflow-hidden cursor-pointer"
      >
        {/* Frame Container */}
        <div
          className={`relative rounded-md overflow-hidden bg-black border border-zinc-800 flex items-center justify-center ${aspectClass}`}
        >
          {/* Video Audio Muted Visual Indicator Badge */}
          {isVideoAudioMuted || v1Track?.muted ? (
            <button
              onClick={onToggleVideoAudioMuted}
              className="absolute top-2 left-2 z-30 p-1 rounded-sm bg-black/50 text-zinc-300 hover:text-white hover:bg-black/70 cursor-pointer transition"
              title="Camera sound is muted (Audio Track Only). Click to toggle video audio."
              aria-label="Video sound muted"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onToggleVideoAudioMuted}
              className="absolute top-2 left-2 z-30 p-1 rounded-sm bg-black/50 text-zinc-300 hover:text-white hover:bg-black/70 cursor-pointer transition"
              title="Video camera audio is active. Click to mute video sound (Music Only)."
              aria-label="Video sound active"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Freeze Frame Canvas (Holds previous video frame during cuts so viewer NEVER sees black) */}
          <canvas
            ref={freezeCanvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${
              fitMode === "cover"
                ? "object-cover"
                : fitMode === "fill"
                ? "object-fill"
                : "object-contain"
            }`}
            style={{
              ...filterStyle,
              ...zoomStyle,
              zIndex: 10,
              // hasCapturedFrame is reactive state — correctly triggers re-render
              display: hasCapturedFrame && !isVideoReady ? "block" : "none",
            }}
          />

          {/* Main Media Render — persistent video element (no key=, no remount, no black frame) */}
          {activeMedia ? (
            activeMedia.type === "video" ? (
              <video
                ref={videoRef}
                playsInline
                preload="auto"
                muted={
                  Boolean(v1Track?.muted) ||
                  isVideoAudioMuted ||
                  isMuted ||
                  (activeClip?.volume ?? 1) <= 0.001
                }
                onLoadedMetadata={(e) => {
                  const targetSec = activeClip
                    ? getVideoTargetSec(activeClip, currentTime)
                    : Math.max(0, currentTime);
                  e.currentTarget.currentTime = targetSec;
                  setVideoLoadError(null);
                  setIsVideoReady(true);
                  captureFrameToCanvas(e.currentTarget);
                }}
                onError={(e) => {
                  if (activeMedia?.file) {
                    const freshUrl = URL.createObjectURL(activeMedia.file);
                    if (generatedBlobUrlRef.current) {
                      URL.revokeObjectURL(generatedBlobUrlRef.current);
                    }
                    generatedBlobUrlRef.current = freshUrl;
                    e.currentTarget.src = freshUrl;
                    e.currentTarget.load();
                    return;
                  }

                  if (!activeMedia?.file && !isUsableBrowserMediaUrl(activeMedia?.url)) {
                    setVideoLoadError("This project has the original file path, but the file data is not available in browser storage. Re-import the original file to restore playback.");
                    setIsVideoReady(true);
                    return;
                  }

                  const errorCode = e.currentTarget.error?.code;
                  const reason = errorCode === 4
                    ? "This browser cannot decode this video format."
                    : errorCode === 3
                    ? "The video data could not be decoded."
                    : "The video file could not be loaded.";
                  setVideoLoadError(`${reason} Re-import the original video if the file itself is damaged.`);
                  setIsVideoReady(true);
                }}
                onCanPlay={(e) => {
                  setIsVideoReady(true);
                  captureFrameToCanvas(e.currentTarget);
                }}
                onLoadedData={(e) => {
                  setIsVideoReady(true);
                  captureFrameToCanvas(e.currentTarget);
                }}
                onSeeked={(e) => {
                  setIsVideoReady(true);
                  captureFrameToCanvas(e.currentTarget);
                }}
                onSeeking={() => setIsVideoReady(false)}
                onTimeUpdate={(e) => {
                  captureFrameToCanvas(e.currentTarget);
                  if (isPlaying && activeClip) {
                    const media = mediaItems.find((item) => item.id === activeClip.mediaId);
                    const mediaDuration = Math.max(0.1, media?.duration || activeClip.duration || 1);
                    const trimStart = Math.max(0, activeClip.trimStart || 0);
                    const trimEnd = Math.max(0, activeClip.trimEnd || 0);
                    const sourceStart = Math.min(trimStart, mediaDuration);
                    const sourceEnd = Math.max(sourceStart, mediaDuration - trimEnd);
                    const videoSec = e.currentTarget.currentTime;

                    // Keep the source video within the active trim window without pausing it.
                    if (videoSec < sourceStart) {
                      e.currentTarget.currentTime = sourceStart;
                    } else if (videoSec > sourceEnd) {
                      e.currentTarget.currentTime = sourceEnd;
                    }
                  }
                }}
                style={{
                  ...filterStyle,
                  ...zoomStyle,
                }}
                className={`w-full h-full ${
                  fitMode === "cover"
                    ? "object-cover"
                    : fitMode === "fill"
                    ? "object-fill"
                    : "object-contain"
                } transition-transform`}
              />
            ) : (
              <img
                src={activeMedia.url}
                alt={activeMedia.name}
                style={{
                  ...filterStyle,
                  ...zoomStyle,
                }}
                className={`w-full h-full ${
                  fitMode === "cover"
                    ? "object-cover"
                    : fitMode === "fill"
                    ? "object-fill"
                    : "object-contain"
                }`}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 p-6 text-center">
              <span className="text-xs font-mono text-zinc-500">Timeline Ready</span>
              <span className="text-[11px] text-zinc-600 mt-1">
                Upload media or drag clips to the timeline to begin
              </span>
            </div>
          )}

          {videoLoadError && activeMedia?.type === "video" && (
            <div className="absolute inset-x-4 bottom-4 z-30 border border-rose-400/30 bg-black/90 px-4 py-3 text-sm text-rose-200" role="alert">
              {videoLoadError}
            </div>
          )}

          {/* V2 Overlay / B-Roll / Graphics */}
          {activeV2Clip && overlayMedia && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-15">
              {overlayMedia.type === "video" ? (
                <video
                  ref={overlayVideoRef}
                  src={overlayMedia.url}
                  playsInline
                  autoPlay={isPlaying}
                  muted
                  className="w-full h-full object-contain opacity-80"
                />
              ) : (
                <img
                  src={overlayMedia.url}
                  alt={overlayMedia.name}
                  className="w-full h-full object-contain opacity-80"
                />
              )}
            </div>
          )}

          {/* Dynamic Multi-Track Audio Players for A1, A2, A3 */}
          {activeAudioItems.map((item) => (
            <audio
              key={`${item.trackType}_${item.clip.id}`}
              src={item.media.url}
              playsInline
              ref={(el) => {
                if (el) {
                  const targetSec =
                    (item.clip.trimStart || 0) +
                    (currentTime - item.clip.startTime) * (item.clip.speed || 1);
                  if (Math.abs(el.currentTime - targetSec) > 0.25) {
                    el.currentTime = Math.max(0, targetSec);
                  }
                  el.volume = Math.max(
                    0,
                    Math.min(
                      1,
                      (item.clip.volume ?? 1) * volume * (item.clip.ducking ? 0.75 : 1.0)
                    )
                  );
                  el.muted = isMuted;
                  if (isPlaying && el.paused) {
                    el.play().catch(() => {});
                  } else if (!isPlaying && !el.paused) {
                    el.pause();
                  }
                }
              }}
            />
          ))}

          {/* Vignette Shadow Overlay */}
          {filter?.vignette && filter.vignette > 0 && (
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                background: `radial-gradient(circle, rgba(0,0,0,0) 50%, rgba(0,0,0,${filter.vignette}) 100%)`,
              }}
            />
          )}

          {/* T1 Title Text Overlay */}
          {activeTextClip && activeTextClip.text && (
            <div
              className="absolute pointer-events-none z-25 max-w-[92%]"
              style={{
                top: `${activeTextClip.textStyle?.positionY ?? 50}%`,
                left: `${activeTextClip.textStyle?.positionX ?? 50}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className="px-4 py-2 backdrop-blur-sm"
                style={{
                  backgroundColor: activeTextClip.textStyle?.backgroundColor ?? "transparent",
                  color: activeTextClip.textStyle?.color || "#ffffff",
                  fontSize: `${activeTextClip.textStyle?.fontSize || 24}px`,
                  fontFamily: activeTextClip.textStyle?.fontFamily || "sans-serif",
                  fontWeight: activeTextClip.textStyle?.bold ? 800 : 500,
                  fontStyle: activeTextClip.textStyle?.italic ? "italic" : "normal",
                  textAlign: activeTextClip.textStyle?.align || "center",
                  borderRadius: `${activeTextClip.textStyle?.boxRadius ?? 8}px`,
                  WebkitTextStroke: activeTextClip.textStyle?.outlineWidth
                    ? `${activeTextClip.textStyle.outlineWidth}px ${activeTextClip.textStyle.outlineColor || "#000000"}`
                    : undefined,
                  textShadow: activeTextClip.textStyle?.shadow === false
                    ? "none"
                    : "0 2px 8px rgba(0,0,0,0.8)",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  lineHeight: 1.12,
                  ...textMotionStyle,
                }}
              >
                {activeTextClip.text}
              </div>
            </div>
          )}

          {/* C1 Subtitles & Captions Overlay */}
          {activeCaption && activeCaption.text && (
            <div className="absolute bottom-8 left-0 right-0 pointer-events-none flex items-center justify-center px-6 z-25">
              <div className="px-4 py-2 rounded-xl bg-black/85 text-white font-extrabold text-sm md:text-base tracking-wide shadow-2xl text-center border border-white/10 max-w-[85%] leading-snug">
                {activeCaption.text}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Transport & Player Control Bar */}
      <div className="h-11 bg-zinc-950 border-t border-zinc-800 px-2 sm:px-4 flex items-center justify-between z-20 shrink-0 select-none">
        {/* Left: Step frame controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => onStepFrame(-1)}
            title="Step Back 1 Frame (,)"
            className="p-1.5 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onStepFrame(1)}
            title="Step Forward 1 Frame (.)"
            className="p-1.5 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Play / Pause button & Speed */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => onSeek(0)}
            title="Jump to Start"
            className="p-1.5 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center transition min-w-[32px] min-h-[32px]"
            title="Play / Pause (Spacebar)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-zinc-950" />
            ) : (
              <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />
            )}
          </button>

          {/* Speed Indicator / Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => {
              const spd = parseFloat(e.target.value);
              setPlaybackSpeed(spd);
            }}
            className="bg-transparent text-zinc-400 text-[10px] sm:text-[11px] font-mono border-0 rounded px-1.5 py-1 focus:outline-none cursor-pointer min-h-[32px]"
            title="Playback Speed"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>
        </div>

        {/* Right: Aspect ratio + Volume + Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 px-1">
            {project.aspectRatio}
          </span>

          {/* Fit Selector (contain, cover, fill) - Desktop only */}
          <div className="hidden md:flex items-center gap-1 text-[10px] font-medium text-zinc-500">
            {(["contain", "cover", "fit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFitMode(m)}
                className={`px-1.5 py-1 capitalize border-b ${
                  fitMode === m ? "border-zinc-400 text-zinc-200" : "border-transparent hover:text-zinc-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Volume Slider - Large screen only */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 text-zinc-500 hover:text-zinc-200 transition"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="w-16 accent-white cursor-pointer h-1"
            />
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1 sm:p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
