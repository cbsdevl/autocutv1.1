import JSZip from "jszip";
import type { CaptionItem, MediaItem, ProjectSettings, TimelineTrack, YouTubePackage, CopyrightAuditReport } from "../types";
import { authFetch, getStoredToken } from "./authClient";
import {
  saveProjectToFirestore,
  listProjectsFromFirestore,
  loadProjectFromFirestore,
  deleteProjectFromFirestore,
} from "./firestoreSync";

const DATABASE_NAME = "autocut-projects";
const DATABASE_VERSION = 2; // bumped to add thumbnail index
const PROJECT_STORE = "projects";
const ARCHIVE_FORMAT = "autocut-project";
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

interface StoredMedia extends Omit<MediaItem, "url" | "blobUrl" | "file" | "proxyUrl" | "proxyStatus" | "proxyError"> {
  assetPath?: string;
  assetName?: string;
  assetType?: string;
  remoteUrl?: string;
  sourcePath?: string;
}

type StoredSnapshot = Omit<ProjectSnapshot, "mediaItems"> & { mediaItems: StoredMedia[] };

interface StoredProject {
  key: string;
  userId: number;
  updatedAt: string;
  /** Data URI of the first video thumbnail for library display. */
  thumbnail?: string;
  snapshot: StoredSnapshot;
  assets: Record<string, { blob: Blob; name: string; type: string; lastModified: number }>;
}

interface ArchiveManifest {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  snapshot: StoredSnapshot;
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
  const { url, blobUrl, file, proxyUrl, proxyStatus, proxyError, ...metadata } = item;
  const storedThumbnail = metadata.thumbnail?.startsWith("blob:") ? undefined : metadata.thumbnail;
  return {
    ...metadata,
    sourcePath: item.sourcePath,
    thumbnail: storedThumbnail,
    ...(file
      ? {
          assetPath: `assets/${encodeURIComponent(item.id)}/${encodeURIComponent(file.name)}`,
          assetName: file.name,
          assetType: file.type,
        }
      : {}),
    ...(!file && url && !url.startsWith("blob:") ? { remoteUrl: url } : {}),
  };
}

async function getMediaBlob(
  item: MediaItem,
  includeRemote = false,
): Promise<{ blob: Blob; name: string; type: string; lastModified: number } | null> {
  if (item.file) {
    return { blob: item.file, name: item.file.name, type: item.file.type, lastModified: item.file.lastModified };
  }

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
      // Blob URL revoked or stale
    }
  }

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
      return {
        ...metadata,
        sourcePath: sourcePath || descriptor.sourcePath || assetPath || remoteUrl,
        url: remoteUrl || "",
        blobUrl: undefined,
      } as MediaItem;
    }

    return { ...metadata, sourcePath: sourcePath || descriptor.sourcePath, url: remoteUrl || "", blobUrl: undefined } as MediaItem;
  });
}

function inferMimeType(fileName: string, mediaKind: MediaItem["type"]): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const knownTypes: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const known = extension ? knownTypes[extension] : undefined;
  if (known) return known;
  return mediaKind === "video" ? "video/mp4" : mediaKind === "audio" ? "audio/mpeg" : "application/octet-stream";
}

function extractProjectThumbnail(snapshot: StoredSnapshot): string | undefined {
  for (const item of snapshot.mediaItems) {
    if (item.thumbnail && item.thumbnail.startsWith("data:")) {
      return item.thumbnail;
    }
  }
  return undefined;
}

/**
 * Produces a compact cloud-safe snapshot JSON (< 650KB) by stripping large inline media thumbnails
 * if needed while preserving 100% of timeline tracks, captions, clip trims, effects, and AI data.
 */
function buildCloudSnapshotJson(snapshot: StoredSnapshot): string {
  const raw = JSON.stringify(snapshot);
  if (raw.length <= 600_000) return raw;

  const compactSnapshot: StoredSnapshot = {
    ...snapshot,
    mediaItems: snapshot.mediaItems.map((m) => ({
      ...m,
      thumbnail: m.thumbnail && m.thumbnail.length > 40_000 ? undefined : m.thumbnail,
    })),
  };
  return JSON.stringify(compactSnapshot);
}

// ─────────────────────────────────────────
// Public API (IndexedDB + Cloud PostgreSQL + Cloud Firestore Global Sync)
// ─────────────────────────────────────────

export async function saveProjectForUser(userId: number, snapshot: ProjectSnapshot): Promise<void> {
  const assets: StoredProject["assets"] = {};
  const mediaItems: StoredMedia[] = [];

  for (const item of snapshot.mediaItems) {
    mediaItems.push(withoutRuntimeMediaFields(item));
    const asset = await getMediaBlob(item);
    if (asset) assets[item.id] = asset;
  }

  const nowIso = new Date().toISOString();
  const storedSnapshot: StoredSnapshot = {
    ...snapshot,
    project: {
      ...snapshot.project,
      updatedAt: nowIso,
    },
    mediaItems,
  };

  const thumbnail = extractProjectThumbnail(storedSnapshot);
  const record: StoredProject = {
    key: `${userId}:${snapshot.project.id}`,
    userId,
    updatedAt: nowIso,
    thumbnail,
    snapshot: storedSnapshot,
    assets,
  };

  // 1. Save locally to IndexedDB (fast + keeps local binary blobs)
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

  // 2. Sync globally to Cloud PostgreSQL (/api/projects) & Cloud Firestore
  if (userId > 0) {
    const cloudJson = buildCloudSnapshotJson(storedSnapshot);
    const cloudThumbnail = thumbnail && thumbnail.length <= 220_000 ? thumbnail : undefined;

    const tasks: Promise<unknown>[] = [];

    if (getStoredToken()) {
      tasks.push(
        authFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: snapshot.project.id,
            name: snapshot.project.name,
            aspectRatio: snapshot.project.aspectRatio,
            resolution: snapshot.project.resolution,
            frameRate: snapshot.project.frameRate,
            mediaCount: mediaItems.length,
            thumbnail: cloudThumbnail,
            snapshotJson: cloudJson,
          }),
        }).catch((err) => {
          console.warn("[CloudSync] PostgreSQL /api/projects save skipped:", err);
        }),
      );
    }

    tasks.push(
      saveProjectToFirestore({
        projectId: snapshot.project.id,
        name: snapshot.project.name,
        aspectRatio: snapshot.project.aspectRatio,
        resolution: snapshot.project.resolution,
        frameRate: snapshot.project.frameRate,
        mediaCount: mediaItems.length,
        thumbnail: cloudThumbnail,
        snapshotJson: cloudJson,
      }).catch((err) => {
        console.warn("[CloudSync] Firestore project save skipped:", err);
      }),
    );

    await Promise.allSettled(tasks);
  }
}

export interface SavedProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  mediaCount: number;
  thumbnail?: string;
  syncOrigin?: "local" | "cloud" | "synced";
}

export async function listProjectsForUser(userId: number): Promise<SavedProjectSummary[]> {
  // 1. Read local IndexedDB projects
  const localRecords: StoredProject[] = await (async () => {
    try {
      const database = await openDatabase();
      const rows = await new Promise<StoredProject[]>((resolve, reject) => {
        const request = database
          .transaction(PROJECT_STORE, "readonly")
          .objectStore(PROJECT_STORE)
          .index("userId")
          .getAll(userId);
        request.onsuccess = () => resolve(request.result as StoredProject[]);
        request.onerror = () => reject(request.error || new Error("Could not list saved projects."));
      });
      database.close();
      return rows;
    } catch {
      return [];
    }
  })();

  const merged = new Map<string, SavedProjectSummary>();
  for (const rec of localRecords) {
    merged.set(rec.snapshot.project.id, {
      id: rec.snapshot.project.id,
      name: rec.snapshot.project.name,
      updatedAt: rec.updatedAt,
      mediaCount: rec.snapshot.mediaItems.length,
      thumbnail: rec.thumbnail,
      syncOrigin: "local",
    });
  }

  // 2. Fetch global Cloud PostgreSQL & Cloud Firestore projects if signed in
  if (userId > 0) {
    const [pgResult, fbResult] = await Promise.allSettled([
      getStoredToken()
        ? authFetch("/api/projects").then(async (r) => (r.ok ? ((await r.json()).projects as any[]) : []))
        : Promise.resolve([]),
      listProjectsFromFirestore(),
    ]);

    const applyRemoteList = (items: Array<{ id: string; name: string; updatedAt: string; mediaCount: number; thumbnail?: string }>) => {
      for (const item of items) {
        if (!item?.id) continue;
        const existing = merged.get(item.id);
        if (!existing) {
          merged.set(item.id, {
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt,
            mediaCount: item.mediaCount ?? 0,
            thumbnail: item.thumbnail,
            syncOrigin: "cloud",
          });
        } else {
          const existingTime = Date.parse(existing.updatedAt) || 0;
          const remoteTime = Date.parse(item.updatedAt) || 0;
          merged.set(item.id, {
            id: item.id,
            name: remoteTime >= existingTime ? item.name : existing.name,
            updatedAt: remoteTime >= existingTime ? item.updatedAt : existing.updatedAt,
            mediaCount: remoteTime >= existingTime ? (item.mediaCount ?? existing.mediaCount) : existing.mediaCount,
            thumbnail: item.thumbnail || existing.thumbnail,
            syncOrigin: "synced",
          });
        }
      }
    };

    if (pgResult.status === "fulfilled" && Array.isArray(pgResult.value)) {
      applyRemoteList(pgResult.value);
    }
    if (fbResult.status === "fulfilled" && Array.isArray(fbResult.value)) {
      applyRemoteList(fbResult.value);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProjectForUser(userId: number, projectId: string): Promise<ProjectSnapshot | null> {
  // 1. Load local IndexedDB record
  const localRecord: StoredProject | undefined = await (async () => {
    try {
      const database = await openDatabase();
      const rec = await new Promise<StoredProject | undefined>((resolve, reject) => {
        const request = database
          .transaction(PROJECT_STORE, "readonly")
          .objectStore(PROJECT_STORE)
          .get(`${userId}:${projectId}`);
        request.onsuccess = () => resolve(request.result as StoredProject | undefined);
        request.onerror = () => reject(request.error || new Error("Could not load saved project."));
      });
      database.close();
      return rec && rec.userId === userId ? rec : undefined;
    } catch {
      return undefined;
    }
  })();

  let chosenSnapshot: StoredSnapshot | null = localRecord ? localRecord.snapshot : null;
  let chosenTime = localRecord ? Date.parse(localRecord.updatedAt) || 0 : -1;

  // 2. Check Cloud PostgreSQL & Cloud Firestore for newer or cross-device snapshot
  if (userId > 0) {
    const [pgResult, fbResult] = await Promise.allSettled([
      getStoredToken()
        ? authFetch(`/api/projects/${encodeURIComponent(projectId)}`).then(async (r) =>
            r.ok ? (await r.json()).project : null,
          )
        : Promise.resolve(null),
      loadProjectFromFirestore(projectId),
    ]);

    const considerRemote = (remote: { updatedAt?: string; snapshotJson?: string } | null | undefined) => {
      if (!remote?.snapshotJson) return;
      try {
        const parsed = JSON.parse(remote.snapshotJson) as StoredSnapshot;
        const remoteTime = Date.parse(remote.updatedAt || parsed.project?.updatedAt || "") || 0;
        if (!chosenSnapshot || remoteTime > chosenTime) {
          chosenSnapshot = parsed;
          chosenTime = remoteTime;
        }
      } catch {
        // Ignore malformed JSON
      }
    };

    if (pgResult.status === "fulfilled") considerRemote(pgResult.value);
    if (fbResult.status === "fulfilled") considerRemote(fbResult.value);
  }

  if (!chosenSnapshot) return null;

  const localAssets = localRecord?.assets || {};
  return {
    ...chosenSnapshot,
    mediaItems: await materializeMedia(chosenSnapshot.mediaItems || [], localAssets),
  };
}

export async function deleteProjectForUser(userId: number, projectId: string): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PROJECT_STORE, "readwrite");
      transaction.objectStore(PROJECT_STORE).delete(`${userId}:${projectId}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not delete saved project."));
    });
    database.close();
  } catch {
    // Continue cloud deletes even if local missing
  }

  if (userId > 0) {
    await Promise.allSettled([
      getStoredToken()
        ? authFetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" })
        : Promise.resolve(),
      deleteProjectFromFirestore(projectId),
    ]);
  }
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
      descriptor.remoteUrl = item.url;
    } else {
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

  const assets: StoredProject["assets"] = {};

  for (const descriptor of manifest.snapshot.mediaItems) {
    if (!descriptor.assetPath) continue;

    const assetEntry =
      zip.file(descriptor.assetPath) ??
      zip.file(decodeURIComponent(descriptor.assetPath));

    if (!assetEntry) {
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
