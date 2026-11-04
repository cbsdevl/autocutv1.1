import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  Plus,
  Search,
  Clock,
  Trash2,
  Copy,
  Download,
  Upload,
  ArrowRight,
  SlidersHorizontal,
  FolderOpen,
  Calendar,
  Sparkles,
  HelpCircle,
  Crown,
  User,
  Zap,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listProjectsForUser,
  loadProjectForUser,
  deleteProjectForUser,
  duplicateProjectForUser,
  exportProjectArchive,
  importProjectArchive,
  saveProjectForUser,
  downloadProjectArchive,
  SavedProjectSummary,
  ProjectSnapshot,
} from "../utils/projectStorage";
import { DEFAULT_TRACKS } from "../data/presets";

type SortOption = "updatedAt" | "name" | "mediaCount";

export const ProjectsPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const userId = currentUser?.id ?? 0;

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await listProjectsForUser(userId);
      setProjects(list);
    } catch {
      showNotification("error", "Failed to load projects from storage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [userId]);

  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    list.sort((a, b) => {
      if (sortBy === "updatedAt") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "mediaCount") {
        return b.mediaCount - a.mediaCount;
      }
      return 0;
    });

    return list;
  }, [projects, searchQuery, sortBy]);

  const handleCreateNewProject = async () => {
    setIsProcessing(true);
    try {
      const newId = "proj_" + Date.now();
      const newSnapshot: ProjectSnapshot = {
        project: {
          id: newId,
          name: "Untitled Video Project",
          aspectRatio: "16:9",
          resolution: "1080p",
          frameRate: 30,
          stylePreset: "Cinematic",
          autoSave: true,
          duration: 0,
        },
        tracks: DEFAULT_TRACKS.map((t) => ({ ...t, clips: [] })),
        captions: [],
        mediaItems: [],
        currentTime: 0,
        selectedClipId: null,
        selectedCaptionStyle: "YouTube",
        isVideoAudioMuted: true,
        youtubePackage: null,
        auditReport: null,
      };

      await saveProjectForUser(userId, newSnapshot);
      navigate(`/editor/${newId}`);
    } catch (err) {
      showNotification("error", "Could not create new project.");
      setIsProcessing(false);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      const duplicatedId = await duplicateProjectForUser(userId, id);
      if (duplicatedId) {
        showNotification("success", "Project duplicated successfully.");
        await loadProjects();
      }
    } catch {
      showNotification("error", "Failed to duplicate project.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteProjectForUser(userId, id);
      setDeleteConfirmId(null);
      showNotification("success", "Project deleted successfully.");
      await loadProjects();
    } catch {
      showNotification("error", "Failed to delete project.");
    }
  };

  const handleExportZip = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const snapshot = await loadProjectForUser(userId, id);
      if (!snapshot) throw new Error("Could not find project data");
      const blob = await exportProjectArchive(snapshot);
      const name = snapshot.project.name || "project";
      downloadProjectArchive(blob, name);
      showNotification("success", "Project archive downloaded.");
    } catch {
      showNotification("error", "Could not export project archive.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const snapshot = await importProjectArchive(file);
      await saveProjectForUser(userId, snapshot);
      showNotification("success", `Imported "${snapshot.project.name}"`);
      await loadProjects();
      navigate(`/editor/${snapshot.project.id}`);
    } catch {
      showNotification("error", "Invalid or corrupted project archive.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-zinc-950 font-bold shadow-md shadow-amber-400/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">AutoCut AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/editor"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Studio
            </Link>
            <Link
              to="/projects"
              className="px-3 py-1.5 rounded-md text-amber-400 bg-amber-400/10 font-semibold"
            >
              Projects
            </Link>
            <Link
              to="/pricing"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Guides
            </Link>
            {currentUser?.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 transition-colors flex items-center gap-1"
              >
                <Crown className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/editor"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            Open Studio
          </Link>

          <Link
            to="/account"
            className="flex items-center gap-2 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-xs"
            title="Account Settings"
          >
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-amber-400">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden sm:inline font-medium text-zinc-300">{currentUser?.name}</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner notification */}
        {notification && (
          <div
            className={`mb-6 p-3.5 rounded-lg border text-sm flex items-center gap-2.5 transition-all ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <FolderOpen className="w-7 h-7 text-amber-400" />
              Project Library
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Manage your video timeline projects, create new cuts, and import archives.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip,.autocut.zip,application/zip"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 transition"
              title="Import project package (.zip)"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Import Archive</span>
            </button>

            <button
              onClick={handleCreateNewProject}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-zinc-950 transition shadow-lg shadow-amber-400/20"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your projects..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400/80 transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-zinc-500 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="updatedAt">Recently Edited</option>
              <option value="name">Project Name (A-Z)</option>
              <option value="mediaCount">Most Media Assets</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-sm">Loading your projects…</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 px-4 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
              <Film className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
              {searchQuery ? "No matching projects found" : "No saved projects yet"}
            </h3>
            <p className="text-zinc-500 text-xs sm:text-sm max-w-sm mx-auto mb-6">
              {searchQuery
                ? `No project matches "${searchQuery}". Try a different keyword.`
                : "Create a new project to start editing with AutoCut AI's timeline, captions, and smart effects."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNewProject}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
              >
                <Plus className="w-4 h-4" />
                Create First Video Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProjects.map((p) => {
              const isDeleting = deleteConfirmId === p.id;
              const formattedDate = new Date(p.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/editor/${p.id}`)}
                  className="group bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl relative"
                >
                  <div>
                    {/* Thumbnail placeholder */}
                    <div className="aspect-video w-full rounded-lg bg-zinc-950 border border-zinc-800/80 mb-3.5 overflow-hidden flex items-center justify-center relative group-hover:border-amber-400/30 transition-colors">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-zinc-600">
                          <Film className="w-8 h-8 group-hover:text-amber-400/70 transition-colors" />
                          <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">
                            1080p Studio Project
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono">
                        {p.mediaCount} assets
                      </div>
                    </div>

                    <h3 className="font-semibold text-white text-sm sm:text-base group-hover:text-amber-400 transition-colors truncate">
                      {p.name}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Card bottom actions */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Open Studio <ArrowRight className="w-3 h-3" />
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(p.id, e)}
                        title="Duplicate project"
                        className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleExportZip(p.id, e)}
                        title="Download backup archive"
                        className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {isDeleting ? (
                        <div
                          className="flex items-center gap-1 bg-red-950/80 border border-red-800 rounded p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleDelete(p.id, e)}
                            className="px-2 py-0.5 text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white rounded"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="px-1 text-[10px] text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(p.id);
                          }}
                          title="Delete project"
                          className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
