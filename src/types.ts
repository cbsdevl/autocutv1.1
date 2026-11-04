// ─────────────────────────────────────────────────────────────
// Auth & Subscription Types
// ─────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type PlanSlug = "free" | "weekly" | "monthly";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface PricingPlan {
  id: number;
  name: string;
  slug: PlanSlug;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  is_active: boolean;
  description: string;
}

export interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  started_at: string;
  expires_at: string | null;
  ai_videos_used: number;
  is_active: boolean;
}

export interface AuthUser extends User {
  plan_slug: PlanSlug;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_video_limit: number;
  ai_videos_used: number;
  expires_at: string | null;
}

// ─────────────────────────────────────────────────────────────

export type AspectRatio = "16:9" | "9:16" | "1:1" | "custom";
export type Resolution = "1080p" | "1440p" | "4K";
export type FrameRate = 24 | 25 | 30 | 50 | 60;
export type VideoFit = "contain" | "cover" | "fill" | "fit";

export type LicenseType =
  | "own"
  | "permission"
  | "licensed"
  | "public_domain"
  | "creative_commons"
  | "platform_licensed"
  | "unknown";

export type CopyrightStatus =
  | "Cleared"
  | "Needs Verification"
  | "Potential Claim Risk"
  | "High Risk";

export type RiskLevel = "Low" | "Medium" | "High" | "Cleared";

export interface MediaItem {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  url: string; // Object URL or static URL
  blobUrl?: string;
  file?: File;
  sourcePath?: string; // Original storage/file path when one was provided by the app or DB
  duration: number; // in seconds
  width: number;
  height: number;
  format: string; // mp4, mov, webm, mp3, etc.
  size: number; // in bytes
  thumbnail?: string;
  waveform?: number[];
  dateAdded: string;

  // Copyright and Licensing fields
  licenseType: LicenseType;
  source: string; // "Local upload", "Royalty-free Library", etc.
  licenseUrl?: string;
  creator?: string;
  licenseNotes?: string;
  copyrightStatus: CopyrightStatus;
  riskLevel: RiskLevel;
}

export type TrackType = "V1" | "V2" | "A1" | "A2" | "A3" | "T1" | "C1";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  positionY: number; // %
  positionX: number; // %
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  outlineColor?: string;
  outlineWidth?: number;
  shadow?: boolean;
  boxRadius?: number;
  animation?: "none" | "fade" | "rise" | "pop" | "slide" | "reveal";
  animationDuration?: number;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  trackType: TrackType;
  trackId: string;
  startTime: number; // Start time on the timeline (seconds)
  duration: number; // Duration on the timeline (seconds)
  trimStart: number; // Offset inside media (seconds)
  trimEnd: number; // Offset from end of media (seconds)
  speed: number; // 0.5x, 1x, 2x
  volume: number; // 0.0 to 1.0 (or 1.5)
  label?: string;
  ducking?: boolean; // automatically lower volume under speech
  reframe?: "center" | "fit" | "face_focus";
  zoom?: number; // 1.0 to 2.0
  flipHorizontal?: boolean; // Mirroring to evade perceptual hash
  transitionIn?: "None" | "Crossfade" | "Dip to Black" | "Zoom In" | "Slide" | "Wipe" | "Glitch";
  transitionOut?: "None" | "Crossfade" | "Dip to Black" | "Zoom In" | "Slide" | "Wipe" | "Glitch";
  transitionDuration?: number; // Transition length in seconds
  filter?: {
    brightness: number; // 0.5 to 1.5, default 1
    contrast: number; // 0.5 to 1.5, default 1
    saturation: number; // 0.0 to 2.0, default 1
    temperature: number; // -50 to 50, default 0
    vignette: number; // 0 to 1, default 0
    sharpen?: number; // 0 to 1, default 0
    lut?: string;
  };
  text?: string; // For T1 text clips
  textStyle?: TextStyle;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  label: string;
  color: string;
  muted: boolean;
  locked: boolean;
  visible: boolean;
  clips: TimelineClip[];
}

export interface CaptionItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  highlightWords?: string[];
}

export interface ProjectSettings {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  frameRate: FrameRate;
  targetWidth?: number;
  targetHeight?: number;
  stylePreset?: string;
  createdAt?: string;
  updatedAt?: string;
  autoSave?: boolean;
  duration?: number;
}

export interface EditingPreset {
  id: string;
  name: string;
  description: string;
  tempo: "Slow & Poetic" | "Steady & Narrative" | "Fast & Punchy" | "Rhythmic & Beat-synced";
  preferredTransitions: string[];
  captionStyle: string;
  zoomBehavior: string;
  colorMood: string;
  defaultLut: string;
  recommendedAspect: AspectRatio;
  musicMood?: string;
  pacing?: string;
  defaultTransition?: "None" | "Crossfade" | "Dip to Black" | "Zoom In" | "Slide" | "Wipe" | "Glitch";
}

export interface YouTubePackage {
  titles: string[];
  selectedTitle: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: { time: string; title: string }[];
  thumbnailConcepts: {
    conceptTitle: string;
    visualDescription: string;
    overlayText: string;
    recommendedColors: string;
  }[];
}

export interface QualityCheckItem {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface CopyrightAuditReport {
  overallRiskLevel: "Low" | "Medium" | "High";
  overallRisk?: "Low" | "Medium" | "High" | "Cleared";
  overallReadinessScore: number;
  disclaimer: string;
  assetReviews: {
    assetId: string;
    assetName: string;
    status: CopyrightStatus;
    riskLevel: RiskLevel;
    finding: string;
    recommendedAction: string;
  }[];
  recommendations: string[];
}

export interface RenderProgress {
  isRendering?: boolean;
  percent?: number;
  progress?: number;
  currentSecond?: number;
  totalSeconds?: number;
  stage?: "preparing" | "rendering" | "encoding" | "finalizing" | "done" | "error";
  status?: string;
  downloadUrl?: string;
  errorMessage?: string;
  fileSize?: number;
  format?: string;
}

export interface ExportSettings {
  format: "mp4" | "webm";
  presetName?: string;
  fileName?: string;
  resolution: "720p" | "1080p" | "1440p" | "4K";
  frameRate: 24 | 25 | 30 | 50 | 60;
  quality: "standard" | "high" | "maximum" | "prores";
  bitrateMbps?: number;
  durationMode?: "full" | "preview5" | "preview15";
  burnCaptions?: boolean;
  renderQuality?: "standard" | "maximum";
  audioSampleRate?: 44100 | 48000;
  audioBitrate?: "128k" | "192k" | "256k" | "320k";
  muteVideoAudio?: boolean;
}

export interface AutoEditOptions {
  preset: EditingPreset;
  targetDuration: number;
  useAudioDuration: boolean;
  selectedAudioId?: string;
  cutIntervalSec: number; // e.g. 5 seconds by default
  beatSync: boolean;
  muteOriginalVideoAudio: boolean;
  antiCopyrightShield: boolean;
  mirrorAlternateClips: boolean;
  speedVariation: boolean;
  zoomVariation: boolean;
  danceBeatAlignment: boolean;
  applyLut: boolean;
  addMusic: boolean;
  autoCaptions: boolean;
  transitionType?: "Cut" | "Crossfade" | "Dip to Black" | "Zoom In" | "Glitch" | "Slide";
  sourceTrims?: Record<string, { start: number; end: number }>;
}
