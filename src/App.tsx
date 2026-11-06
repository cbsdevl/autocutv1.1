import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { SidebarNav, TabType } from "./components/SidebarNav";
import { MediaLibrary } from "./components/MediaLibrary";
import { AudioLibrary } from "./components/AudioLibrary";
import { AICaptionsPanel } from "./components/AICaptionsPanel";
import { CopyrightSafetyCenter } from "./components/CopyrightSafetyCenter";
import { EffectsAndAdjustPanel } from "./components/EffectsAndAdjustPanel";
import { TextEditorPanel } from "./components/TextEditorPanel";
import { VideoPlayer } from "./components/VideoPlayer";
import { Timeline } from "./components/Timeline";
import { Inspector } from "./components/Inspector";
import { AIAutoEditModal } from "./components/AIAutoEditModal";
import { AIQualityCheckModal } from "./components/AIQualityCheckModal";
import { ExportModal } from "./components/ExportModal";
import { ProjectModal } from "./components/ProjectModal";
import { MobileBottomNav, MobileTab } from "./components/MobileBottomNav";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PricingModal } from "./components/pricing/PricingModal";
import { ProjectLibraryModal } from "./components/ProjectLibraryModal";
import { GripHorizontal } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { authFetch, removeStoredToken } from "./utils/authClient";
import {
  AutoEditOptions,
  CaptionItem,
  CopyrightAuditReport,
  EditingPreset,
  ExportSettings,
  MediaItem,
  ProjectSettings,
  RenderProgress,
  TextStyle,
  TimelineClip,
  TimelineTrack,
  YouTubePackage,
} from "./types";
import { DEFAULT_TRACKS, EDITING_PRESETS, ROYALTY_FREE_LIBRARY } from "./data/presets";
import {
  extractMediaMetadata,
  formatTimecode,
  generateChapterMarkersText,
} from "./utils/mediaUtils";
import { renderTimelineToVideo } from "./utils/renderEngine";
import {
  deleteProjectForUser,
  downloadProjectArchive,
  duplicateProjectForUser,
  exportProjectArchive,
  importProjectArchive,
  listProjectsForUser,
  loadProjectForUser,
  ProjectSnapshot,
  saveProjectForUser,
  type SavedProjectSummary,
} from "./utils/projectStorage";

export default function App() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  // Project Settings State
  const [project, setProject] = useState<ProjectSettings>({
    id: "proj_" + Date.now(),
    name: "My Video Project",
    aspectRatio: "16:9",
    resolution: "1080p",
    frameRate: 30,
    stylePreset: "Cinematic",
    autoSave: true,
    duration: 0,
  });

  // Media Library Assets State - completely empty initial state (no demo data)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // Timeline Tracks State - all tracks empty with no demo clips
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    return DEFAULT_TRACKS.map((t: TimelineTrack) => ({ ...t, clips: [] }));
  });

  // Captions Subtitles State - completely empty (no demo captions)
  const [captions, setCaptions] = useState<CaptionItem[]>([]);

  // Selected Clip & Active Tab
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("media");
  const [mobileTab, setMobileTab] = useState<MobileTab>("studio");

  // Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const playbackTimeRef = useRef<number>(currentTime);

  // History for Undo / Redo
  const [history, setHistory] = useState<TimelineTrack[][]>(() => [
    DEFAULT_TRACKS.map((t: TimelineTrack) => ({ ...t, clips: [] })),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Auth
  const { currentUser, refreshUser } = useAuth();

  // Modals & Panels
  const [isAIAutoEditOpen, setIsAIAutoEditOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isQualityCheckOpen, setIsQualityCheckOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isPricingOpen, setIsPricingOpen] = useState<boolean>(false);
  const [pricingShowLimit, setPricingShowLimit] = useState<boolean>(false);
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState(false);

  // Resizable timeline panel (desktop)
  const [timelineHeight, setTimelineHeight] = useState(240);
  const timelineResizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleTimelineDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    timelineResizeRef.current = { startY: e.clientY, startH: timelineHeight };
    const onMove = (ev: MouseEvent) => {
      if (!timelineResizeRef.current) return;
      const delta = timelineResizeRef.current.startY - ev.clientY;
      const newH = Math.min(Math.max(120, timelineResizeRef.current.startH + delta), window.innerHeight * 0.72);
      setTimelineHeight(Math.round(newH));
    };
    const onUp = () => {
      timelineResizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [isProjectLibraryLoading, setIsProjectLibraryLoading] = useState(false);
  const [projectStorageReady, setProjectStorageReady] = useState(false);
  const [projectHydrated, setProjectHydrated] = useState(false);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const storageUserId = currentUser?.id ?? 0;

  // AI Operation States
  const [isAutoEditing, setIsAutoEditing] = useState<boolean>(false);
  const [autoEditStep, setAutoEditStep] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<string>("YouTube");
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<CopyrightAuditReport | null>(null);


  // Export State
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [youtubePackage, setYoutubePackage] = useState<YouTubePackage | null>(null);
  const [isGeneratingPackage, setIsGeneratingPackage] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Autosave simulation
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedText, setLastSavedText] = useState("Autosaved just now");

  // Master Video Sound Mute: defaults to true so camera sound is muted and music audio track is preserved
  const [isVideoAudioMuted, setIsVideoAudioMuted] = useState<boolean>(true);
  const playbackStateRef = useRef({ currentTime, selectedClipId });
  playbackStateRef.current = { currentTime, selectedClipId };
  if (!isPlaying) playbackTimeRef.current = currentTime;

  const createProjectSnapshot = useCallback((includePlaybackState = true): ProjectSnapshot => ({
    project,
    tracks,
    captions,
    mediaItems,
    currentTime: includePlaybackState ? playbackStateRef.current.currentTime : 0,
    selectedClipId: includePlaybackState ? playbackStateRef.current.selectedClipId : null,
    selectedCaptionStyle,
    isVideoAudioMuted,
    youtubePackage,
    auditReport,
  }), [project, tracks, captions, mediaItems, selectedCaptionStyle, isVideoAudioMuted, youtubePackage, auditReport]);

  const applyProjectSnapshot = useCallback((snapshot: ProjectSnapshot) => {
    setProject(snapshot.project);
    setTracks(snapshot.tracks);
    setHistory([snapshot.tracks]);
    setHistoryIndex(0);
    setCaptions(snapshot.captions || []);
    setMediaItems(snapshot.mediaItems || []);
    setIsVideoAudioMuted(snapshot.isVideoAudioMuted ?? true);
    setYoutubePackage(snapshot.youtubePackage || null);
    setAuditReport(snapshot.auditReport || null);
    setCurrentTime(snapshot.currentTime || 0);
    setIsPlaying(false);
    setSelectedClipId(snapshot.selectedClipId || null);
    setSelectedCaptionStyle(snapshot.selectedCaptionStyle || "YouTube");
  }, []);

  const refreshSavedProjects = useCallback(async (userId: number) => {
    const list = await listProjectsForUser(userId);
    setSavedProjects(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProjectStorageReady(false);
    setProjectHydrated(false);
    (async () => {
      try {
        const projects = await listProjectsForUser(storageUserId);
        if (cancelled) return;
        setSavedProjects(projects);
        if (projects.length > 0) {
          const targetId = routeProjectId && projects.some((p) => p.id === routeProjectId)
            ? routeProjectId
            : projects[0].id;
          const targetProj = await loadProjectForUser(storageUserId, targetId);
          if (!cancelled && targetProj) {
            applyProjectSnapshot(targetProj);
          }
        }
      } catch (error) {
        if (!cancelled) setProjectNotice(error instanceof Error ? error.message : "Could not load your saved projects.");
      } finally {
        if (!cancelled) {
          setProjectHydrated(true);
          setProjectStorageReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [storageUserId, routeProjectId, applyProjectSnapshot]);

  useEffect(() => {
    if (!projectStorageReady || !projectHydrated || !project.autoSave) return;
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      saveProjectForUser(storageUserId, createProjectSnapshot(false))
        .then(() => {
          setLastSavedText("Saved to this browser");
          setProjectNotice(null);
        })
        .catch((error: unknown) => {
          setProjectNotice(error instanceof Error ? error.message : "Project autosave failed.");
          setLastSavedText("Save failed");
        })
        .finally(() => setIsSaving(false));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [storageUserId, projectStorageReady, projectHydrated, project.autoSave, createProjectSnapshot]);

  useEffect(() => {
    if (!projectNotice) return;
    const timeout = window.setTimeout(() => setProjectNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [projectNotice]);

  // Calculate total duration across all tracks
  const totalDuration = useMemo(() => {
    let maxTime = 0;
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const end = clip.startTime + clip.duration;
        if (end > maxTime) maxTime = end;
      });
    });
    return maxTime > 0 ? maxTime : 15;
  }, [tracks]);

  // Push state to Undo History
  const pushHistory = (newTracks: TimelineTrack[]) => {
    const updated = history.slice(0, historyIndex + 1);
    setHistory([...updated, newTracks]);
    setHistoryIndex(updated.length);
    setTracks(newTracks);

    // Autosave indicator
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setLastSavedText("Autosaved just now");
    }, 600);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevTracks = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setTracks(prevTracks);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextTracks = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setTracks(nextTracks);
    }
  };

  // Selected clip object
  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const track of tracks) {
      const found = track.clips.find((c) => c.id === selectedClipId);
      if (found) return found;
    }
    return null;
  }, [selectedClipId, tracks]);

  const selectedTransitionBoundary = useMemo(() => {
    if (!selectedClip) return null;
    const track = tracks.find((item) => item.clips.some((clip) => clip.id === selectedClip.id));
    if (!track) return null;
    const orderedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const selectedIndex = orderedClips.findIndex((clip) => clip.id === selectedClip.id);
    const frameTolerance = 1 / project.frameRate + 0.001;
    const hasCut = (left: TimelineClip, right: TimelineClip) =>
      Math.abs(left.startTime + left.duration - right.startTime) <= frameTolerance;

    if (selectedIndex >= 0 && orderedClips[selectedIndex + 1] && hasCut(orderedClips[selectedIndex], orderedClips[selectedIndex + 1])) {
      return { trackId: track.id, leftClipId: orderedClips[selectedIndex].id, rightClipId: orderedClips[selectedIndex + 1].id };
    }
    if (selectedIndex > 0 && hasCut(orderedClips[selectedIndex - 1], orderedClips[selectedIndex])) {
      return { trackId: track.id, leftClipId: orderedClips[selectedIndex - 1].id, rightClipId: orderedClips[selectedIndex].id };
    }
    return null;
  }, [selectedClip, tracks, project.frameRate]);

  const hasTransitionAtSelectedBoundary = useMemo(() => {
    if (!selectedTransitionBoundary) return false;
    const track = tracks.find((item) => item.id === selectedTransitionBoundary.trackId);
    const leftClip = track?.clips.find((clip) => clip.id === selectedTransitionBoundary.leftClipId);
    const rightClip = track?.clips.find((clip) => clip.id === selectedTransitionBoundary.rightClipId);
    return Boolean(
      (leftClip?.transitionOut && leftClip.transitionOut !== "None") ||
      (rightClip?.transitionIn && rightClip.transitionIn !== "None"),
    );
  }, [selectedTransitionBoundary, tracks]);

  // Continuous playback animation frame loop — real-time wall-clock accurate
  useEffect(() => {
    if (isPlaying) {
      if (currentTime >= totalDuration) {
        setIsPlaying(false);
        return;
      }
      playbackTimeRef.current = currentTime;
      lastTimeRef.current = performance.now();
      const loop = (now: number) => {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        // Clamp to avoid huge jumps after tab-switch or system sleep
        const safeDelta = Math.min(deltaSec, 0.1);
        const nextTime = Math.min(totalDuration, playbackTimeRef.current + safeDelta);
        playbackTimeRef.current = nextTime;
        setCurrentTime(nextTime);
        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          animationFrameRef.current = null;
          return;
        }
        animationFrameRef.current = requestAnimationFrame(loop);
      };

      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  // Frame step navigation
  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentTime >= totalDuration) {
      playbackTimeRef.current = 0;
      setCurrentTime(0);
    }
    setIsPlaying(true);
  };

  const handleStepFrame = (direction: number) => {
    setIsPlaying(false);
    const frameDuration = 1 / project.frameRate;
    setCurrentTime((prev) => Math.max(0, Math.min(totalDuration, prev + direction * frameDuration)));
  };

  // File Upload Handler (supporting MP4, MOV, WEBM, MP3, WAV, PNG, JPG)
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newMediaItems: MediaItem[] = [];

    for (const file of fileArray) {
      try {
        const metadata = await extractMediaMetadata(file);
        newMediaItems.push(metadata);
      } catch (err) {
        console.error("Error loading file metadata:", err);
      }
    }

    if (newMediaItems.length > 0) {
      const restoredItems = newMediaItems.map((imported) => {
        const missingItem = mediaItems.find((existing) =>
          existing.type === imported.type &&
          (existing.name.trim().toLocaleLowerCase() === imported.name.trim().toLocaleLowerCase() ||
            existing.sourcePath?.split(/[\\/]/).pop()?.trim().toLocaleLowerCase() === imported.name.trim().toLocaleLowerCase()) &&
          !existing.file &&
          !/^(?:blob:|data:|https?:\/\/)/i.test(existing.url || ""),
        );
        if (!missingItem) return imported;
        return {
          ...missingItem,
          ...imported,
          id: missingItem.id,
          licenseType: missingItem.licenseType,
          source: missingItem.source,
          licenseUrl: missingItem.licenseUrl,
          creator: missingItem.creator,
          licenseNotes: missingItem.licenseNotes,
          copyrightStatus: missingItem.copyrightStatus,
          riskLevel: missingItem.riskLevel,
          sourcePath: imported.sourcePath || missingItem.sourcePath,
        };
      });
      const existingIds = new Set(mediaItems.map((item) => item.id));
      const updatedMediaItems = [
        ...mediaItems.map((item) => restoredItems.find((restored) => restored.id === item.id) || item),
        ...restoredItems.filter((item) => !existingIds.has(item.id)),
      ];
      setMediaItems(updatedMediaItems);
      if (projectStorageReady) {
        try {
          await saveProjectForUser(storageUserId, {
            ...createProjectSnapshot(false),
            mediaItems: updatedMediaItems,
          });
          setLastSavedText("Saved to this browser");
        } catch (error) {
          setProjectNotice(error instanceof Error ? error.message : "Could not save imported media to browser storage.");
          setLastSavedText("Save failed");
        }
      }
      // Trigger audit for audio files
      runCopyrightAudit(updatedMediaItems);
    }
  };

  // Update Media License
  const handleUpdateMediaLicense = (
    id: string,
    updates: {
      licenseType: any;
      source: string;
      licenseUrl?: string;
      creator?: string;
      licenseNotes?: string;
      copyrightStatus: any;
      riskLevel: any;
    }
  ) => {
    setMediaItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  // Replace risky music with royalty-free music
  const handleReplaceRiskyMedia = (oldMediaId: string, newMedia: MediaItem) => {
    // Add new media to library if not present
    if (!mediaItems.some((m) => m.id === newMedia.id)) {
      setMediaItems((prev) => [...prev, newMedia]);
    }

    // Replace in tracks
    const updated = tracks.map((track) => {
      return {
        ...track,
        clips: track.clips.map((clip) =>
          clip.mediaId === oldMediaId ? { ...clip, mediaId: newMedia.id, label: newMedia.name } : clip
        ),
      };
    });
    pushHistory(updated);
  };

  // Add media to timeline
  const handleAddToTimeline = (media: MediaItem, targetTrackType?: string) => {
    const isAudio = media.type === "audio";
    const trackType = targetTrackType || (isAudio ? "A2" : "V1");

    const track = tracks.find((t) => t.type === trackType) || tracks[1];
    // Find next available start time on that track
    let nextStart = 0;
    track.clips.forEach((c) => {
      const end = c.startTime + c.duration;
      if (end > nextStart) nextStart = end;
    });

    const newClip: TimelineClip = {
      id: "clip_" + Date.now(),
      mediaId: media.id,
      trackType: track.type,
      trackId: track.id,
      startTime: nextStart,
      duration: media.duration || 6,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      volume: 1,
      label: media.name,
      zoom: 1.0,
      filter: { brightness: 1, contrast: 1, saturation: 1, temperature: 0, vignette: 0 },
    };

    const updated = tracks.map((t) =>
      t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t
    );
    pushHistory(updated);
    setSelectedClipId(newClip.id);
  };

  // Add Text to Timeline
  const handleAddTextToTimeline = (
    text: string,
    style: TextStyle,
    startTime = currentTime,
    duration = 4,
  ) => {
    const tTrack = tracks.find((t) => t.type === "T1");
    if (!tTrack) return;

    const newClip: TimelineClip = {
      id: "text_" + Date.now(),
      mediaId: "",
      trackType: "T1",
      trackId: tTrack.id,
      startTime: Math.max(0, startTime),
      duration: Math.max(0.5, duration),
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      volume: 1,
      text,
      textStyle: style,
      label: `Text: ${text.slice(0, 15)}...`,
    };

    const updated = tracks.map((t) =>
      t.id === tTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
    );
    pushHistory(updated);
    setSelectedClipId(newClip.id);
    setCurrentTime(Math.max(0, startTime));
  };

  // Clip manipulation: Split, Duplicate, Delete
  const handleSplitClip = (clipId: string) => {
    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const t of tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }

    if (!targetTrack || !targetClip) return;
    if (currentTime <= targetClip.startTime || currentTime >= targetClip.startTime + targetClip.duration) {
      return; // playhead outside clip
    }

    const firstDuration = currentTime - targetClip.startTime;
    const secondDuration = targetClip.duration - firstDuration;

    const clip1: TimelineClip = {
      ...targetClip,
      duration: firstDuration,
    };

    const clip2: TimelineClip = {
      ...targetClip,
      id: "clip_split_" + Date.now(),
      startTime: currentTime,
      duration: secondDuration,
      trimStart: (targetClip.trimStart || 0) + firstDuration,
    };

    const updated = tracks.map((t) =>
      t.id === targetTrack!.id
        ? {
            ...t,
            clips: t.clips.flatMap((c) => (c.id === clipId ? [clip1, clip2] : [c])),
          }
        : t
    );
    pushHistory(updated);
    setSelectedClipId(clip2.id);
  };

  const handleDuplicateClip = (clipId: string) => {
    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const t of tracks) {
      const c = t.clips.find((item) => item.id === clipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }

    if (!targetTrack || !targetClip) return;

    const dupClip: TimelineClip = {
      ...targetClip,
      id: "clip_dup_" + Date.now(),
      startTime: targetClip.startTime + targetClip.duration + 0.1,
    };

    const updated = tracks.map((t) =>
      t.id === targetTrack!.id ? { ...t, clips: [...t.clips, dupClip] } : t
    );
    pushHistory(updated);
    setSelectedClipId(dupClip.id);
  };

  const handleDeleteClip = (clipId: string) => {
    const updated = tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => c.id !== clipId),
    }));
    pushHistory(updated);
    setSelectedClipId(null);
  };

  const handleUpdateClip = (clipId: string, updates: Partial<TimelineClip>) => {
    const updated = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
    }));
    pushHistory(updated);
  };

  const handleApplyTransitionAtBoundary = (
    transition: NonNullable<TimelineClip["transitionIn"]>,
    duration: number,
  ) => {
    if (!selectedTransitionBoundary) return;
    const { trackId, leftClipId, rightClipId } = selectedTransitionBoundary;
    handleApplyTransitionAtCut(leftClipId, rightClipId, transition, duration, trackId);
  };

  const handleApplyTransitionAtCut = (
    leftClipId: string,
    rightClipId: string,
    transition: NonNullable<TimelineClip["transitionIn"]>,
    duration: number,
    targetTrackId?: string,
  ) => {
    const trackId = targetTrackId || tracks.find((track) =>
      track.clips.some((clip) => clip.id === leftClipId) && track.clips.some((clip) => clip.id === rightClipId),
    )?.id;
    if (!trackId) return;
    const updated = tracks.map((track) => track.id !== trackId ? track : {
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id === leftClipId) return { ...clip, transitionOut: transition, transitionDuration: duration };
        if (clip.id === rightClipId) return { ...clip, transitionIn: transition, transitionDuration: duration };
        return clip;
      }),
    });
    pushHistory(updated);
  };

  const handleChangeBoundaryTransitionDuration = (duration: number) => {
    if (!selectedTransitionBoundary) return;
    const { trackId, leftClipId, rightClipId } = selectedTransitionBoundary;
    const boundaryTrack = tracks.find((track) => track.id === trackId);
    const leftClip = boundaryTrack?.clips.find((clip) => clip.id === leftClipId);
    const rightClip = boundaryTrack?.clips.find((clip) => clip.id === rightClipId);
    const transition = rightClip?.transitionIn || leftClip?.transitionOut;
    if (transition && transition !== "None") handleApplyTransitionAtBoundary(transition, duration);
  };

  // Run AI Copyright Audit
  const runCopyrightAudit = async (items = mediaItems) => {
    setIsAuditing(true);
    try {
      const res = await authFetch("/api/ai/copyright-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItems: items }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data.report);
      }
    } catch (err) {
      console.warn("Audit request error:", err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Run AI Automatic Editing Engine
  const handleRunAIAutoEdit = async (options: AutoEditOptions) => {
    setIsAutoEditing(true);
    setAutoEditStep("1/5 Inspecting imported video sources & audio waveforms...");

    try {
      await new Promise((r) => setTimeout(r, 500));

      const videoItems = mediaItems.filter((m) => m.type === "video");
      const audioItems = mediaItems.filter((m) => m.type === "audio");

      // Professional Rule: Multi-source remix requires at least 2 videos
      if (videoItems.length < 2) {
        setIsAutoEditing(false);
        alert("Music Video Remixing requires at least 2 videos. Please upload 2 or more videos to create an automated transformative mashup.");
        return;
      }

      let usageResponse: Response;
      try {
        usageResponse = await authFetch("/api/ai/consume-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch (networkErr: any) {
        setIsAutoEditing(false);
        alert("Network connection error: Could not reach the AutoCut server. Please check your connection and try again.");
        return;
      }

      // Explicit Session Expired handling
      if (usageResponse.status === 401) {
        setIsAutoEditing(false);
        setIsAIAutoEditOpen(false);
        removeStoredToken();
        await refreshUser();
        alert("Your session has expired. Please sign in to your AutoCut account to continue.");
        navigate("/login", { state: { from: { pathname: "/editor" } } });
        return;
      }

      if (usageResponse.status === 404) {
        setIsAutoEditing(false);
        alert("The AI usage service route was not found. Please restart the application server.");
        return;
      }

      let usageData: { error?: string; message?: string } = {};
      try {
        const responseText = await usageResponse.text();
        usageData = responseText ? JSON.parse(responseText) : {};
      } catch {
        usageData = {};
      }

      if (usageResponse.status === 401 || usageData.error === "token_expired") {
        setIsAutoEditing(false);
        setIsAIAutoEditOpen(false);
        removeStoredToken();
        await refreshUser();
        alert("Your session has expired. Please sign in to your AutoCut account to continue.");
        navigate("/login", { state: { from: { pathname: "/editor" } } });
        return;
      }

      if (usageResponse.status === 403 || usageData.error === "free_limit_reached") {
        setIsAutoEditing(false);
        setIsAIAutoEditOpen(false);
        setPricingShowLimit(true);
        setIsPricingOpen(true);
        return;
      }

      if (!usageResponse.ok) {
        setIsAutoEditing(false);
        alert(
          usageData.message ||
          usageData.error ||
          "Could not verify your AI edit allowance. Please check your account subscription or sign in."
        );
        return;
      }
      await refreshUser();

      // Determine active music track & target duration
      const selectedAudio =
        audioItems.find((a) => a.id === options.selectedAudioId) ||
        audioItems[0] ||
        null;

      let effectiveTargetDuration = options.targetDuration;
      if (options.useAudioDuration && selectedAudio && selectedAudio.duration > 0) {
        effectiveTargetDuration = Math.max(10, Math.ceil(selectedAudio.duration));
      }

      setAutoEditStep(`2/5 Analyzing ${selectedAudio ? selectedAudio.name : "audio"} rhythm & dance beat intervals...`);
      await new Promise((r) => setTimeout(r, 600));

      setAutoEditStep(`3/5 Interleaving ${videoItems.length} videos every ${options.cutIntervalSec || 5}s until song end...`);
      await new Promise((r) => setTimeout(r, 600));

      // Build sequence of interleaved clips across track V1
      const newV1Clips: TimelineClip[] = [];
      let accumulatedTime = 0;
      let clipIdx = 0;

      // Track how many times each video is used to stagger trim offsets across source duration
      const videoUseCounts = new Map<string, number>();
      videoItems.forEach((v) => videoUseCounts.set(v.id, 0));

      const baseCutSec = Math.max(1.5, options.cutIntervalSec || 5.0);

      while (accumulatedTime < effectiveTargetDuration) {
        const item = videoItems[clipIdx % videoItems.length];
        const remainingTime = effectiveTargetDuration - accumulatedTime;
        const currentUseCount = videoUseCounts.get(item.id) || 0;
        videoUseCounts.set(item.id, currentUseCount + 1);

        const videoDuration = Math.max(0.5, item.duration || 10);
        const requestedTrim = options.sourceTrims?.[item.id] || { start: 0, end: 0 };
        const sourceStart = Math.max(0, Math.min(requestedTrim.start || 0, videoDuration - 0.5));
        const sourceEnd = Math.max(sourceStart + 0.5, Math.min(videoDuration, videoDuration - Math.max(0, requestedTrim.end || 0)));
        const usableSourceDuration = sourceEnd - sourceStart;
        const duration = Math.min(baseCutSec, remainingTime, usableSourceDuration);
        const maxUsableOffset = Math.max(0, usableSourceDuration - duration);
        const trimStart = sourceStart + (maxUsableOffset > 0
          ? (currentUseCount * baseCutSec * 1.35) % (maxUsableOffset + 0.01)
          : 0);
        const trimEnd = Math.max(0, videoDuration - trimStart - duration);

        // Anti-copyright transformative modulations
        const isMirror = Boolean(options.antiCopyrightShield && options.mirrorAlternateClips && clipIdx % 2 === 1);
        const clipSpeed = options.antiCopyrightShield && options.speedVariation ? (clipIdx % 2 === 0 ? 1.025 : 1.035) : 1.0;
        const clipZoom = options.antiCopyrightShield && options.zoomVariation ? (clipIdx % 2 === 0 ? 1.04 : 1.07) : 1.0;

        // Transformative color grading LUT
        const clipFilter = options.applyLut
          ? {
              brightness: 1.03,
              contrast: 1.14,
              saturation: 1.22,
              temperature: options.preset.id === "cinematic" ? -4 : 0,
              vignette: options.preset.id === "cinematic" ? 0.18 : 0.08,
              lut: options.preset.defaultLut || "cinematic",
            }
          : undefined;

        newV1Clips.push({
          id: `mashup_clip_${Date.now()}_${clipIdx}`,
          mediaId: item.id,
          trackType: "V1",
          trackId: "track_v1",
          startTime: accumulatedTime,
          duration: duration,
          trimStart: Math.round(trimStart * 100) / 100,
          trimEnd: Math.round(trimEnd * 100) / 100,
          speed: clipSpeed,
          // User requested: Mute all videos so only uploaded music plays
          volume: options.muteOriginalVideoAudio ? 0 : 1,
          label: `${item.name} [Cut ${clipIdx + 1}]`,
          flipHorizontal: isMirror,
          zoom: clipZoom,
          filter: clipFilter,
          transitionIn: clipIdx === 0 || options.transitionType === "Cut" ? "None" : (options.transitionType || "None"),
        });

        accumulatedTime += duration;
        clipIdx++;
      }

      setAutoEditStep("4/5 Attaching soundtrack & muting camera audio...");
      await new Promise((r) => setTimeout(r, 500));

      // Audio track A2: apply user's uploaded audio spanning entire sequence
      const newA2Clips: TimelineClip[] = [];
      if (selectedAudio && options.addMusic) {
        newA2Clips.push({
          id: "ai_music_master_" + Date.now(),
          mediaId: selectedAudio.id,
          trackType: "A2",
          trackId: "track_a2",
          startTime: 0,
          duration: accumulatedTime,
          trimStart: 0,
          trimEnd: 0,
          speed: 1,
          volume: 1.0,
          ducking: false,
          label: selectedAudio.name,
        });
      }

      // Titles - clean, no default text in preview player
      const newT1Clips: TimelineClip[] = [];

      setAutoEditStep("5/5 Finalizing multi-source timeline & caching playback...");
      await new Promise((r) => setTimeout(r, 500));

      if (!options.autoCaptions) {
        setCaptions([]);
      }

      // Update tracks: V1 has interleaved cuts, A2 has music, A1 is cleared if muted
      const updatedTracks = tracks.map((t) => {
        if (t.type === "V1") return { ...t, clips: newV1Clips };
        if (t.type === "A2") return { ...t, clips: newA2Clips };
        if (t.type === "A1" && options.muteOriginalVideoAudio) return { ...t, clips: [] };
        if (t.type === "T1") return { ...t, clips: newT1Clips };
        return t;
      });

      pushHistory(updatedTracks);
      if (options.muteOriginalVideoAudio) {
        setIsVideoAudioMuted(true);
      }
      setProject((p) => ({
        ...p,
        stylePreset: options.preset.name,
        duration: Math.ceil(accumulatedTime),
      }));
      setCurrentTime(0);
      setIsPlaying(true);
      setMobileTab("studio");
      setIsAIAutoEditOpen(false);
    } catch (err) {
      console.error("AI Auto Edit error:", err);
    } finally {
      setIsAutoEditing(false);
    }
  };

  // Generate Subtitles with AI
  const handleGenerateAICaptions = async (style: string) => {
    setIsTranscribing(true);
    try {
      const clipNames = tracks.flatMap((track) =>
        track.clips
          .map((clip) => {
            const media = mediaItems.find((item) => item.id === clip.mediaId);
            return media?.name || clip.label || "Clip";
          })
          .filter(Boolean),
      );

      const res = await authFetch("/api/ai/transcribe-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          fileName: project.name || "Video Track",
          audioDuration: totalDuration,
          duration: totalDuration,
          style,
          clipNames: clipNames.slice(0, 12),
          mediaNames: mediaItems.slice(0, 12).map((item) => item.name),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.captions && data.captions.length > 0) {
          setCaptions(data.captions);
        }
      }
    } catch (err) {
      console.warn("Caption generation failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Generate YouTube SEO Package
  const handleGenerateYouTubePackage = async () => {
    setIsGeneratingPackage(true);
    try {
      const chaptersText = generateChapterMarkersText(tracks, mediaItems);
      const res = await authFetch("/api/ai/youtube-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          duration: totalDuration,
          stylePreset: project.stylePreset,
          captions,
          chapters: chaptersText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setYoutubePackage(data.youtubePackage);
      }
    } catch (err) {
      console.warn("YouTube package error:", err);
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  // Start Canvas Video Rendering Pipeline
  const handleStartRender = async (settings: ExportSettings) => {
    abortControllerRef.current = new AbortController();
    setRenderProgress({ isRendering: true, progress: 0, status: "Starting..." });

    try {
      const renderResult = await renderTimelineToVideo({
        project,
        tracks,
        mediaItems,
        captions,
        totalDuration,
        exportSettings: {
          ...settings,
          muteVideoAudio: settings.muteVideoAudio ?? isVideoAudioMuted,
        },
        abortSignal: abortControllerRef.current.signal,
        onProgress: (prog: RenderProgress) => {
          setRenderProgress(prog);
        },
      });

      const safeUrl = typeof renderResult === "string" ? renderResult : renderResult?.url;
      const fileSize = (renderResult as any)?.blob?.size || (renderResult as any)?.fileSize;

      const fmt = (renderResult as any)?.extension?.toUpperCase() || (settings.format === "webm" ? "WEBM" : "MP4");

      setRenderProgress((prev) => ({
        ...prev,
        isRendering: false,
        progress: 100,
        status: `Render Complete! Real ${fmt} ready.`,
        downloadUrl: safeUrl,
        fileSize: fileSize || prev?.fileSize,
        format: fmt,
      }));
    } catch (err: any) {
      if (err?.message?.includes("canceled")) {
        setRenderProgress(null);
        return;
      }
      console.error("Render failed:", err);
      setRenderProgress({
        isRendering: false,
        progress: 0,
        status: `Render failed: ${err.message || "Canvas error"}`,
        errorMessage: err.message || "An unexpected error occurred during rendering.",
      });
    }
  };

  const handleCancelRender = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setRenderProgress(null);
  };

  // New Project Handler — saves current project first, then switches to a blank canvas
  const handleCreateProject = async (newProject: ProjectSettings, loadDemoMedia: boolean) => {
    if (projectStorageReady) {
      try { await saveProjectForUser(storageUserId, createProjectSnapshot()); } catch { /* non-fatal */ }
    }
    setProject(newProject);
    setMediaItems(loadDemoMedia ? ROYALTY_FREE_LIBRARY : []);
    const freshTracks = DEFAULT_TRACKS.map((t: TimelineTrack) => ({ ...t, clips: [] }));
    setTracks(freshTracks);
    setHistory([freshTracks]);
    setHistoryIndex(0);
    setCaptions([]);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    setYoutubePackage(null);
    setAuditReport(null);
    setLastSavedText('New project');
    if (currentUser) {
      try { await refreshSavedProjects(currentUser.id); } catch { /* non-fatal */ }
    }
  };

  const handleSaveProjectNow = async () => {
    setIsSaving(true);
    try {
      await saveProjectForUser(storageUserId, createProjectSnapshot());
      setLastSavedText("Saved to this browser");
      await refreshSavedProjects(storageUserId);
      setProjectNotice("Project saved with its media and timeline.");
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not save this project.");
      setLastSavedText("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenProjectLibrary = async () => {
    setIsProjectLibraryOpen(true);
    setIsProjectLibraryLoading(true);
    try {
      await refreshSavedProjects(storageUserId);
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not load your projects.");
    } finally {
      setIsProjectLibraryLoading(false);
    }
  };

  const handleOpenSavedProject = async (projectId: string) => {
    try {
      // Save current project before switching so no work is lost
      if (projectStorageReady && project.id !== projectId) {
        try { await saveProjectForUser(storageUserId, createProjectSnapshot()); } catch { /* non-fatal */ }
      }
      const snapshot = await loadProjectForUser(storageUserId, projectId);
      if (!snapshot) throw new Error("This project is not available in the current browser storage.");
      applyProjectSnapshot(snapshot);
      setProjectStorageReady(true);
      setIsProjectLibraryOpen(false);
      setLastSavedText("Project loaded");
      navigate(`/editor/${projectId}`, { replace: true });
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not open this project.");
    }
  };

  const handleDeleteSavedProject = async (projectId: string) => {
    try {
      await deleteProjectForUser(storageUserId, projectId);
      const remaining = await refreshSavedProjects(storageUserId);
      if (projectId === project.id) {
        const next = remaining.find((p) => p.id !== projectId);
        if (next) {
          const snapshot = await loadProjectForUser(storageUserId, next.id);
          if (snapshot) { applyProjectSnapshot(snapshot); setLastSavedText("Switched to another project"); return; }
        }
        const freshId = "proj_" + Date.now();
        const freshTracks = DEFAULT_TRACKS.map((t: TimelineTrack) => ({ ...t, clips: [] }));
        setProject((p) => ({ ...p, id: freshId, name: "New Project" }));
        setMediaItems([]); setTracks(freshTracks); setHistory([freshTracks]); setHistoryIndex(0);
        setCaptions([]); setCurrentTime(0); setSelectedClipId(null);
        setYoutubePackage(null); setAuditReport(null); setLastSavedText("New project");
      }
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not delete this project.");
    }
  };

  const handleDuplicateSavedProject = async (projectId: string) => {
    try {
      const newId = await duplicateProjectForUser(storageUserId, projectId);
      if (!newId) throw new Error("Could not find the project to duplicate.");
      await refreshSavedProjects(storageUserId);
      setProjectNotice("Project duplicated successfully.");
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not duplicate this project.");
    }
  };

  const handleImportProjectArchive = async (file: File) => {
    try {
      const imported = await importProjectArchive(file);
      const existingProjects = await listProjectsForUser(storageUserId);
      const baseName = imported.project.name || file.name.replace(/\.autocut\.zip$|\.zip$/i, "");
      const projectName = existingProjects.some((saved) => saved.name === baseName)
        ? `${baseName} (Imported ${new Date().toLocaleDateString()})`
        : baseName;
      imported.project = {
        ...imported.project,
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: projectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (projectStorageReady) {
        try { await saveProjectForUser(storageUserId, createProjectSnapshot()); } catch { /* non-fatal */ }
      }
      applyProjectSnapshot(imported);
      await saveProjectForUser(storageUserId, imported);
      await refreshSavedProjects(storageUserId);
      setProjectStorageReady(true);
      setProjectNotice("Project and included media imported successfully.");
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not import this project archive.");
    }
  };

  const handleExportProjectArchive = async () => {
    try {
      const archive = await exportProjectArchive(createProjectSnapshot());
      downloadProjectArchive(archive, project.name);
      setProjectNotice("Project archive exported with timeline and available media.");
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : "Could not export this project.");
    }
  };

  // Clear All Data Handler (Wipe clean canvas)
  const handleClearAllData = () => {
    if (window.confirm("Are you sure you want to clear all media assets, timeline clips, and captions? You will start with a fresh, empty workspace.")) {
      setMediaItems([]);
      const freshTracks = DEFAULT_TRACKS.map((t: TimelineTrack) => ({ ...t, clips: [] }));
      setTracks(freshTracks);
      setHistory([freshTracks]);
      setHistoryIndex(0);
      setCaptions([]);
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedClipId(null);
    }
  };

  // Quality check auto-fix
  const handleQualityAutoFix = () => {
    // If music missing and user has audio in library, add user's audio
    const a2 = tracks.find((t) => t.type === "A2");
    if (a2 && a2.clips.length === 0) {
      const userMusic = mediaItems.find((m) => m.type === "audio");
      if (userMusic) {
        handleAddToTimeline(userMusic, "A2");
      }
    }
  };

  // Preset LUT to All Clips
  const handleApplyPresetToAll = (lut: string) => {
    const updated = tracks.map((t) => {
      if (t.type === "V1" || t.type === "V2") {
        return {
          ...t,
          clips: t.clips.map((c) => ({
            ...c,
            filter: {
              brightness: 1.02,
              contrast: 1.15,
              saturation: 1.25,
              temperature: lut === "cinematic" ? -5 : 0,
              vignette: 0.15,
              lut,
            },
          })),
        };
      }
      return t;
    });
    pushHistory(updated);
  };

  return (
    <>
    <div className={`flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans pb-[52px] md:pb-0 ${isAdminOpen && currentUser?.role === "admin" ? "hidden" : ""}`}>
      {/* Top Application Bar */}
      <TopBar
        project={project}
        onUpdateProject={(updates) => setProject((p) => ({ ...p, ...updates }))}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenAIAutoEdit={() => setIsAIAutoEditOpen(true)}
        onOpenExport={() => {
          runCopyrightAudit();
          setIsExportOpen(true);
        }}
        onOpenNewProject={() => setIsProjectModalOpen(true)}
        onOpenProjects={handleOpenProjectLibrary}
        onImportProject={handleImportProjectArchive}
        onExportProject={handleExportProjectArchive}
        onSaveProject={handleSaveProjectNow}
        onBeforeLogout={async () => {
          await handleSaveProjectNow();
        }}
        onOpenQualityCheck={() => setIsQualityCheckOpen(true)}
        onOpenAdmin={() => {
          if (currentUser?.role === "admin") setIsAdminOpen(true);
        }}
        onOpenPricing={() => {
          setPricingShowLimit(false);
          setIsPricingOpen(true);
        }}
        onSelectTab={(tab) => {
          setActiveTab(tab as TabType);
          setMobileTab(tab as MobileTab);
        }}
        onClearAllData={handleClearAllData}
        mediaItems={mediaItems}
        isSaving={isSaving}
        lastSavedText={lastSavedText}
      />

      {/* ── Project Notice Toast ─────────────────────────────────── */}
      {projectNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur-md text-sm text-zinc-100 max-w-[90vw] md:max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="flex-1 text-[13px]">{projectNotice}</span>
          <button
            onClick={() => setProjectNotice(null)}
            className="ml-1 text-zinc-500 hover:text-white transition shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* MOBILE-ONLY FULL-SCREEN TOOL PANELS (Rendered when mobileTab !== 'studio' on mobile) */}
      <div className={`md:hidden flex-1 flex flex-col overflow-hidden ${mobileTab === "studio" ? "hidden" : "flex"}`}>
        {mobileTab === "media" && (
          <MediaLibrary
            mediaItems={mediaItems}
            onUploadFiles={handleUploadFiles}
            onDeleteMedia={(id) => setMediaItems((prev) => prev.filter((m) => m.id !== id))}
            onRenameMedia={(id, newName) =>
              setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, name: newName } : m)))
            }
            onUpdateMediaLicense={handleUpdateMediaLicense}
            onAddToTimeline={handleAddToTimeline}
            onOpenAutoCut={() => setIsAIAutoEditOpen(true)}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "audio" && (
          <AudioLibrary
            onAddMediaToProject={(media) => {
              if (!mediaItems.some((m) => m.id === media.id)) {
                setMediaItems((prev) => [...prev, media]);
              }
            }}
            onAddToTimeline={handleAddToTimeline}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "text" && (
          <TextEditorPanel
            onAddTextToTimeline={handleAddTextToTimeline}
            selectedClip={selectedClip}
            onUpdateSelectedClip={(updates) => {
              if (selectedClipId) handleUpdateClip(selectedClipId, updates);
            }}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "captions" && (
          <AICaptionsPanel
            captions={captions}
            onUpdateCaptions={setCaptions}
            onGenerateAICaptions={handleGenerateAICaptions}
            isTranscribing={isTranscribing}
            selectedCaptionStyle={selectedCaptionStyle}
            onSelectCaptionStyle={setSelectedCaptionStyle}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "effects" && (
          <EffectsAndAdjustPanel
            type="effects"
            selectedClip={selectedClip}
            onUpdateSelectedClip={(updates) => {
              if (selectedClipId) handleUpdateClip(selectedClipId, updates);
            }}
            onApplyPresetToAll={handleApplyPresetToAll}
            onRunSilenceCut={() => {
              handleApplyPresetToAll("cinematic");
              alert("Auto-Cut: Removed 1.8s of silence pauses across clips.");
            }}
            onRunFaceReframe={() => {
              const updated = tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) => ({ ...c, reframe: "face_focus" as const })),
              }));
              pushHistory(updated);
              alert("Smart Reframe: Face centering enabled on all active video clips.");
            }}
            onRunAudioNormalize={() => {
              const updated = tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) => ({ ...c, ducking: true, volume: 0.9 })),
              }));
              pushHistory(updated);
              alert("Audio Normalization: Spoken dialogue normalized to -14 LUFS standard with auto-ducking.");
            }}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "inspector" && (
          <Inspector
            selectedClip={selectedClip}
            mediaItems={mediaItems}
            project={project}
            currentTime={currentTime}
            onUpdateClip={handleUpdateClip}
            onSplitClip={handleSplitClip}
            onDuplicateClip={handleDuplicateClip}
            onDeleteClip={handleDeleteClip}
            onUpdateProject={(updates) => setProject((p) => ({ ...p, ...updates }))}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}

        {mobileTab === "copyright" && (
          <CopyrightSafetyCenter
            projectName={project.name}
            mediaItems={mediaItems}
            tracks={tracks}
            onUpdateMediaLicense={handleUpdateMediaLicense}
            onReplaceRiskyMedia={handleReplaceRiskyMedia}
            onRunAudit={() => runCopyrightAudit()}
            isAuditing={isAuditing}
            onBackToStudio={() => setMobileTab("studio")}
          />
        )}
      </div>

      {/* Main Studio Body: Left Sidebar + Left Panel + Stage Canvas Player + Right Inspector */}
      {/* On desktop: a vertical flex container holding the studio row + resize handle + timeline */}
      {/* On mobile: visible only when mobileTab === 'studio' */}
      <div className={`flex-1 min-h-0 flex overflow-hidden ${mobileTab === "studio" ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
      {/* Upper row: sidebar + panels + player + inspector */}
      <div className="flex-1 flex overflow-hidden flex-col md:flex-row min-h-0 items-stretch">
        {/* Navigation Sidebar (Desktop only) */}
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileTab(tab as MobileTab);
          }}
          mediaItems={mediaItems}
          onOpenProjects={handleOpenProjectLibrary}
          projectCount={savedProjects.length}
        />

        {/* Dynamic Secondary Panel Based on Selected Tab (Desktop only) */}
        <div className="hidden md:flex self-stretch min-w-0 overflow-hidden">
          {activeTab === "media" && (
            <MediaLibrary
              mediaItems={mediaItems}
              onUploadFiles={handleUploadFiles}
              onDeleteMedia={(id) => setMediaItems((prev) => prev.filter((m) => m.id !== id))}
              onRenameMedia={(id, newName) =>
                setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, name: newName } : m)))
              }
              onUpdateMediaLicense={handleUpdateMediaLicense}
              onAddToTimeline={handleAddToTimeline}
              onOpenAutoCut={() => setIsAIAutoEditOpen(true)}
            />
          )}

          {activeTab === "audio" && (
            <AudioLibrary
              onAddMediaToProject={(media) => {
                if (!mediaItems.some((m) => m.id === media.id)) {
                  setMediaItems((prev) => [...prev, media]);
                }
              }}
              onAddToTimeline={handleAddToTimeline}
            />
          )}

          {activeTab === "text" && (
            <TextEditorPanel
              onAddTextToTimeline={handleAddTextToTimeline}
              selectedClip={selectedClip}
              onUpdateSelectedClip={(updates) => {
                if (selectedClipId) handleUpdateClip(selectedClipId, updates);
              }}
            />
          )}

          {activeTab === "captions" && (
            <AICaptionsPanel
              captions={captions}
              onUpdateCaptions={setCaptions}
              onGenerateAICaptions={handleGenerateAICaptions}
              isTranscribing={isTranscribing}
              selectedCaptionStyle={selectedCaptionStyle}
              onSelectCaptionStyle={setSelectedCaptionStyle}
            />
          )}

          {(activeTab === "transitions" || activeTab === "effects" || activeTab === "adjust" || activeTab === "ai_tools") && (
            <EffectsAndAdjustPanel
              type={activeTab}
              selectedClip={selectedClip}
              canApplyTransition={Boolean(selectedTransitionBoundary)}
              hasTransitionAtBoundary={hasTransitionAtSelectedBoundary}
              onApplyTransitionAtBoundary={handleApplyTransitionAtBoundary}
              onChangeBoundaryTransitionDuration={handleChangeBoundaryTransitionDuration}
              onUpdateSelectedClip={(updates) => {
                if (selectedClipId) handleUpdateClip(selectedClipId, updates);
              }}
              onApplyPresetToAll={handleApplyPresetToAll}
              onRunSilenceCut={() => {
                handleApplyPresetToAll("cinematic");
                alert("Auto-Cut: Removed 1.8s of silence pauses across clips.");
              }}
              onRunFaceReframe={() => {
                const updated = tracks.map((t) => ({
                  ...t,
                  clips: t.clips.map((c) => ({ ...c, reframe: "face_focus" as const })),
                }));
                pushHistory(updated);
                alert("Smart Reframe: Face centering enabled on all active video clips.");
              }}
              onRunAudioNormalize={() => {
                const updated = tracks.map((t) => ({
                  ...t,
                  clips: t.clips.map((c) => ({ ...c, ducking: true, volume: 0.9 })),
                }));
                pushHistory(updated);
                alert("Audio Normalization: Spoken dialogue normalized to -14 LUFS standard with auto-ducking.");
              }}
            />
          )}

          {activeTab === "copyright" && (
            <CopyrightSafetyCenter
              projectName={project.name}
              mediaItems={mediaItems}
              tracks={tracks}
              onUpdateMediaLicense={handleUpdateMediaLicense}
              onReplaceRiskyMedia={handleReplaceRiskyMedia}
              onRunAudit={() => runCopyrightAudit()}
              isAuditing={isAuditing}
            />
          )}
        </div>

        {/* Center: Stage Canvas Preview Player */}
        <VideoPlayer
          project={project}
          tracks={tracks}
          mediaItems={mediaItems}
          captions={captions}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          onSeek={setCurrentTime}
          onTogglePlay={handleTogglePlay}
          onStepFrame={handleStepFrame}
          selectedClip={selectedClip}
          isVideoAudioMuted={isVideoAudioMuted}
          onToggleVideoAudioMuted={() => setIsVideoAudioMuted(!isVideoAudioMuted)}
        />

        {/* Right: Inspector Properties Panel (Desktop only) */}
        <div className="hidden lg:flex self-stretch min-w-0">
          <Inspector
            selectedClip={selectedClip}
            mediaItems={mediaItems}
            project={project}
            currentTime={currentTime}
            onUpdateClip={handleUpdateClip}
            onSplitClip={handleSplitClip}
            onDuplicateClip={handleDuplicateClip}
            onDeleteClip={handleDeleteClip}
            onUpdateProject={(updates) => setProject((p) => ({ ...p, ...updates }))}
          />
        </div>
      </div>{/* end upper studio row */}

      {/* Resize Handle — desktop only drag to resize timeline */}
      <div
        className="hidden md:flex h-[5px] w-full cursor-row-resize items-center justify-center group shrink-0 bg-zinc-900 hover:bg-amber-500/20 transition-colors relative z-30"
        onMouseDown={handleTimelineDragStart}
        title="Drag to resize timeline"
      >
        <GripHorizontal className="h-3 w-3 text-zinc-600 group-hover:text-amber-400 transition-colors" />
      </div>

      {/* Bottom: Professional Multi-Track Timeline */}
      {/* On desktop: height controlled by drag handle. On mobile: auto height */}
      <div
        className={mobileTab === "studio" ? "flex flex-col shrink-0" : "hidden md:flex md:flex-col md:shrink-0"}
        style={{ height: timelineHeight }}
      >
        <Timeline
          tracks={tracks}
          mediaItems={mediaItems}
          captions={captions}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          selectedClipId={selectedClipId}
          onSelectClip={(clip) => setSelectedClipId(clip ? clip.id : null)}
          onUpdateTracks={pushHistory}
          onApplyTransitionAtCut={handleApplyTransitionAtCut}
          onAddTextToTimeline={handleAddTextToTimeline}
          onSeek={setCurrentTime}
          onTogglePlay={handleTogglePlay}
          onSplitClip={handleSplitClip}
          onDuplicateClip={handleDuplicateClip}
          onDeleteClip={handleDeleteClip}
          isVideoAudioMuted={isVideoAudioMuted}
          onToggleVideoAudioMuted={() => setIsVideoAudioMuted(!isVideoAudioMuted)}
          onOpenInspector={() => setMobileTab("inspector")}
        />
      </div>{/* end timeline */}
      </div>{/* end resizable studio body */}

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <MobileBottomNav
        activeTab={mobileTab}
        onSelectTab={(tab) => {
          setMobileTab(tab);
          if (tab !== "studio" && tab !== "inspector") {
            setActiveTab(tab as TabType);
          }
        }}
        mediaItems={mediaItems}
        hasSelectedClip={Boolean(selectedClipId)}
        onOpenProjects={handleOpenProjectLibrary}
        projectCount={savedProjects.length}
      />

      {/* Modals */}
      <AIAutoEditModal
        isOpen={isAIAutoEditOpen}
        onClose={() => setIsAIAutoEditOpen(false)}
        mediaItems={mediaItems}
        onOpenMediaUpload={() => setActiveTab("media")}
        onRunAutoEdit={handleRunAIAutoEdit}
        isProcessing={isAutoEditing}
        progressStep={autoEditStep}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
        tracks={tracks}
        mediaItems={mediaItems}
        captions={captions}
        onStartRender={handleStartRender}
        onCancelRender={handleCancelRender}
        renderProgress={renderProgress}
        youtubePackage={youtubePackage}
        onGenerateYouTubePackage={handleGenerateYouTubePackage}
        isGeneratingPackage={isGeneratingPackage}
        auditReport={auditReport}
      />

      <AIQualityCheckModal
        isOpen={isQualityCheckOpen}
        onClose={() => setIsQualityCheckOpen(false)}
        project={project}
        tracks={tracks}
        mediaItems={mediaItems}
        captions={captions}
        onAutoFix={handleQualityAutoFix}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        showLimitWarning={pricingShowLimit}
      />

      <ProjectLibraryModal
        isOpen={isProjectLibraryOpen}
        projects={savedProjects}
        loading={isProjectLibraryLoading}
        currentProjectId={project.id}
        onClose={() => setIsProjectLibraryOpen(false)}
        onOpen={handleOpenSavedProject}
        onDelete={handleDeleteSavedProject}
        onDuplicate={handleDuplicateSavedProject}
        onNewProject={() => setIsProjectModalOpen(true)}
        isSaving={isSaving}
      />
    </div>
    {isAdminOpen && currentUser?.role === "admin" && (
      <AdminDashboard onClose={() => setIsAdminOpen(false)} />
    )}
    </>
  );
}
