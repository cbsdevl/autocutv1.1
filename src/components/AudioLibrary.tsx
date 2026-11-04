import React, { useState, useRef } from "react";
import {
  Music,
  Play,
  Pause,
  Plus,
  ShieldCheck,
  Search,
  ExternalLink,
  Volume2,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { MediaItem } from "../types";
import { ROYALTY_FREE_LIBRARY } from "../data/presets";
import { formatTimecode } from "../utils/mediaUtils";

interface AudioLibraryProps {
  onAddMediaToProject: (media: MediaItem) => void;
  onAddToTimeline: (media: MediaItem, targetTrack?: string) => void;
  onBackToStudio?: () => void;
}

export const AudioLibrary: React.FC<AudioLibraryProps> = ({
  onAddMediaToProject,
  onAddToTimeline,
  onBackToStudio,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  const audioTracks = ROYALTY_FREE_LIBRARY.filter((item) => item.type === "audio");

  const genres = [
    { id: "all", label: "All Genres" },
    { id: "cinematic", label: "Cinematic" },
    { id: "vlog", label: "Vlog" },
    { id: "afrobeat", label: "Afrobeat" },
  ];

  const filteredTracks = audioTracks.filter((track) => {
    if (selectedGenre !== "all") {
      if (!track.name.toLowerCase().includes(selectedGenre.toLowerCase())) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      return (
        track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.creator?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const togglePlay = (track: MediaItem) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = track.url;
      audioRef.current.play().catch((e) => console.warn("Audio play prevented:", e));
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(track.id);
    }
  };

  const handleUseTrack = (track: MediaItem) => {
    onAddMediaToProject(track);
    onAddToTimeline(track, "A2");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none overflow-hidden">
      {/* Audio Header */}
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
              <Music className="w-3.5 h-3.5 text-rose-400" />
              Royalty-Free Audio
            </h2>
            <p className="text-[10px] text-zinc-500">100% Cleared Music & Soundtracks</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40">
          <ShieldCheck className="w-3 h-3" />
          <span>License Verified</span>
        </div>
      </div>

      {/* Genre Filter & Search */}
      <div className="p-2.5 border-b border-zinc-800/70 space-y-2">
        <div className="relative">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search royalty-free tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`text-[10px] px-2.5 py-0.5 rounded-full whitespace-nowrap transition ${
                selectedGenre === g.id
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
        {filteredTracks.map((track) => {
          const isPlaying = playingId === track.id;

          return (
            <div
              key={track.id}
              className={`group bg-zinc-950 border rounded-xl p-2.5 flex items-center justify-between gap-3 transition ${
                isPlaying
                  ? "border-rose-500/50 bg-rose-950/10 shadow-sm"
                  : "border-zinc-800/90 hover:border-zinc-700"
              }`}
            >
              {/* Play / Pause preview */}
              <button
                onClick={() => togglePlay(track)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                  isPlaying
                    ? "bg-rose-500 text-white shadow-md shadow-rose-950"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 group-hover:text-rose-400"
                }`}
                title={isPlaying ? "Pause" : "Preview track"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                  {track.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                  <span className="text-zinc-400">{track.creator}</span>
                  <span>•</span>
                  <span>{formatTimecode(track.duration, false)}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-emerald-400 mt-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span className="truncate">{track.source}</span>
                </div>
              </div>

              {/* Add to Timeline button */}
              <button
                onClick={() => handleUseTrack(track)}
                title="Add to timeline music track (A2)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500 hover:text-white text-zinc-300 text-[11px] font-bold transition shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Use</span>
              </button>
            </div>
          );
        })}

        {/* License assurance notice */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Pre-Cleared Sync Licenses</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            All tracks in this library are selected from public domain or certified royalty-free
            platforms. Their license documents are automatically included in your export package.
          </p>
        </div>
      </div>
    </div>
  );
};
