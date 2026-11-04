import JSZip from "jszip";
import type { CaptionItem, MediaItem, ProjectSettings, TimelineTrack, YouTubePackage, CopyrightAuditReport } from "../types";

const DATABASE_NAME = "autocut-projects";
const DATABASE_VERSION = 2; // bumped to add thumbnail index
const PROJECT_STORE = "projects";
const ARCHIVE_FORMAT = "autocut-project";
// Supported archive versions — we accept any >= 1
const ARCHIVE_VERSION = 2;
const MIN_SUPPORTED_ARCHIVE_VERSION = 1;

export interface ProjectSnapshot {
  project: ProjectSettings;
  tracks: TimelineTrack[];
  captions: CaptionItem[];
  mediaItems: MediaItem[];
  currentTime: number;
  selectedClipId: string | null;
  selectedCaptionStyle: string;
  isVideoAudioMuted: boolean;
  youtubePackage: YouTubePackage | null;
  auditReport: CopyrightAuditReport | null;
}

interface StoredMedia extends Omit<MediaItem, "url" | "blobUrl" | "file"> {
  assetPath?: string;
  assetName?: string;
  assetType?: string;
  remoteUrl?: string;
  sourcePath?: string;
}

interface StoredProject {
  key: string;
  userId: number;
  updatedAt: string;
  /** Data URI of the first video thumbnail for library display. */
  thumbnail?: string;
  snapshot: Omit<ProjectSnapshot, "mediaItems"> & { mediaItems: StoredMedia[] };
  assets: Record<string, { blob: Blob; name: string; type: string; lastModified: number }>;
}

interface ArchiveManifest {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  snapshot: Omit<ProjectSnapshot, "mediaItems"> & { mediaItems: StoredMedia[] };
}

// ─────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const store = database.createObjectStore(PROJECT_STORE, { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      } else if ((event as IDBVersionChangeEvent).oldVersion < 2) {
        // Migration from v1: add updatedAt index if missing
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const store = transaction.objectStore(PROJECT_STORE);
        if (!store.indexNames.contains("updatedAt")) {
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local project storage."));
  });
}

// ─────────────────────────────────────────
// Media serialisation / deserialisation
// ─────────────────────────────────────────

function withoutRuntimeMediaFields(item: MediaItem): StoredMedia {
  const { url, blobUrl, file, ...metadata } = item;
  // Only persist thumbnail if it is a data: URI (not a blob: URL which expires)
  const storedThumbnail = metadata.thumbnail?.startsWith("blob:") ? undefined : metadata.thumbnail;
  return {
    ...metadata,
    sourcePath: item.sourcePath,
    thumbnail: storedThumbnail,
    ...(file ? {
      assetPath: `assets/${encodeURIComponent(item.id)}/${encodeURIComponent(file.name)}`,
      assetName: file.name,
      assetType: file.type,
    } : {}),
    // Persist remote URL only for non-blob remote media (e.g. royalty-free library)
    ...(!file && url && !url.startsWith("blob:") ? { remoteUrl: url } : {}),
  };
}

/**
 * Attempts to get a binary representation of the media for storage/export.
 * Priority: File reference > blob URL fetch > remote URL fetch (opt-in) > null
 */
async function getMediaBlob(
  item: MediaItem,
  includeRemote = false,
): Promise<{ blob: Blob; name: string; type: string; lastModified: number } | null> {
  // Best case — we have the original File object
  if (item.file) {
    return { blob: item.file, name: item.file.name, type: item.file.type, lastModified: item.file.lastModified };
  }

  // blobUrl may still be live if we're in the same session (e.g. freshly imported)
  const liveUrl = item.blobUrl || (item.url?.startsWith("blob:") ? item.url : null);
  if (liveUrl) {
    try {
      const response = await fetch(liveUrl);
      if (response.ok) {
        const blob = await response.blob();
        return {
          blob,
          name: item.name,
          type: blob.type || inferMimeType(item.name, item.type),
          lastModified: Date.now(),
        };
      }
    } catch {
      // Blob URL has been revoked or is stale — fall through
    }
  }

  // Remote URL (royalty-free library, etc.) — only when caller opts in
  if (includeRemote && item.url && !item.url.startsWith("blob:")) {
    try {
      const response = await fetch(item.url);
      if (response.ok) {
        return {
          blob: await response.blob(),
          name: item.name,
          type: response.headers.get("content-type") || inferMimeType(item.name, item.type),
          lastModified: Date.now(),
        };
      }
    } catch {
      // Network unreachable
    }
  }

  return null;
}

async function materializeMedia(
  descriptors: StoredMedia[],
  assets: Record<string, { blob: Blob; name: string; type: string; lastModified: number }>,
): Promise<MediaItem[]> {
  return descriptors.map((descriptor) => {
    const { assetPath, assetName, assetType, remoteUrl, sourcePath, ...metadata } = descriptor;
    const asset = assets[descriptor.id];

    if (asset) {
      const fileName = assetName || asset.name;
      const fileType = assetType || asset.type || inferMimeType(fileName, metadata.type);
      const file = new File([asset.blob], fileName, { type: fileType, lastModified: asset.lastModified });
      const url = URL.createObjectURL(file);
      return {
        ...metadata,
        sourcePath: sourcePath || descriptor.sourcePath,
        file,
        url,
        blobUrl: url,
      } as MediaItem;
    }

    if (assetPath || sourcePath || remoteUrl) {
      // Asset was expected but missing from storage — preserve the last-known path so
      // the UI can explain a missing-source condition without pretending the file is corrupted.
      console.warn(`[AutoCut] Project media missing from storage: ${descriptor.name}. Re-import this file.`);
      return {
        ...metadata,
        sourcePath: sourcePath || descriptor.sourcePath || assetPath || remoteUrl,
        url: remoteUrl || "",
        blobUrl: undefined,
      } as MediaItem;
    }

    // Remote / royalty-free media
    return { ...metadata, sourcePath: sourcePath || descriptor.sourcePath, url: remoteUrl || "", blobUrl: undefined } as MediaItem;
  });
}

function inferMimeType(fileName: string, mediaKind: MediaItem["type"]): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const knownTypes: Record<string, string> = {
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
    webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
    aac: "audio/aac", ogg: "audio/ogg",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif",
  };
  const known = extension ? knownTypes[extension] : undefined;
  if (known) return known;
  return mediaKind === "video" ? "video/mp4" : mediaKind === "audio" ? "audio/mpeg" : "application/octet-stream";
}

/** Extract first video thumbnail data URI from snapshot for library display. */
function extractProjectThumbnail(
  snapshot: Omit<ProjectSnapshot, "mediaItems"> & { mediaItems: StoredMedia[] },
): string | undefined {
  for (const item of snapshot.mediaItems) {
    if (item.thumbnail && item.thumbnail.startsWith("data:")) {
      return item.thumbnail;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

export async function saveProjectForUser(userId: number, snapshot: ProjectSnapshot): Promise<void> {
  const assets: StoredProject["assets"] = {};
  const mediaItems: StoredMedia[] = [];

  for (const item of snapshot.mediaItems) {
    mediaItems.push(withoutRuntimeMediaFields(item));
    const asset = await getMediaBlob(item);
    if (asset) assets[item.id] = asset;
  }

  const storedSnapshot = { ...snapshot, mediaItems };
  const record: StoredProject = {
    key: `${userId}:${snapshot.project.id}`,
    userId,
    updatedAt: new Date().toISOString(),
    thumbnail: extractProjectThumbnail(storedSnapshot),
    snapshot: storedSnapshot,
    assets,
  };

  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(PROJECT_STORE, "readwrite");
      transaction.objectStore(PROJECT_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save project."));
      transaction.onabort = () => reject(transaction.error || new Error("Project save was cancelled."));
    });
  } catch (error) {
    const storageError = error as DOMException;
    if (storageError?.name === "QuotaExceededError") {
      const mediaSize = Object.values(assets).reduce((total, asset) => total + asset.blob.size, 0);
      const sizeMb = (mediaSize / (1024 * 1024)).toFixed(0);
      throw new Error(
        `Browser storage is full. This project contains about ${sizeMb} MB of media. ` +
        `Export a project archive (.autocut.zip) as a portable backup, then free browser storage and try again.`,
      );
    }
    if (storageError?.name === "DataCloneError") {
      throw new Error(
        "The project contains media that this browser cannot save. Re-import the affected media files and try again.",
      );
    }
    if (storageError?.name === "SecurityError" || storageError?.name === "InvalidStateError") {
      throw new Error(
        "Browser project storage is unavailable. Check browser privacy/storage settings and try again.",
      );
    }
    throw error instanceof Error ? error : new Error("Could not save this project to browser storage.");
  } finally {
    database?.close();
  }
}

export interface SavedProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  mediaCount: number;
  thumbnail?: string;
}

export async function listProjectsForUser(userId: number): Promise<SavedProjectSummary[]> {
  const database = await openDatabase();
  const records = await new Promise<StoredProject[]>((resolve, reject) => {
    const request = database
      .transaction(PROJECT_STORE, "readonly")
      .objectStore(PROJECT_STORE)
      .index("userId")
      .getAll(userId);
    request.onsuccess = () => resolve(request.result as StoredProject[]);
    request.onerror = () => reject(request.error || new Error("Could not list saved projects."));
  });
  database.close();
  return records
    .map(({ snapshot, updatedAt, thumbnail }) => ({
      id: snapshot.project.id,
      name: snapshot.project.name,
      updatedAt,
      mediaCount: snapshot.mediaItems.length,
      thumbnail,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProjectForUser(userId: number, projectId: string): Promise<ProjectSnapshot | null> {
  const database = await openDatabase();
  const record = await new Promise<StoredProject | undefined>((resolve, reject) => {
    const request = database
      .transaction(PROJECT_STORE, "readonly")
      .objectStore(PROJECT_STORE)
      .get(`${userId}:${projectId}`);
    request.onsuccess = () => resolve(request.result as StoredProject | undefined);
    request.onerror = () => reject(request.error || new Error("Could not load saved project."));
  });
  database.close();
  if (!record || record.userId !== userId) return null;
  return {
    ...record.snapshot,
    mediaItems: await materializeMedia(record.snapshot.mediaItems, record.assets),
  };
}

export async function deleteProjectForUser(userId: number, projectId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).delete(`${userId}:${projectId}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not delete saved project."));
  });
  database.close();
}

export async function duplicateProjectForUser(
  userId: number,
  projectId: string,
  newName?: string,
): Promise<string | null> {
  const original = await loadProjectForUser(userId, projectId);
  if (!original) return null;

  const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const duplicated: ProjectSnapshot = {
    ...original,
    project: {
      ...original.project,
      id: newId,
      name: newName ?? `${original.project.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Reset playback state for the duplicate
    currentTime: 0,
    selectedClipId: null,
  };

  await saveProjectForUser(userId, duplicated);
  return newId;
}

// ─────────────────────────────────────────
// Archive export / import
// ─────────────────────────────────────────

export async function exportProjectArchive(snapshot: ProjectSnapshot): Promise<Blob> {
  const zip = new JSZip();
  const mediaItems: StoredMedia[] = [];
  const skipped: string[] = [];

  for (const item of snapshot.mediaItems) {
    const descriptor = withoutRuntimeMediaFields(item);
    // Try to get the binary — don't throw, just skip unresolvable media
    const asset = await getMediaBlob(item, true);
    if (asset) {
      descriptor.assetPath =
        descriptor.assetPath ||
        `assets/${encodeURIComponent(item.id)}/${encodeURIComponent(asset.name)}`;
      descriptor.assetName = asset.name;
      descriptor.assetType = asset.type;
      delete descriptor.remoteUrl;
      zip.file(descriptor.assetPath, asset.blob);
    } else if (item.url && !item.url.startsWith("blob:")) {
      // Remote URL we couldn't fetch — keep remoteUrl so import can attempt re-fetch
      descriptor.remoteUrl = item.url;
    } else {
      // Blob URL that has been revoked and no File reference — note it but don't block export
      skipped.push(item.name);
      descriptor.remoteUrl = undefined;
    }
    mediaItems.push(descriptor);
  }

  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    snapshot: { ...snapshot, mediaItems },
  };
  zip.file("project.json", JSON.stringify(manifest, null, 2));

  if (skipped.length > 0) {
    zip.file(
      "MISSING_MEDIA.txt",
      `The following media files could not be included in this archive because their\n` +
      `original files are no longer accessible in the browser. Re-import them to include:\n\n` +
      skipped.map((n) => `  • ${n}`).join("\n"),
    );
  }

  // Video/audio are already compressed — STORE avoids a costly re-compression pass
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export async function importProjectArchive(file: File): Promise<ProjectSnapshot> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Could not read the archive file. Make sure it is a valid .autocut.zip file.");
  }

  const manifestFile = zip.file("project.json");
  if (!manifestFile) {
    throw new Error("This archive does not contain a project.json manifest. The file may be corrupted.");
  }

  let manifest: ArchiveManifest;
  try {
    manifest = JSON.parse(await manifestFile.async("string")) as ArchiveManifest;
  } catch {
    throw new Error("The project manifest is corrupted and could not be parsed.");
  }

  if (manifest.format !== ARCHIVE_FORMAT) {
    throw new Error(
      `Unrecognised archive format "${manifest.format}". Only AutoCut project archives (.autocut.zip) are supported.`,
    );
  }

  if (manifest.version < MIN_SUPPORTED_ARCHIVE_VERSION) {
    throw new Error(
      `This project was saved with an older, incompatible version of AutoCut (archive v${manifest.version}). ` +
      `Please re-export it from the original AutoCut version.`,
    );
  }

  // Accept any version >= MIN_SUPPORTED_ARCHIVE_VERSION (forward compat)
  const assets: StoredProject["assets"] = {};

  for (const descriptor of manifest.snapshot.mediaItems) {
    if (!descriptor.assetPath) continue;

    // Try exact path first, then URL-decoded fallback (handles encoding differences between versions)
    const assetEntry =
      zip.file(descriptor.assetPath) ??
      zip.file(decodeURIComponent(descriptor.assetPath));

    if (!assetEntry) {
      // Non-fatal: media may have been remote-only; log and continue
      console.warn(`[AutoCut] Archive missing asset: ${descriptor.assetPath} (${descriptor.name})`);
      continue;
    }

    const blob = await assetEntry.async("blob");
    assets[descriptor.id] = {
      blob,
      name:
        descriptor.assetName ||
        decodeURIComponent(descriptor.assetPath.split("/").pop() || descriptor.name),
      type: descriptor.assetType || blob.type || inferMimeType(descriptor.name, descriptor.type),
      lastModified: Date.now(),
    };
  }

  return {
    ...manifest.snapshot,
    mediaItems: await materializeMedia(manifest.snapshot.mediaItems, assets),
  };
}

export function downloadProjectArchive(blob: Blob, projectName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName =
    projectName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "AutoCut Project";
  link.style.display = "none";
  link.href = url;
  link.download = `${safeName}.autocut.zip`;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 60_000);
}
