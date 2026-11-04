import React, { useState } from "react";
import {
  Clock3,
  Film,
  FolderOpen,
  Plus,
  Trash2,
  X,
  Copy,
  Search,
  SortAsc,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from "lucide-react";

export interface SavedProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  mediaCount: number;
  thumbnail?: string;
}

interface ProjectLibraryModalProps {
  isOpen: boolean;
  projects: SavedProjectSummary[];
  loading: boolean;
  currentProjectId?: string;
  onClose: () => void;
  onOpen: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onDuplicate?: (projectId: string) => void;
  onNewProject: () => void;
  /** Whether a save is in progress (used to show spinner on "Save Current" action). */
  isSaving?: boolean;
}

type SortKey = "updatedAt" | "name" | "mediaCount";

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ProjectLibraryModal: React.FC<ProjectLibraryModalProps> = ({
  isOpen,
  projects,
  loading,
  currentProjectId,
  onClose,
  onOpen,
  onDelete,
  onDuplicate,
  onNewProject,
  isSaving = false,
}) => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hoverProjectId, setHoverProjectId] = useState<string | null>(null);

  if (!isOpen) return null;

  // ── filter + sort ──────────────────────────────────────────────
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "updatedAt") cmp = a.updatedAt.localeCompare(b.updatedAt);
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "mediaCount") cmp = a.mediaCount - b.mediaCount;
      return sortAsc ? cmp : -cmp;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleDeleteConfirmed = (id: string) => {
    setConfirmDeleteId(null);
    onDelete(id);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="relative w-full max-w-3xl flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/50"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3 shrink-0 bg-zinc-950">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-zinc-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Project Library</h2>
              <p className="text-[11px] text-slate-500">
                {loading ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""} saved in this browser`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* New Project */}
            <button
              onClick={() => { onClose(); onNewProject(); }}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Toolbar (Search + Sort) ───────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0d1117] px-5 py-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none ring-0 focus:border-amber-500/60 focus:bg-white/8 transition"
            />
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-1">
            {(["updatedAt", "name", "mediaCount"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition ${
                  sortKey === key
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                <SortAsc className={`h-3 w-3 transition-transform ${sortKey === key && sortAsc ? "rotate-180" : ""}`} />
                {key === "updatedAt" ? "Recent" : key === "name" ? "Name" : "Media"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Project Grid / List ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
              <p className="text-sm text-slate-400">Loading your projects…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-600">
                <FolderOpen className="h-7 w-7" />
              </div>
              {search ? (
                <>
                  <p className="text-sm font-medium text-slate-300">No projects match "{search}"</p>
                  <p className="text-xs text-slate-500">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-300">No saved projects yet</p>
                  <p className="text-xs text-slate-500 max-w-[260px]">
                    Your projects are saved automatically. Create a new project to get started.
                  </p>
                  <button
                    onClick={() => { onClose(); onNewProject(); }}
                    className="mt-1 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Your First Project
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04] px-2 py-2">
              {filtered.map((project) => {
                const isCurrent = project.id === currentProjectId;
                const isConfirmingDelete = confirmDeleteId === project.id;
                const isRenaming = renamingId === project.id;

                return (
                  <li
                    key={project.id}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                      isCurrent
                        ? "bg-zinc-900"
                        : "hover:bg-white/[0.04]"
                    }`}
                    onMouseEnter={() => setHoverProjectId(project.id)}
                    onMouseLeave={() => setHoverProjectId(null)}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-[52px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-700">
                          <Film className="h-6 w-6" />
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20">
                          <span className="rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                            Active
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Project info */}
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => setRenamingId(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setRenamingId(null);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded border border-amber-500/50 bg-zinc-900 px-2 py-0.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      ) : (
                        <button
                          onClick={() => isCurrent ? undefined : onOpen(project.id)}
                          className="block w-full text-left"
                          disabled={isCurrent}
                        >
                          <span className={`block truncate text-sm font-medium ${isCurrent ? "text-zinc-100" : "text-slate-100 group-hover:text-white"}`}>
                            {project.name}
                          </span>
                        </button>
                      )}

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Film className="h-2.5 w-2.5" />
                          {project.mediaCount} media clip{project.mediaCount !== 1 ? "s" : ""}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          title={formatFullDate(project.updatedAt)}
                        >
                          <Clock3 className="h-2.5 w-2.5" />
                          {formatRelativeTime(project.updatedAt)}
                        </span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-amber-400/80">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Currently open
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (visible on hover or when confirming delete) */}
                    <div className={`flex items-center gap-1 shrink-0 transition-opacity ${
                      hoverProjectId === project.id || isConfirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2 py-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          <span className="text-[10px] text-rose-300">Delete?</span>
                          <button
                            onClick={() => handleDeleteConfirmed(project.id)}
                            className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-400 transition"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/20 transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          {!isCurrent && (
                            <button
                              onClick={() => onOpen(project.id)}
                              title={`Open "${project.name}"`}
                              className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-300 transition hover:bg-sky-500/20 active:scale-95"
                            >
                              <FolderOpen className="h-3 w-3" />
                              Open
                            </button>
                          )}

                          {onDuplicate && (
                            <button
                              onClick={() => onDuplicate(project.id)}
                              title={`Duplicate "${project.name}"`}
                              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-200 active:scale-95"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setRenamingId(project.id);
                              setRenameValue(project.name);
                            }}
                            title={`Rename "${project.name}"`}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-200 active:scale-95"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setConfirmDeleteId(project.id)}
                            title={`Delete "${project.name}"`}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        {!loading && projects.length > 0 && (
          <footer className="flex items-center justify-between border-t border-white/[0.06] bg-[#0d1117] px-5 py-3 shrink-0">
            <p className="text-[10px] text-slate-600">
              Projects are saved privately in this browser. Export an archive to back up your work.
            </p>
            {isSaving && (
              <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Saving…
              </span>
            )}
          </footer>
        )}
      </section>
    </div>
  );
};
