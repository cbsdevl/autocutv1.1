import React from "react";
import {
  Film,
  Music,
  Type,
  Subtitles,
  Sparkles,
  Sliders,
  Layers,
  Wand2,
  ShieldCheck,
  ShieldAlert,
  FolderOpen,
} from "lucide-react";
import { MediaItem } from "../types";

export type TabType =
  | "media"
  | "audio"
  | "text"
  | "captions"
  | "transitions"
  | "effects"
  | "adjust"
  | "ai_tools"
  | "copyright";

interface SidebarNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  mediaItems: MediaItem[];
  /** Called when the user clicks the "Projects" button in the sidebar. */
  onOpenProjects?: () => void;
  projectCount?: number;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  mediaItems,
  onOpenProjects,
  projectCount,
}) => {
  const hasRisk = mediaItems.some(
    (m) => m.riskLevel === "High" || m.riskLevel === "Medium"
  );

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: boolean; badgeColor?: string }[] = [
    { id: "media", label: "Media", icon: <Film className="w-5 h-5" /> },
    { id: "audio", label: "Audio", icon: <Music className="w-5 h-5" /> },
    { id: "text", label: "Text", icon: <Type className="w-5 h-5" /> },
    { id: "captions", label: "Captions", icon: <Subtitles className="w-5 h-5" /> },
    { id: "transitions", label: "Transitions", icon: <Layers className="w-5 h-5" /> },
    { id: "effects", label: "Effects", icon: <Sparkles className="w-5 h-5" /> },
    { id: "adjust", label: "Adjust", icon: <Sliders className="w-5 h-5" /> },
    { id: "ai_tools", label: "AI Tools", icon: <Wand2 className="w-5 h-5" /> },
    {
      id: "copyright",
      label: "Copyright",
      icon: hasRisk ? <ShieldAlert className="w-4.5 h-4.5" /> : <ShieldCheck className="w-4.5 h-4.5" />,
      badge: hasRisk,
      badgeColor: "bg-amber-500",
    },
  ];

  return (
    <aside className="hidden md:flex w-18 bg-zinc-950 border-r border-zinc-800 flex-col items-center py-2 shrink-0 select-none z-20">
      {/* ── Projects switcher button (top of sidebar) ── */}
      {onOpenProjects && (
        <div className="w-full px-1.5 mb-1.5 pb-1.5 border-b border-zinc-800/60">
          <button
            onClick={onOpenProjects}
            title="Switch Project"
            className="w-full py-2 px-1 rounded-md flex flex-col items-center justify-center gap-1 transition relative group text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
          >
            <div className="relative">
              <FolderOpen className="w-5 h-5" />
              {projectCount !== undefined && projectCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] rounded-full bg-zinc-700 text-[8px] font-medium text-zinc-200 flex items-center justify-center px-0.5">
                  {projectCount > 99 ? "99+" : projectCount}
                </span>
              )}
            </div>
            <span className="text-[9px] tracking-tight leading-none text-center font-medium">
              Projects
            </span>
          </button>
        </div>
      )}

      {/* ── Tool tabs ── */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`w-full py-2 px-1 rounded-md flex flex-col items-center justify-center gap-1 transition relative group ${
                isActive
                  ? "bg-zinc-900 text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
              title={tab.label}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                      tab.badgeColor || "bg-amber-500"
                    } ring-2 ring-zinc-950 animate-pulse`}
                  />
                )}
              </div>
              <span className="text-[9px] tracking-tight leading-none text-center font-medium">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-amber-400 rounded-r" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
