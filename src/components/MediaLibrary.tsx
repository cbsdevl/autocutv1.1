import React, { useRef, useState } from "react";
import {
  UploadCloud,
  Film,
  Music,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Play,
  ArrowUpDown,
  Search,
  ShieldCheck,
  ShieldAlert,
  Info,
  Check,
  X,
  ChevronLeft,
} from "lucide-react";
import { formatBytes, formatTimecode } from "../utils/mediaUtils";
import { CopyrightStatus, LicenseType, MediaItem, RiskLevel } from "../types";

interface MediaLibraryProps {
  mediaItems: MediaItem[];
  onUploadFiles: (files: FileList | File[]) => void;
  onDeleteMedia: (id: string) => void;
  onRenameMedia: (id: string, newName: string) => void;
  onUpdateMediaLicense: (
    id: string,
    updates: {
      licenseType: LicenseType;
      source: string;
      licenseUrl?: string;
      creator?: string;
      licenseNotes?: string;
      copyrightStatus: CopyrightStatus;
      riskLevel: RiskLevel;
    }
  ) => void;
  onAddToTimeline: (media: MediaItem, targetTrack?: string) => void;
  onOpenAutoCut?: () => void;
  onBackToStudio?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  mediaItems,
  onUploadFiles,
  onDeleteMedia,
  onRenameMedia,
  onUpdateMediaLicense,
  onAddToTimeline,
  onOpenAutoCut,
  onBackToStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<"all" | "video" | "audio" | "image">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "duration" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [editingLicenseItem, setEditingLicenseItem] = useState<MediaItem | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // License editing form state
  const [licenseForm, setLicenseForm] = useState<{
    licenseType: LicenseType;
    source: string;
    licenseUrl: string;
    creator: string;
    licenseNotes: string;
  }>({
    licenseType: "unknown",
    source: "Local upload",
    licenseUrl: "",
    creator: "",
    licenseNotes: "",
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleStartRename = (item: MediaItem) => {
    setEditingNameId(item.id);
    setEditingNameValue(item.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingNameValue.trim()) {
      onRenameMedia(id, editingNameValue.trim());
    }
    setEditingNameId(null);
  };

  const handleOpenLicenseEditor = (item: MediaItem) => {
    setEditingLicenseItem(item);
    setLicenseForm({
      licenseType: item.licenseType,
      source: item.source || "Local upload",
      licenseUrl: item.licenseUrl || "",
      creator: item.creator || "",
      licenseNotes: item.licenseNotes || "",
    });
  };

  const handleSaveLicense = () => {
    if (!editingLicenseItem) return;

    let copyrightStatus: CopyrightStatus = "Cleared";
    let riskLevel: RiskLevel = "Low";

    if (
      licenseForm.licenseType === "own" ||
      licenseForm.licenseType === "permission" ||
      licenseForm.licenseType === "public_domain" ||
      licenseForm.licenseType === "platform_licensed"
    ) {
      copyrightStatus = "Cleared";
      riskLevel = "Cleared";
    } else if (licenseForm.licenseType === "creative_commons") {
      copyrightStatus = "Cleared";
      riskLevel = "Low";
    } else if (licenseForm.licenseType === "licensed") {
      copyrightStatus = "Needs Verification";
      riskLevel = "Medium";
    } else {
      copyrightStatus = editingLicenseItem.type === "audio" ? "Potential Claim Risk" : "Needs Verification";
      riskLevel = editingLicenseItem.type === "audio" ? "High" : "Medium";
    }

    onUpdateMediaLicense(editingLicenseItem.id, {
      ...licenseForm,
      copyrightStatus,
      riskLevel,
    });
    setEditingLicenseItem(null);
  };

  // Filter and sort items
  const filtered = mediaItems.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (searchQuery.trim()) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let result = 0;
    if (sortBy === "name") {
      result = a.name.localeCompare(b.name);
    } else if (sortBy === "duration") {
      result = a.duration - b.duration;
    } else if (sortBy === "size") {
      result = a.size - b.size;
    } else {
      result = new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
    return sortOrder === "asc" ? result : -result;
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none overflow-hidden">
      {/* Media Header */}
      <div className="p-2.5 sm:p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 transition active:scale-95 min-h-[32px]"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-amber-400" />
              Media Library
              <span className="text-[10px] font-normal text-zinc-500">({mediaItems.length})</span>
            </h2>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow transition cursor-pointer active:scale-95 min-h-[32px]"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.mp3,.wav,.aac,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-2.5 border-b border-zinc-800/70 space-y-2">
        <div className="flex items-center justify-between gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800/80">
          {(["all", "video", "audio", "image"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 text-[11px] py-1 capitalize font-medium rounded-md transition ${
                filterType === type
                  ? "bg-zinc-800 text-amber-400 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-7 pr-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            title="Toggle sort order"
            className="p-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Multi-Source Music Video Remix Status Banner */}
        {(() => {
          const vCount = mediaItems.filter((m) => m.type === "video").length;
          const aCount = mediaItems.filter((m) => m.type === "audio").length;

          if (vCount >= 2) {
            return (
              <div className="p-2 rounded-lg bg-gradient-to-r from-amber-950/40 to-indigo-950/40 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-semibold truncate">
                  <Film className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{vCount} Videos Ready to Remix</span>
                </div>
                {onOpenAutoCut && (
                  <button
                    onClick={onOpenAutoCut}
                    className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[10px] shadow transition shrink-0 cursor-pointer"
                  >
                    ✨ AutoCut Mix
                  </button>
                )}
              </div>
            );
          } else if (vCount === 1) {
            return (
              <div className="p-2 rounded-lg bg-zinc-950 border border-amber-600/30 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">1 Video (Need 2+ to Remix)</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-semibold border border-zinc-700 cursor-pointer"
                >
                  + Add 2nd Video
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Drop Zone / Media Grid */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 transition relative ${
          isDraggingOver ? "bg-amber-500/10 border-2 border-dashed border-amber-500" : ""
        }`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-sm pointer-events-none">
            <UploadCloud className="w-10 h-10 text-amber-400 animate-bounce" />
            <p className="text-xs font-bold text-zinc-100 mt-2">Drop local media files here</p>
            <p className="text-[10px] text-zinc-400">Supports MP4, MOV, WEBM, MP3, WAV, PNG, JPG</p>
          </div>
        )}

        {sorted.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-64 border-2 border-dashed border-zinc-800 hover:border-amber-500/60 rounded-2xl flex flex-col items-center justify-center text-center p-6 cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/40 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <UploadCloud className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-zinc-200">Import Your Own Media</p>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-[220px]">
              Drag & drop videos, audio, or images here, or click to browse files.
            </p>
            <div className="mt-3.5 px-3 py-1.5 rounded-lg bg-zinc-800/90 border border-zinc-700/80 text-[11px] font-semibold text-zinc-200 group-hover:bg-amber-500 group-hover:text-zinc-950 transition">
              Browse Files
            </div>
            <p className="text-[10px] text-zinc-500 mt-2.5">
              MP4, MOV, WEBM, MP3, WAV, PNG, JPG
            </p>
          </div>
        ) : (
          sorted.map((item) => {
            const isVideo = item.type === "video";
            const isAudio = item.type === "audio";
            const isImage = item.type === "image";

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify({ mediaId: item.id }));
                }}
                className="group bg-zinc-950 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-2 flex items-center gap-2.5 transition relative shadow-sm"
              >
                {/* Thumbnail / Icon Container */}
                <div
                  onClick={() => setPreviewItem(item)}
                  className="w-16 h-12 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 relative cursor-pointer flex items-center justify-center group-hover:ring-1 group-hover:ring-amber-500/50"
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo ? (
                    <Film className="w-5 h-5 text-indigo-400" />
                  ) : isAudio ? (
                    <Music className="w-5 h-5 text-rose-400" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-emerald-400" />
                  )}

                  {/* Play icon overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>

                  {/* Duration pill */}
                  {item.duration > 0 && (
                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 py-0.2 rounded text-[9px] font-mono text-zinc-300">
                      {formatTimecode(item.duration, false)}
                    </span>
                  )}
                </div>

                {/* Media Details */}
                <div className="flex-1 min-w-0">
                  {editingNameId === item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingNameValue}
                        autoFocus
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onBlur={() => handleSaveRename(item.id)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRename(item.id)}
                        className="w-full bg-zinc-900 border border-zinc-700 text-xs px-1.5 py-0.5 rounded text-zinc-100 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        title={item.name}
                        className="text-xs font-semibold text-zinc-200 truncate cursor-pointer hover:text-white"
                        onClick={() => handleStartRename(item)}
                      >
                        {item.name}
                      </h3>
                      <button
                        onClick={() => handleStartRename(item)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 p-0.5"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Format & specs badge */}
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                    <span className="font-mono uppercase bg-zinc-900 px-1 rounded text-zinc-400">
                      {item.format}
                    </span>
                    {item.width > 0 && item.height > 0 && (
                      <span>
                        {item.width}x{item.height}
                      </span>
                    )}
                    <span>• {formatBytes(item.size)}</span>
                  </div>

                  {/* Copyright status pill */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      onClick={() => handleOpenLicenseEditor(item)}
                      title="Click to view & edit licensing status"
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1 border transition ${
                        item.riskLevel === "Cleared"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/40"
                          : item.riskLevel === "High"
                          ? "bg-rose-950/50 text-rose-300 border-rose-800/60 hover:bg-rose-900/60 animate-pulse"
                          : "bg-amber-950/40 text-amber-300 border-amber-800/50 hover:bg-amber-900/40"
                      }`}
                    >
                      {item.riskLevel === "Cleared" ? (
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                      )}
                      <span>{item.copyrightStatus}</span>
                    </button>
                    <span className="text-[9px] text-zinc-500 truncate max-w-[90px]">
                      {item.source}
                    </span>
                  </div>
                </div>

                {/* Quick Add to Timeline + Delete */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => onAddToTimeline(item)}
                    title="Add clip to Timeline"
                    className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-amber-500 hover:text-zinc-950 text-zinc-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteMedia(item.id)}
                    title="Delete media from project"
                    className="p-1 rounded text-zinc-600 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-200 truncate">{previewItem.name}</h3>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center min-h-[240px]">
              {previewItem.type === "video" ? (
                <video
                  src={previewItem.url}
                  controls
                  autoPlay
                  className="max-h-[300px] w-auto rounded"
                />
              ) : previewItem.type === "audio" ? (
                <div className="w-full text-center space-y-4 py-6">
                  <Music className="w-12 h-12 text-rose-400 mx-auto animate-pulse" />
                  <audio src={previewItem.url} controls autoPlay className="w-full" />
                </div>
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.name}
                  className="max-h-[300px] w-auto rounded object-contain"
                />
              )}
            </div>
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {previewItem.format.toUpperCase()} • {formatBytes(previewItem.size)}
              </span>
              <button
                onClick={() => {
                  onAddToTimeline(previewItem);
                  setPreviewItem(null);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg transition"
              >
                Add to Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Record Editor Modal */}
      {editingLicenseItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Asset License & Ownership</h3>
                  <p className="text-[11px] text-zinc-400 truncate max-w-[280px]">
                    {editingLicenseItem.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLicenseItem(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  License Status & Declaration:
                </label>
                <select
                  value={licenseForm.licenseType}
                  onChange={(e) =>
                    setLicenseForm({ ...licenseForm, licenseType: e.target.value as LicenseType })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="own">I own this content (Original recording)</option>
                  <option value="permission">I have explicit written permission / sync license</option>
                  <option value="platform_licensed">Platform-provided licensed asset (Royalty-Free)</option>
                  <option value="public_domain">Public Domain (CC0 worldwide)</option>
                  <option value="creative_commons">Creative Commons (CC-BY with attribution)</option>
                  <option value="licensed">External Commercial License (Envato, Artlist, etc.)</option>
                  <option value="unknown">Unknown / Unconfirmed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Media Source:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Local phone camera, GoPro, Studio recording, YouTube Audio Library"
                  value={licenseForm.source}
                  onChange={(e) => setLicenseForm({ ...licenseForm, source: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Creator / Artist:
                  </label>
                  <input
                    type="text"
                    placeholder="Name or handle"
                    value={licenseForm.creator}
                    onChange={(e) => setLicenseForm({ ...licenseForm, creator: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    License URL / Proof:
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={licenseForm.licenseUrl}
                    onChange={(e) => setLicenseForm({ ...licenseForm, licenseUrl: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  License Notes / Attribution:
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes, purchase order ID, or required attribution text..."
                  value={licenseForm.licenseNotes}
                  onChange={(e) => setLicenseForm({ ...licenseForm, licenseNotes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* YouTube Compliance Notice */}
              <div className="bg-amber-950/30 border border-amber-800/50 p-2.5 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300/90 leading-tight">
                  Marking an asset as "Cleared" records your documented rights. Please note that YouTube
                  Content ID may still identify matched tracks if an external publisher maintains automated
                  fingerprints.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setEditingLicenseItem(null)}
                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLicense}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow"
              >
                Save License Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
