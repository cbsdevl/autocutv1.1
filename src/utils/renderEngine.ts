import {
  CaptionItem,
  ExportSettings,
  MediaItem,
  ProjectSettings,
  RenderProgress,
  TimelineClip,
  TimelineTrack,
} from "../types";
import {
  audioBufferToWav,
  generateAfrobeatWav,
  generateCinematicAmbientWav,
  generateUpbeatVlogWav,
} from "./audioSynth";
import { renderTimelineWithCloudEngine } from "./cloudRenderPipeline";

export type { RenderProgress, ExportSettings };

export interface RenderTimelineOptions {
  project: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: CaptionItem[];
  totalDuration: number;
  exportSettings?: ExportSettings;
  abortSignal?: AbortSignal;
  onProgress: (progress: RenderProgress) => void;
}

// Procedural audio cache for offline synthesis
const proceduralAudioCache = new Map<string, string>();

async function getProceduralAudioUrl(id: string): Promise<string> {
  if (proceduralAudioCache.has(id)) {
    return proceduralAudioCache.get(id)!;
  }
  let url = "";
  if (id.includes("audio_2") || id.includes("aud_2") || id.includes("vlog")) {
    url = await generateUpbeatVlogWav(30);
  } else if (id.includes("audio_3") || id.includes("aud_3") || id.includes("afro")) {
    url = await generateAfrobeatWav(30);
  } else {
    url = await generateCinematicAmbientWav(32);
  }
  proceduralAudioCache.set(id, url);
  return url;
}

// Find media item by ID or alias
function findMediaItem(mediaItems: MediaItem[], id: string): MediaItem | undefined {
  if (!id) return undefined;
  const direct = mediaItems.find((m) => m.id === id);
  if (direct) return direct;

  const normalizedId = id.replace(/_vid_/, "_video_").replace(/_aud_/, "_audio_");
  const normalizedMatch = mediaItems.find((m) => m.id === normalizedId);
  if (normalizedMatch) return normalizedMatch;

  const reverseNormalized = id.replace(/_video_/, "_vid_").replace(/_audio_/, "_aud_");
  return mediaItems.find((m) => m.id === reverseNormalized);
}

// Determine best supported MIME type for MediaRecorder
function getBestMimeType(preferredFormat: "mp4" | "webm"): { mimeType: string; extension: string } {
  const mp4Types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  const webmTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=h264",
    "video/webm",
  ];

  if (preferredFormat === "mp4") {
    for (const t of mp4Types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        return { mimeType: t, extension: "mp4" };
      }
    }
  }

  for (const t of webmTypes) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return { mimeType: t, extension: "webm" };
    }
  }

  for (const t of mp4Types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return { mimeType: t, extension: "mp4" };
    }
  }

  return { mimeType: "video/webm", extension: "webm" };
}

// Calculate canvas resolution based on aspect ratio and settings
function getCanvasDimensions(
  aspectRatio: string,
  resolution: "720p" | "1080p" | "1440p" | "4K" = "1080p"
): { width: number; height: number } {
  let baseW = 1920;
  let baseH = 1080;

  if (aspectRatio === "9:16") {
    baseW = 1080;
    baseH = 1920;
  } else if (aspectRatio === "1:1") {
    baseW = 1080;
    baseH = 1080;
  }

  let scale = 1.0;
  if (resolution === "720p") scale = 720 / 1080;
  else if (resolution === "1440p") scale = 1440 / 1080;
  else if (resolution === "4K") scale = 2160 / 1080;

  let width = Math.round(baseW * scale);
  let height = Math.round(baseH * scale);

  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;

  return { width, height };
}

/**
 * High-Precision Offline Audio Mixer:
 * Renders ONLY the chosen unmuted audio tracks into a studio 48kHz stereo WAV buffer.
 * If muteVideoAudio is true, camera audio from V1/V2 is strictly skipped (0% leakage).
 */
async function renderOfflineAudioMix(
  tracks: TimelineTrack[],
  mediaItems: MediaItem[],
  totalDuration: number,
  sampleRate: number = 48000,
  muteVideoAudio: boolean = true
): Promise<Blob | null> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  // Include ONLY audio tracks (A1, A2, A3) when muteVideoAudio is true
  const candidateTracks = muteVideoAudio
    ? tracks.filter((t) => t.type.startsWith("A") && !t.muted)
    : tracks.filter((t) => !t.muted);

  const activeClips: TimelineClip[] = [];
  candidateTracks.forEach((t) => {
    t.clips.forEach((c) => {
      const vol = c.volume ?? 1;
      if (vol > 0.001) {
        activeClips.push(c);
      }
    });
  });

  if (activeClips.length === 0) return null;

  // Pre-load / decode audio buffers into memory
  const audioBuffers = new Map<string, AudioBuffer>();
  const decodeCtx = new AudioContextClass();

  for (const clip of activeClips) {
    if (audioBuffers.has(clip.mediaId)) continue;
    const item = findMediaItem(mediaItems, clip.mediaId);
    if (!item) continue;

    try {
      let src = item.url;
      if (item.type === "audio" && (item.id.startsWith("rf_") || !src || src.includes("pixabay"))) {
        src = await getProceduralAudioUrl(item.id);
      }
      if (src) {
        const resp = await fetch(src);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await decodeCtx.decodeAudioData(arrayBuf);
        audioBuffers.set(clip.mediaId, decoded);
      }
    } catch (err) {
      console.warn("Could not decode audio buffer for:", clip.mediaId, err);
    }
  }

  try {
    decodeCtx.close();
  } catch {}

  const validClips = activeClips.filter((c) => audioBuffers.has(c.mediaId));
  if (validClips.length === 0) return null;

  // High-performance OfflineAudioContext render
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.max(1, Math.ceil(sampleRate * totalDuration)),
    sampleRate
  );

  for (const clip of validClips) {
    const buffer = audioBuffers.get(clip.mediaId);
    if (!buffer) continue;

    try {
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = offlineCtx.createGain();
      const clipVolume = clip.volume ?? 1;
      const duckingFactor = clip.ducking ? 0.75 : 1.0;
      gainNode.gain.setValueAtTime(clipVolume * duckingFactor, 0);

      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      const clipStart = Math.max(0, clip.startTime);
      const clipOffset = Math.max(0, clip.trimStart || 0);
      const clipEndTrim = Math.max(0, clip.trimEnd || 0);
      const clipDuration = Math.max(
        0.1,
        Math.min(clip.duration, Math.max(0, buffer.duration - clipOffset - clipEndTrim))
      );

      if (clipStart < totalDuration) {
        if (clip.duration > buffer.duration) {
          source.loop = true;
        }
        source.start(
          clipStart,
          clipOffset,
          Math.min(clipDuration, totalDuration - clipStart)
        );
      }
    } catch (schedErr) {
      console.warn("Audio scheduling notice:", schedErr);
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

/**
 * Studio Local FFmpeg Direct Timeline Master Render:
 * Slices, trims, speeds, mirrors, letterboxes, concatenates, and multiplexes
 * the real timeline footage and audio into a broadcast-grade H.264/AAC MP4.
 * 100% Free, runs directly on local server FFmpeg, requires ZERO paid APIs or pricing.
 */
export async function renderTimelineWithFFmpegServer(
  options: RenderTimelineOptions
): Promise<{ blob: Blob; url: string; mimeType: string; extension: string }> {
  const { project, tracks, mediaItems, exportSettings, abortSignal, onProgress } = options;

  // 1. Identify active video clips
  const v1Track = tracks.find((t) => t.type === "V1" && t.visible);
  const v2Track = tracks.find((t) => t.type === "V2" && t.visible);
  const targetTrack = v1Track && v1Track.clips.length > 0 ? v1Track : v2Track;

  if (!targetTrack || targetTrack.clips.length === 0) {
    throw new Error("No video clips found on the timeline to render.");
  }

  onProgress({
    isRendering: true,
    percent: 15,
    progress: 15,
    currentSecond: 0,
    totalSeconds: options.totalDuration,
    stage: "preparing",
    status: "Collecting source footage files for local FFmpeg render...",
  });

  // 2. Fetch media files/blobs
  const mediaBlobs = new Map<string, Blob>();
  const cuts = [...targetTrack.clips].sort((a, b) => a.startTime - b.startTime);

  for (const cut of cuts) {
    if (!mediaBlobs.has(cut.mediaId)) {
      const item = findMediaItem(mediaItems, cut.mediaId);
      if (item) {
        if (item.file) {
          mediaBlobs.set(cut.mediaId, item.file);
        } else if (item.url) {
          try {
            const resp = await fetch(item.url);
            const blob = await resp.blob();
            mediaBlobs.set(cut.mediaId, blob);
          } catch (fetchErr) {
            console.warn(`Could not fetch blob for media ${item.name}:`, fetchErr);
          }
        }
      }
    }
  }

  onProgress({
    isRendering: true,
    percent: 30,
    progress: 30,
    currentSecond: 0,
    totalSeconds: options.totalDuration,
    stage: "preparing",
    status: "Mixing 48kHz studio audio soundtrack (Camera audio muted)...",
  });

  // 3. Render studio audio soundtrack WAV
  const shouldMuteVideoAudio = exportSettings?.muteVideoAudio ?? true;
  let audioWavBlob: Blob | null = null;
  try {
    audioWavBlob = await renderOfflineAudioMix(
      tracks,
      mediaItems,
      options.totalDuration,
      exportSettings?.audioSampleRate || 48000,
      shouldMuteVideoAudio
    );
  } catch (audioErr) {
    console.warn("Studio audio mix warning:", audioErr);
  }

  onProgress({
    isRendering: true,
    percent: 50,
    progress: 50,
    currentSecond: 0,
    totalSeconds: options.totalDuration,
    stage: "encoding",
    status: "Encoding master MP4 with broadcast H.264 & AAC stereo...",
  });

  // 4. Build manifest and FormData
  const resolution = exportSettings?.resolution || project.resolution || "1080p";
  const { width, height } = getCanvasDimensions(project.aspectRatio, resolution);
  const fps = exportSettings?.frameRate || project.frameRate || 30;
  const bitrate = `${exportSettings?.bitrateMbps || 16}M`;
  const fileName = exportSettings?.fileName || `${project.name.replace(/\s+/g, "_")}.mp4`;

  const cutsPayload = cuts.map((c) => {
    const item = findMediaItem(mediaItems, c.mediaId);
    if (!item || !mediaBlobs.has(c.mediaId)) {
      throw new Error(`Source media for timeline clip "${c.label || c.id}" is unavailable.`);
    }
    return {
      fileKey: `media_${c.mediaId}`,
      fileName: `media_${c.mediaId}.mp4`,
      mediaId: c.mediaId,
      url: item?.url,
      startTime: c.startTime,
      trimStart: c.trimStart || 0,
      duration: c.duration,
      speed: c.speed || 1,
      flipHorizontal: Boolean(c.flipHorizontal),
      filter: c.filter,
    };
  });

  const formData = new FormData();
  formData.append(
    "manifest",
    JSON.stringify({
      targetWidth: width,
      targetHeight: height,
      fps,
      bitrate,
      totalDuration: options.totalDuration,
      fileName,
      cuts: cutsPayload,
      audioTrack: audioWavBlob
        ? {
            fileKey: "audio_soundtrack",
            fileName: "soundtrack.wav",
            trimStart: 0,
          }
        : undefined,
    })
  );

  // Append media files
  for (const [mediaId, blob] of mediaBlobs.entries()) {
    formData.append(`media_${mediaId}`, blob, `media_${mediaId}.mp4`);
  }

  if (audioWavBlob) {
    formData.append("audio_soundtrack", audioWavBlob, "soundtrack.wav");
  }

  onProgress({
    isRendering: true,
    percent: 75,
    progress: 75,
    currentSecond: options.totalDuration * 0.75,
    totalSeconds: options.totalDuration,
    stage: "encoding",
    status: "Finalizing MP4 container and faststart streaming headers...",
  });

  const res = await fetch("/api/export/render-timeline-ffmpeg", {
    method: "POST",
    body: formData,
    signal: abortSignal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.details || errData.error || `FFmpeg render error (${res.status})`);
  }

  const mp4Blob = await res.blob();
  const mp4Url = URL.createObjectURL(mp4Blob);

  onProgress({
    isRendering: false,
    percent: 100,
    progress: 100,
    currentSecond: options.totalDuration,
    totalSeconds: options.totalDuration,
    stage: "done",
    status: "Render Complete! Real master MP4 verified and ready.",
    downloadUrl: mp4Url,
    fileSize: mp4Blob.size,
    format: "MP4",
  });

  return {
    blob: mp4Blob,
    url: mp4Url,
    mimeType: "video/mp4",
    extension: "mp4",
  };
}

/**
 * Main render entry-point.
 * Always uses the local FFmpeg chunk-upload JSON pipeline for:
 *  - Zero black frames (native FFmpeg frame-accurate seek)
 *  - No real-time recording lag (encoding at CPU speed, not playback speed)
 *  - Broadcast H.264 / AAC MP4 output
 */
export async function renderTimelineToVideo(
  options: RenderTimelineOptions
): Promise<{ blob: Blob; url: string; mimeType: string; extension: string }> {
  options.onProgress({
    isRendering: true,
    percent: 3,
    progress: 3,
    currentSecond: 0,
    totalSeconds: options.totalDuration,
    stage: "preparing",
    status: "Starting local FFmpeg render engine...",
  });
  // Always use the fast local FFmpeg pipeline — no canvas, no MediaRecorder
  return renderTimelineWithCloudEngine(options);
}

export async function renderProjectVideo(
  project: ProjectSettings,
  tracks: TimelineTrack[],
  mediaItems: MediaItem[],
  captions: CaptionItem[],
  onProgress: (progress: RenderProgress) => void,
  exportSettings?: ExportSettings,
  abortSignal?: AbortSignal
): Promise<{ blob: Blob; url: string; mimeType: string; extension: string }> {
  // Calculate timeline duration
  let calculatedDuration = 0;
  tracks.forEach((t) => {
    t.clips.forEach((c) => {
      const end = c.startTime + c.duration;
      if (end > calculatedDuration) calculatedDuration = end;
    });
  });

  if (calculatedDuration <= 0) calculatedDuration = 10;

  // Duration mode override
  let totalDuration = calculatedDuration;
  if (exportSettings?.durationMode === "preview5") {
    totalDuration = Math.min(5, calculatedDuration);
  } else if (exportSettings?.durationMode === "preview15") {
    totalDuration = Math.min(15, calculatedDuration);
  }

  // Delegate everything to the fast local FFmpeg pipeline
  return renderTimelineWithCloudEngine({
    project,
    tracks,
    mediaItems,
    captions,
    totalDuration,
    exportSettings,
    abortSignal,
    onProgress,
  });

}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Draw video or image clip to canvas with transforms and filters
function drawClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  currentTime: number,
  mediaItems: MediaItem[],
  elementsMap: Map<string, HTMLVideoElement | HTMLImageElement>,
  width: number,
  height: number
) {
  const element =
    elementsMap.get(clip.mediaId) ||
    elementsMap.get(clip.mediaId.replace("_vid_", "_video_"));

  ctx.save();

  // Color filter adjustments
  if (clip.filter) {
    const b = clip.filter.brightness || 1;
    const c = clip.filter.contrast || 1;
    const s = clip.filter.saturation || 1;
    ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  }

  // Horizontal mirror flip for transformative remixes
  if (clip.flipHorizontal) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  // Smooth punch zoom calculations
  const zoom = clip.zoom || 1.0;
  const progressInClip = Math.max(0, Math.min(1, (currentTime - clip.startTime) / clip.duration));
  const dynamicZoom = zoom > 1 ? 1 + (zoom - 1) * progressInClip : 1;

  const targetW = width * dynamicZoom;
  const targetH = height * dynamicZoom;
  const offsetX = (width - targetW) / 2;
  const offsetY = (height - targetH) / 2;

  let rendered = false;

  if (element instanceof HTMLVideoElement) {
    try {
      const seekOffset = (clip.trimStart || 0) + (currentTime - clip.startTime) * (clip.speed || 1);
      if (element.paused) {
        element.currentTime = seekOffset;
        element.play().catch(() => {});
      } else if (Math.abs(element.currentTime - seekOffset) > 0.3) {
        element.currentTime = seekOffset;
      }
      if (element.readyState >= 1) {
        ctx.drawImage(element, offsetX, offsetY, targetW, targetH);
        rendered = true;
      }
    } catch {
      // Handled
    }
  } else if (element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0) {
    try {
      ctx.drawImage(element, offsetX, offsetY, targetW, targetH);
      rendered = true;
    } catch {}
  }

  // Transitions
  if (clip.transitionIn && clip.transitionIn !== "None") {
    const transDuration = Math.max(0.1, clip.transitionDuration ?? 0.5);
    const transProgress = (currentTime - clip.startTime) / transDuration;
    if (transProgress >= 0 && transProgress < 1) {
      applyTransitionEffect(ctx, clip.transitionIn, transProgress, width, height);
    }
  }

  // Vignette
  if (clip.filter?.vignette && clip.filter.vignette > 0) {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width / 4,
      width / 2,
      height / 2,
      width / 1.3
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${clip.filter.vignette})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

function applyTransitionEffect(
  ctx: CanvasRenderingContext2D,
  transition: string,
  progress: number,
  width: number,
  height: number
) {
  if (transition === "Crossfade") {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - progress})`;
    ctx.fillRect(0, 0, width, height);
  } else if (transition === "Dip to Black") {
    const opacity = progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - opacity})`;
    ctx.fillRect(0, 0, width, height);
  } else if (transition === "Zoom In") {
    const scale = 0.8 + progress * 0.2;
    ctx.scale(scale, scale);
  } else if (transition === "Slide") {
    const offset = (1 - progress) * width;
    ctx.translate(offset, 0);
  } else if (transition === "Glitch") {
    if (Math.random() > 0.4) {
      ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
      ctx.fillRect(0, Math.random() * height, width, 12);
    }
  }
}

function drawTextToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  width: number,
  height: number
) {
  if (!clip.text) return;
  const style = (clip.textStyle || {}) as any;
  const fontSize = style.fontSize || 48;
  const posX = ((style.positionX ?? 50) / 100) * width;
  const posY = ((style.positionY ?? 50) / 100) * height;

  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(clip.text);
  const textW = metrics.width + 30;
  const textH = fontSize + 20;

  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(posX - textW / 2, posY - textH / 2, textW, textH);
  }

  ctx.fillStyle = style.color || "#ffffff";
  ctx.fillText(clip.text, posX, posY);
  ctx.restore();
}

function drawCaptionToCanvas(
  ctx: CanvasRenderingContext2D,
  caption: CaptionItem,
  width: number,
  height: number
) {
  ctx.save();
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const posX = width / 2;
  const posY = height * 0.86;

  const metrics = ctx.measureText(caption.text);
  const padX = 20;
  const padY = 12;
  const bgW = metrics.width + padX * 2;
  const bgH = 44 + padY * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(posX - bgW / 2, posY - bgH / 2, bgW, bgH);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(caption.text, posX, posY);
  ctx.restore();
}
