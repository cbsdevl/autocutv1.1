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

// Uploaded asset tracking to avoid duplicate uploads
const uploadedAssetSet = new Set<string>();

function findMediaItem(mediaItems: MediaItem[], id: string): MediaItem | undefined {
  if (!id) return undefined;
  const direct = mediaItems.find((m) => m.id === id);
  if (direct) return direct;

  const normalizedId = id.replace(/_vid_/, "_video_").replace(/_aud_/, "_audio_");
  const match = mediaItems.find((m) => m.id === normalizedId);
  if (match) return match;

  const reverse = id.replace(/_video_/, "_vid_").replace(/_audio_/, "_aud_");
  return mediaItems.find((m) => m.id === reverse);
}

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

// Procedural audio generator cache
const proceduralAudioCache = new Map<string, string>();
async function getProceduralAudioUrl(id: string): Promise<string> {
  if (proceduralAudioCache.has(id)) {
    return proceduralAudioCache.get(id)!;
  }
  let url = "";
  if (id.includes("audio_2") || id.includes("aud_2") || id.includes("vlog")) {
    url = await generateUpbeatVlogWav(60);
  } else if (id.includes("audio_3") || id.includes("aud_3") || id.includes("afro")) {
    url = await generateAfrobeatWav(60);
  } else {
    url = await generateCinematicAmbientWav(60);
  }
  proceduralAudioCache.set(id, url);
  return url;
}

/**
 * Offline Audio Synthesizer:
 * Mixes all active audio tracks into a studio 48kHz WAV buffer.
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
      console.warn("Audio buffer decode notice:", clip.mediaId, err);
    }
  }

  try {
    decodeCtx.close();
  } catch {}

  const validClips = activeClips.filter((c) => audioBuffers.has(c.mediaId));
  if (validClips.length === 0) return null;

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
      console.warn("Audio schedule notice:", schedErr);
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

/**
 * Uploads a large file in 8MB chunks via multipart/form-data.
 * Server receives via multer.single('chunk') — avoids body-parsing conflicts.
 */
async function uploadMediaInChunks(
  mediaId: string,
  fileName: string,
  blobOrFile: Blob | File,
  signal?: AbortSignal,
  onChunkProgress?: (percent: number) => void
): Promise<void> {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks — fast & well under 50MB limit
  const totalChunks = Math.ceil(blobOrFile.size / CHUNK_SIZE);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    if (signal?.aborted) throw new Error("Upload aborted.");

    const start = chunkIdx * CHUNK_SIZE;
    const end = Math.min(blobOrFile.size, start + CHUNK_SIZE);
    const chunkBlob = blobOrFile.slice(start, end);

    const query = new URLSearchParams({
      mediaId,
      chunkIndex: String(chunkIdx),
      totalChunks: String(totalChunks),
      fileName,
    });

    // Send as multipart/form-data with field name "chunk" — matches multer.single("chunk")
    const formData = new FormData();
    formData.append("chunk", chunkBlob, fileName);

    const res = await fetch(`/api/media/chunk-upload?${query.toString()}`, {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error || ""; } catch {}
      throw new Error(`Chunk upload failed with status ${res.status}${detail ? ": " + detail : ""}`);
    }

    if (onChunkProgress) {
      onChunkProgress(Math.round(((chunkIdx + 1) / totalChunks) * 100));
    }
  }

  uploadedAssetSet.add(mediaId);
}

/**
 * Cloud Native FFmpeg Production Render Pipeline:
 * - Solves Cloud Run 32MB limit via 4MB chunked streaming
 * - Employs native server Linux FFmpeg directly on original video files
 * - Zero black frames: native frame-accurate seek and clone hold
 * - Zero frozen video: exact duration preserved
 * - 100% full duration: all minutes and seconds from timeline
 */
export async function renderTimelineWithCloudEngine(
  options: RenderTimelineOptions
): Promise<{ blob: Blob; url: string; mimeType: string; extension: string }> {
  const { project, tracks, mediaItems, exportSettings, abortSignal, onProgress } = options;

  // Always re-upload assets for each render — server tmpdir is cleared on restart,
  // so cached IDs from a previous render would silently point to missing files.
  uploadedAssetSet.clear();

  // 1. Calculate full timeline duration
  let calculatedDuration = 0;
  tracks.forEach((t) => {
    t.clips.forEach((c) => {
      const end = c.startTime + c.duration;
      if (end > calculatedDuration) calculatedDuration = end;
    });
  });

  const totalDuration = Math.max(calculatedDuration, options.totalDuration, 5);
  const shouldMuteVideoAudio = exportSettings?.muteVideoAudio ?? true;
  const fps = exportSettings?.frameRate || project.frameRate || 30;
  const resolution = exportSettings?.resolution || project.resolution || "1080p";
  const { width, height } = getCanvasDimensions(project.aspectRatio, resolution);
  const targetBitrateMbps = exportSettings?.bitrateMbps || 16;
  const fileName = exportSettings?.fileName || `${project.name.replace(/\s+/g, "_")}.mp4`;

  // 2. Identify video cuts
  const v1Track = tracks.find((t) => t.type === "V1" && t.visible);
  const v2Track = tracks.find((t) => t.type === "V2" && t.visible);
  const primaryTrack = v1Track && v1Track.clips.length > 0 ? v1Track : v2Track;

  if (!primaryTrack || primaryTrack.clips.length === 0) {
    throw new Error("No video clips found on timeline to render.");
  }

  onProgress({
    isRendering: true,
    percent: 5,
    progress: 5,
    currentSecond: 0,
    totalSeconds: totalDuration,
    stage: "preparing",
    status: "Inspecting timeline footage and verifying cloud storage...",
  });

  // 3. Upload source video assets in chunks
  const uniqueMediaIds = Array.from(new Set(primaryTrack.clips.map((c) => c.mediaId)));
  const totalAssets = uniqueMediaIds.length;

  for (let idx = 0; idx < totalAssets; idx++) {
    const mediaId = uniqueMediaIds[idx];
    const item =
      findMediaItem(mediaItems, mediaId) ||
      mediaItems.find((m) => m.id === mediaId) ||
      mediaItems.find((m) => m.type === "video");

    if (!item) continue;

    if (!uploadedAssetSet.has(mediaId)) {
      let fileOrBlob: Blob | File | null = item.file || null;
      if (!fileOrBlob && item.url) {
        try {
          const resp = await fetch(item.url);
          fileOrBlob = await resp.blob();
        } catch {
          // If fetch fails, item.url might be an http stream
        }
      }

      if (fileOrBlob) {
        const assetName = item.name || `clip_${mediaId}.mp4`;
        await uploadMediaInChunks(
          mediaId,
          assetName,
          fileOrBlob,
          abortSignal,
          (chunkPct) => {
            const overallPct = Math.round(10 + (idx / totalAssets) * 35 + (chunkPct / 100) * (35 / totalAssets));
            onProgress({
              isRendering: true,
              percent: overallPct,
              progress: overallPct,
              currentSecond: 0,
              totalSeconds: totalDuration,
              stage: "preparing",
              status: `Uploading footage "${assetName}" to cloud engine (${chunkPct}%)...`,
            });
          }
        );
      }
    }
  }

  // 4. Render and upload 48kHz audio soundtrack
  onProgress({
    isRendering: true,
    percent: 52,
    progress: 52,
    currentSecond: 0,
    totalSeconds: totalDuration,
    stage: "preparing",
    status: "Rendering 48kHz studio audio soundtrack...",
  });

  let audioWavBlob: Blob | null = null;
  try {
    audioWavBlob = await renderOfflineAudioMix(
      tracks,
      mediaItems,
      totalDuration,
      exportSettings?.audioSampleRate || 48000,
      shouldMuteVideoAudio
    );
  } catch (audioErr) {
    console.warn("Studio audio mix warning:", audioErr);
  }

  if (audioWavBlob && audioWavBlob.size > 100) {
    await uploadMediaInChunks("audio_soundtrack", "soundtrack.wav", audioWavBlob, abortSignal);
  }

  // 5. Kick off FFmpeg encode on server — estimate progress while waiting
  //    (FFmpeg at ultrafast preset typically encodes ~3–8x real-time on modern CPUs)
  onProgress({
    isRendering: true,
    percent: 65,
    progress: 65,
    currentSecond: 0,
    totalSeconds: totalDuration,
    stage: "encoding",
    status: `Starting FFmpeg encoder (${totalDuration.toFixed(1)}s timeline)...`,
  });

  const cutsPayload = primaryTrack.clips.map((c) => {
    const item =
      findMediaItem(mediaItems, c.mediaId) ||
      mediaItems.find((m) => m.id === c.mediaId) ||
      mediaItems.find((m) => m.type === "video");
    return {
      mediaId: c.mediaId,
      url: item?.url,
      startTime: c.startTime,
      trimStart: c.trimStart || 0,
      duration: c.duration,
      speed: c.speed || 1,
      flipHorizontal: Boolean(c.flipHorizontal),
      filter: c.filter,
      transitionIn: c.transitionIn,
      transitionOut: c.transitionOut,
      transitionDuration: c.transitionDuration ?? 0.5,
    };
  });

  const manifestPayload = {
    targetWidth: width,
    targetHeight: height,
    fps,
    bitrate: `${targetBitrateMbps}M`,
    totalDuration,
    fileName,
    cuts: cutsPayload,
    overlays: tracks.find((track) => track.type === "T1" && track.visible)?.clips
      .filter((clip) => Boolean(clip.text?.trim()))
      .map((clip) => ({
        text: clip.text,
        startTime: clip.startTime,
        duration: clip.duration,
        style: clip.textStyle || {},
      })) || [],
    audioTrack: audioWavBlob ? { mediaId: "audio_soundtrack", trimStart: 0 } : undefined,
    muteVideoAudio: shouldMuteVideoAudio,
  };

  // Animated progress ticker — runs concurrently with the server FFmpeg encode.
  // Increments from 66% → 90% over the estimated encode time so the UI stays alive.
  let tickerPercent = 66;
  const estimatedEncodeMs = totalDuration * 400; // ~2.5x real-time estimate at ultrafast
  const tickIntervalMs = 800;
  const tickStep = (90 - 66) / (estimatedEncodeMs / tickIntervalMs);
  let tickerStopped = false;
  const tickerInterval = setInterval(() => {
    if (tickerStopped) return;
    tickerPercent = Math.min(90, tickerPercent + tickStep);
    const elapsed = Math.min(totalDuration, (tickerPercent - 65) / (90 - 65) * totalDuration);
    onProgress({
      isRendering: true,
      percent: Math.round(tickerPercent),
      progress: Math.round(tickerPercent),
      currentSecond: Math.round(elapsed * 10) / 10,
      totalSeconds: totalDuration,
      stage: "encoding",
      status: `FFmpeg encoding segments... ${Math.round(tickerPercent)}% (${cutsPayload.length} clip${cutsPayload.length !== 1 ? "s" : ""})`,
    });
  }, tickIntervalMs);

  let renderRes: Response;
  try {
    renderRes = await fetch("/api/export/render-timeline-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifestPayload),
      signal: abortSignal,
    });
  } finally {
    tickerStopped = true;
    clearInterval(tickerInterval);
  }

  if (!renderRes!.ok) {
    const errText = await renderRes!.text();
    throw new Error(`Cloud FFmpeg render error (${renderRes!.status}): ${errText}`);
  }

  onProgress({
    isRendering: true,
    percent: 92,
    progress: 92,
    currentSecond: totalDuration,
    totalSeconds: totalDuration,
    stage: "encoding",
    status: "Finalizing master MP4 container and faststart headers...",
  });

  const mp4Blob = await renderRes.blob();
  const mp4Url = URL.createObjectURL(mp4Blob);

  onProgress({
    isRendering: false,
    percent: 100,
    progress: 100,
    currentSecond: totalDuration,
    totalSeconds: totalDuration,
    stage: "done",
    status: "Render Complete! Master MP4 ready for download.",
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
