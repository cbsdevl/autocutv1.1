import { CaptionItem, MediaItem, TimelineClip, TimelineTrack } from "../types";

// Extract metadata from a locally uploaded video, audio, or image File
export async function extractMediaMetadata(file: File): Promise<MediaItem> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isVideo = file.type.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(extension);
  const isAudio = file.type.startsWith("audio/") || ["mp3", "wav", "aac", "ogg", "m4a"].includes(extension);
  const isImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension);
  const sourcePath = (file as File & { path?: string }).path || undefined;

  const url = URL.createObjectURL(file);
  const baseItem = {
    id: "media_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    name: file.name,
    file,
    sourcePath,
    dateAdded: new Date().toISOString().split("T")[0],
    licenseType: "unknown" as const,
    source: "Local device upload",
    copyrightStatus: (isAudio ? "Needs Verification" : "Cleared") as any,
    riskLevel: (isAudio ? "Medium" : "Low") as any,
  };

  if (isVideo) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      video.onloadedmetadata = () => {
        const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;

        // Try seeking to 1s to capture thumbnail
        video.currentTime = Math.min(1.0, duration / 2);
      };

      video.onseeked = () => {
        let thumbnail = "";
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbnail = canvas.toDataURL("image/jpeg", 0.7);
          }
        } catch {
          // Cross-origin fallback or security restriction
        }

        resolve({
          ...baseItem,
          type: "video",
          url,
          blobUrl: url,
          duration: isFinite(video.duration) && video.duration > 0 ? video.duration : 10,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          format: extension || "mp4",
          size: file.size,
          thumbnail,
          waveform: generateDummyWaveform(30),
        });
      };

      video.onerror = () => {
        resolve({
          ...baseItem,
          type: "video",
          url,
          blobUrl: url,
          duration: 10,
          width: 1920,
          height: 1080,
          format: extension || "mp4",
          size: file.size,
          waveform: generateDummyWaveform(30),
        });
      };
    });
  }

  if (isAudio) {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = url;

      audio.onloadedmetadata = () => {
        resolve({
          ...baseItem,
          type: "audio",
          url,
          blobUrl: url,
          duration: isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30,
          width: 0,
          height: 0,
          format: extension || "mp3",
          size: file.size,
          waveform: generateDummyWaveform(40),
        });
      };

      audio.onerror = () => {
        resolve({
          ...baseItem,
          type: "audio",
          url,
          blobUrl: url,
          duration: 30,
          width: 0,
          height: 0,
          format: extension || "mp3",
          size: file.size,
          waveform: generateDummyWaveform(40),
        });
      };
    });
  }

  if (isImage) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({
          ...baseItem,
          type: "image",
          url,
          blobUrl: url,
          duration: 5, // Default 5 seconds for static image on timeline
          width: img.naturalWidth || 1920,
          height: img.naturalHeight || 1080,
          format: extension || "png",
          size: file.size,
          thumbnail: url,
        });
      };
      img.onerror = () => {
        resolve({
          ...baseItem,
          type: "image",
          url,
          blobUrl: url,
          duration: 5,
          width: 1920,
          height: 1080,
          format: extension || "png",
          size: file.size,
        });
      };
    });
  }

  // Fallback
  return {
    ...baseItem,
    type: "video",
    url,
    blobUrl: url,
    duration: 10,
    width: 1920,
    height: 1080,
    format: extension || "mp4",
    size: file.size,
    waveform: generateDummyWaveform(20),
  };
}

// Generate realistic simulated waveform points
export function generateDummyWaveform(count: number = 30): number[] {
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    // Generate peaks with rhythm
    const base = 0.2 + Math.sin(i * 0.4) * 0.2;
    const noise = Math.random() * 0.5;
    points.push(Math.min(1, Math.max(0.1, base + noise)));
  }
  return points;
}

// Format seconds into MM:SS or HH:MM:SS:FF
export function formatTimecode(seconds: number, showFrames: boolean = true, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hrs > 0) {
    return showFrames
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`
      : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return showFrames
    ? `${pad(mins)}:${pad(secs)}:${pad(frames)}`
    : `${pad(mins)}:${pad(secs)}`;
}

// Format file size in KB/MB
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Generate SRT Subtitles file string
export function generateSRT(captions: CaptionItem[]): string {
  const formatSrtTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  };

  return captions
    .map((cap, idx) => {
      return `${idx + 1}\n${formatSrtTime(cap.startTime)} --> ${formatSrtTime(cap.endTime)}\n${cap.text}\n`;
    })
    .join("\n");
}

// Generate complete Copyright & License Audit report text
export function generateLicenseReportText(
  projectName: string,
  mediaItems: MediaItem[],
  tracks: TimelineTrack[]
): string {
  // Collect all media IDs used in timeline
  const usedMediaIds = new Set<string>();
  tracks.forEach((t) => t.clips.forEach((c) => usedMediaIds.add(c.mediaId)));

  const activeAssets = mediaItems.filter((m) => usedMediaIds.has(m.id));

  let report = `======================================================\n`;
  report += ` AUTOCUT AI — PROJECT COPYRIGHT & LICENSE RECORD\n`;
  report += `======================================================\n\n`;
  report += `Project Name: ${projectName}\n`;
  report += `Generated Date: ${new Date().toLocaleString()}\n`;
  report += `Total Assets in Project: ${activeAssets.length}\n\n`;
  report += `CRITICAL COPYRIGHT NOTICE:\n`;
  report += `AutoCut AI helps creators track permissions and licensing records. No automated\n`;
  report += `system can promise 100% immunity from YouTube Content ID claims, audio copyright\n`;
  report += `matches, or geographic restrictions. Always verify commercial synchronization rights.\n\n`;
  report += `------------------------------------------------------\n`;
  report += ` ASSET AUDIT DETAILS\n`;
  report += `------------------------------------------------------\n\n`;

  activeAssets.forEach((asset, idx) => {
    report += `[Asset #${idx + 1}] ${asset.name}\n`;
    report += `  Type: ${asset.type.toUpperCase()} | Format: ${asset.format.toUpperCase()} | Size: ${formatBytes(asset.size)}\n`;
    report += `  Source: ${asset.source}\n`;
    report += `  License Status: ${asset.copyrightStatus.toUpperCase()} (Risk: ${asset.riskLevel.toUpperCase()})\n`;
    report += `  Declared License: ${asset.licenseType.replace(/_/g, " ").toUpperCase()}\n`;
    if (asset.creator) report += `  Creator / Rights Holder: ${asset.creator}\n`;
    if (asset.licenseUrl) report += `  License Documentation URL: ${asset.licenseUrl}\n`;
    if (asset.licenseNotes) report += `  Notes: ${asset.licenseNotes}\n`;
    report += `\n`;
  });

  report += `------------------------------------------------------\n`;
  report += ` SUGGESTED YOUTUBE DESCRIPTION ATTRIBUTION\n`;
  report += `------------------------------------------------------\n\n`;
  report += `Licensed assets used in this video:\n`;
  activeAssets.forEach((a) => {
    if (a.creator || a.licenseUrl) {
      report += `• "${a.name}" - ${a.creator || "Creator"} (${a.licenseType}) ${a.licenseUrl || ""}\n`;
    }
  });

  return report;
}

// Format time for YouTube chapters MM:SS
export function formatChapterTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function generateChapterMarkersText(tracks: TimelineTrack[], mediaItems: MediaItem[]): string {
  const v1 = tracks.find((t) => t.type === "V1");
  if (!v1 || v1.clips.length === 0) {
    return "00:00 Intro\n00:15 Main Feature\n00:30 Outro & Credits";
  }

  const sortedClips = [...v1.clips].sort((a, b) => a.startTime - b.startTime);
  const lines: string[] = [];

  // YouTube requires first chapter to start at 00:00
  lines.push(`00:00 Intro & Setup`);

  sortedClips.forEach((clip, index) => {
    if (clip.startTime > 3) {
      const media = mediaItems.find((m) => m.id === clip.mediaId);
      const title = clip.label || media?.name || `Scene ${index + 1}`;
      lines.push(`${formatChapterTime(clip.startTime)} ${title.replace(/\.[^/.]+$/, "")}`);
    }
  });

  return lines.join("\n");
}

export const generateSrt = generateSRT;

// Download helper
export function triggerDownload(content: string | Blob, filename: string, mimeType: string = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
