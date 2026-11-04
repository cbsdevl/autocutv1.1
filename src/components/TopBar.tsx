import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Download,
  RotateCcw,
  RotateCw,
  FolderOpen,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  Film,
  Settings,
  HelpCircle,
  Trash2,
  MoreVertical,
  ChevronDown,
  Sliders,
  Check,
  LogOut,
  Crown,
  Zap,
  User,
  Upload,
  Archive,
  LifeBuoy,
  Home,
} from "lucide-react";
import { AspectRatio, MediaItem, ProjectSettings } from "../types";
import { useAuth } from "../context/AuthContext";


interface TopBarProps {
  project: ProjectSettings;
  onUpdateProject: (updated: Partial<ProjectSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAIAutoEdit: () => void;
  onOpenExport: () => void;
  onOpenNewProject: () => void;
  onOpenQualityCheck: () => void;
  onSelectTab: (tab: string) => void;
  onClearAllData?: () => void;
  mediaItems: MediaItem[];
  isSaving: boolean;
  lastSavedText: string;
  onOpenAdmin?: () => void;
  onOpenPricing?: () => void;
  onOpenProjects?: () => void;
  onImportProject?: (file: File) => void;
  onExportProject?: () => void;
  onSaveProject?: () => void;
  onBeforeLogout?: () => Promise<void>;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  onUpdateProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenAIAutoEdit,
  onOpenExport,
  onOpenNewProject,
  onOpenQualityCheck,
  onSelectTab,
  onClearAllData,
  mediaItems,
  isSaving,
  lastSavedText,
  onOpenAdmin,
  onOpenPricing,
  onOpenProjects,
  onImportProject,
  onExportProject,
  onSaveProject,
  onBeforeLogout,
}) => {
  const { currentUser, logout } = useAuth();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project.name);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    if (showMobileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMobileMenu]);

  // Calculate copyright risk indicator
  const hasHighRisk = mediaItems.some((m) => m.riskLevel === "High");
  const hasMediumRisk = mediaItems.some((m) => m.riskLevel === "Medium");

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateProject({ name: titleInput.trim() });
    } else {
      setTitleInput(project.name);
    }
  };

  return (
    <header className="h-12 md:h-14 bg-zinc-950 border-b border-zinc-800 px-3 sm:px-4 flex items-center justify-between select-none z-30 shrink-0 relative">
      {/* Left: Brand + Project Title + Aspect Ratio */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link
          to="/projects"
          title="Go to Projects Library"
          className="flex items-center gap-1.5 shrink-0 hover:opacity-85 transition group"
        >
          <Film className="w-4 h-4 text-amber-400 group-hover:scale-105 transition-transform" />
          <span className="text-xs font-semibold text-zinc-200 hidden xs:inline">
            AutoCut
          </span>
        </Link>

        {/* Project Title Input / Display */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 w-28 sm:w-36 md:w-44"
            />
          ) : (
            <button
              onClick={() => {
                setTitleInput(project.name);
                setIsEditingTitle(true);
              }}
              title="Click to rename project"
              className="text-xs font-medium text-zinc-300 hover:text-white px-1 py-1 transition truncate max-w-[90px] sm:max-w-[140px] md:max-w-[200px]"
            >
              <span className="truncate">{project.name}</span>
            </button>
          )}

          {/* Aspect Ratio Badge Selector */}
          <select
            value={project.aspectRatio}
            onChange={(e) => onUpdateProject({ aspectRatio: e.target.value as AspectRatio })}
            className="bg-transparent hover:bg-zinc-900 text-[10px] sm:text-[11px] font-medium text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-800 rounded px-1.5 py-1 focus:outline-none transition cursor-pointer shrink-0"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>

          {/* Resolution Badge - Desktop only */}
          <span className="hidden xl:inline text-[10px] font-mono text-zinc-500 shrink-0">
            {project.resolution} / {project.frameRate} fps
          </span>

          {/* Autosave status indicator - Desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-zinc-500 pl-1 shrink-0">
            {isSaving ? (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-400">
                <CheckCircle2 className="w-3 h-3 text-emerald-500/80" />
                {lastSavedText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo & Quick Actions */}
      <div className="flex items-center gap-0.5 shrink-0 mx-1 sm:mx-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition min-w-[34px] min-h-[34px] flex items-center justify-center"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="p-2 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition min-w-[34px] min-h-[34px] flex items-center justify-center"
        >
          <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

      </div>

      <input
        ref={projectImportRef}
        type="file"
        accept=".zip,.autocut.zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportProject?.(file);
          event.target.value = "";
        }}
      />

      {/* Right: AI Auto Edit + Export Button + Mobile Menu */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Copyright Safety Badge Button - Desktop only */}
        <button
          onClick={() => onSelectTab("copyright")}
          className={`hidden sm:flex items-center justify-center p-2 rounded transition ${
            hasHighRisk
              ? "text-rose-400 hover:bg-rose-950/40"
              : hasMediumRisk
              ? "text-amber-400 hover:bg-amber-950/40"
              : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
          title="Open Copyright Safety Center"
        >
          {hasHighRisk ? (
            <>
              <ShieldAlert className="w-4 h-4" />
            </>
          ) : hasMediumRisk ? (
            <>
              <ShieldAlert className="w-4 h-4" />
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
            </>
          )}
        </button>

        {/* AI Auto Edit Button */}
        <button
          onClick={onOpenAIAutoEdit}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded text-zinc-300 hover:text-white hover:bg-zinc-900 transition min-h-[34px]"
          title="Run AI Automatic Editing"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">AI Auto Cut</span>
        </button>

        {/* Export for YouTube Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 transition min-h-[34px]"
          title="Export Video for YouTube"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Mobile Overflow Menu Toggle */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition min-w-[34px] min-h-[34px] flex items-center justify-center"
            title="More project actions"
            aria-label="More project actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMobileMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl py-1 z-50 text-xs">
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenNewProject();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>New Project</span>
              </button>

              {onSaveProject && (
                <button onClick={() => { setShowMobileMenu(false); onSaveProject(); }} className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5">
                  <Save className="w-4 h-4 text-emerald-400" /><span>Save Project</span>
                </button>
              )}

              {onOpenProjects && (
                <button onClick={() => { setShowMobileMenu(false); onOpenProjects(); }} className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-sky-400" /><span>Open Saved Project</span>
                </button>
              )}

              {onImportProject && (
                <button onClick={() => { setShowMobileMenu(false); projectImportRef.current?.click(); }} className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-sky-400" /><span>Import Project Archive</span>
                </button>
              )}

              {onExportProject && (
                <button onClick={() => { setShowMobileMenu(false); onExportProject(); }} className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5">
                  <Archive className="w-4 h-4 text-amber-400" /><span>Export Project Archive</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenAIAutoEdit();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>AI Auto Cut & Remix</span>
              </button>

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenQualityCheck();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>AI Quality Check</span>
              </button>

              <Link
                to="/pricing"
                onClick={() => setShowMobileMenu(false)}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Zap className="w-4 h-4 text-purple-400" />
                <span>{currentUser?.plan_slug === "free" ? "Upgrade Plan" : "Pricing & Plans"}</span>
              </Link>

              <Link
                to="/"
                onClick={() => setShowMobileMenu(false)}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Home className="w-4 h-4 text-zinc-400" />
                <span>Product Overview</span>
              </Link>

              <Link
                to="/account"
                onClick={() => setShowMobileMenu(false)}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <User className="w-4 h-4 text-zinc-400" />
                <span>Account & Quota</span>
              </Link>

              <Link
                to="/help"
                onClick={() => setShowMobileMenu(false)}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <HelpCircle className="w-4 h-4 text-zinc-400" />
                <span>Help & Guides</span>
              </Link>

              <Link
                to="/support"
                onClick={() => setShowMobileMenu(false)}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <LifeBuoy className="w-4 h-4 text-emerald-400" />
                <span>Customer Support</span>
              </Link>

              {currentUser?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setShowMobileMenu(false)}
                  className="w-full text-left px-3 py-2.5 text-amber-300 hover:bg-amber-950/30 flex items-center gap-2.5"
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Admin Dashboard</span>
                </Link>
              )}

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onSelectTab("copyright");
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Copyright Safety Center</span>
              </button>

              {onClearAllData && (
                <>
                  <div className="h-[1px] bg-zinc-800 my-1" />
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onClearAllData();
                    }}
                    className="w-full text-left px-3 py-2.5 text-rose-400 hover:bg-rose-950/40 flex items-center gap-2.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Workspace</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── User Menu (desktop) ── */}
        {currentUser && (
          <div className="relative hidden md:block" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition min-h-[34px]"
              title={`${currentUser.name} · ${currentUser.plan_name} Plan`}
              aria-label="Open profile menu"
            >
              {/* Avatar */}
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-300 shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>

              <ChevronDown className="w-3 h-3" />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg py-1 z-50 text-xs"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                {/* User info */}
                <div className="px-3 py-2 border-b border-zinc-800">
                  <p className="font-medium text-zinc-200 truncate">{currentUser.name}</p>
                  <p className="text-zinc-500 truncate">{currentUser.email}</p>
                  <p className="text-zinc-500 mt-1">{currentUser.plan_name} plan{currentUser.role === "admin" ? " · Admin" : ""}</p>
                  {currentUser.plan_slug === "free" && (
                    <p className="text-zinc-500 mt-1">
                      {currentUser.ai_videos_used}/{currentUser.ai_video_limit} AI videos used
                    </p>
                  )}
                </div>

                {/* Route Links */}
                <Link
                  to="/projects"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <FolderOpen className="w-4 h-4 text-sky-400" />
                  <span>My Projects</span>
                </Link>

                <Link
                  to="/"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <Home className="w-4 h-4 text-zinc-400" />
                  <span>Product Overview</span>
                </Link>

                <Link
                  to="/account"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>Account & Quota</span>
                </Link>

                <Link
                  to="/pricing"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>{currentUser.plan_slug === "free" ? "Upgrade Plan" : "Pricing & Plans"}</span>
                </Link>

                <Link
                  to="/help"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <HelpCircle className="w-4 h-4 text-zinc-400" />
                  <span>Help & Guides</span>
                </Link>

                <Link
                  to="/support"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2.5 transition"
                >
                  <LifeBuoy className="w-4 h-4 text-emerald-400" />
                  <span>Customer Support</span>
                </Link>

                {/* Admin panel */}
                {currentUser.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-3 py-2 text-purple-300 hover:bg-purple-950/40 flex items-center gap-2.5 transition"
                  >
                    <Crown className="w-4 h-4 text-purple-400" />
                    <span>Admin Dashboard</span>
                  </Link>
                )}

                <div className="h-[1px] bg-zinc-800 my-1" />

                {/* Logout */}
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await onBeforeLogout?.();
                    await logout();
                  }}
                  className="w-full text-left px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-rose-300 flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
